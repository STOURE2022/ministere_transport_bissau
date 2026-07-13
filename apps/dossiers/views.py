"""Endpoints de l'app dossiers (étape 2 du processus métier)."""
import mimetypes
from io import BytesIO

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdmin, IsAgentOrAdmin
from apps.core.services import log_action

from .historique import construire_historique
from .historique_pdf import rendre_historique_pdf
from .models import Document, Dossier, StatutDossier, StatutVerifDocument
from .permissions import STAFF_ROLES, IsProprietaireOrStaff
from .serializers import (
    DocumentSerializer,
    DossierCreateSerializer,
    DossierDetailSerializer,
    DossierListSerializer,
    VerifierDocumentSerializer,
)
from .services import archiver_dossier, generer_numero_dossier, rouvrir_dossier, soumettre_dossier


class DossierViewSet(viewsets.ModelViewSet):
    """
    Dossiers d'immatriculation.
    - Usager : ses propres dossiers (création, modification tant que brouillon).
    - Agent / Admin : accès à tous les dossiers.
    """

    permission_classes = [IsAuthenticated, IsProprietaireOrStaff]

    def get_serializer_class(self):
        if self.action == "list":
            return DossierListSerializer
        if self.action in ("create", "update", "partial_update"):
            return DossierCreateSerializer
        return DossierDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Dossier.objects.select_related("vehicule", "usager").prefetch_related("documents")
        if user.role in STAFF_ROLES:
            pass  # accès à tout
        else:
            qs = qs.filter(usager=user)

        params = self.request.query_params
        if statut := params.get("statut"):
            qs = qs.filter(statut=statut)
        if type_veh := params.get("type_vehicule"):
            qs = qs.filter(vehicule__type_vehicule=type_veh)
        if recherche := params.get("q"):
            from django.db.models import Q
            qs = qs.filter(
                Q(numero_dossier__icontains=recherche)
                | Q(vehicule__vin__icontains=recherche)
                | Q(usager__nom__icontains=recherche)
                | Q(usager__prenom__icontains=recherche)
            )
        return qs

    def create(self, request, *args, **kwargs):
        if request.user.role != "USAGER":
            raise PermissionDenied("Seul un usager peut créer un dossier.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        dossier = serializer.save(numero_dossier=generer_numero_dossier())
        log_action("DOSSIER_CREE", user=self.request.user, objet=dossier,
                   request=self.request, numero=dossier.numero_dossier)

    def update(self, request, *args, **kwargs):
        dossier = self.get_object()
        if not dossier.est_modifiable:
            raise ValidationError("Ce dossier n'est plus modifiable (déjà soumis).")
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        dossier = self.get_object()
        if not dossier.est_modifiable:
            raise ValidationError("Un dossier déjà soumis ne peut pas être supprimé.")
        return super().destroy(request, *args, **kwargs)

    @extend_schema(
        request=None,
        responses={200: OpenApiResponse(description="Dossier soumis"),
                   400: OpenApiResponse(description="Pièces manquantes ou dates incohérentes")},
    )
    @action(detail=True, methods=["post"])
    def soumettre(self, request, pk=None):
        """Passe le dossier de Brouillon à Soumis puis déclenche la vérification auto (étape 3)."""
        dossier = self.get_object()
        if request.user.role != "USAGER" or dossier.usager_id != request.user.id:
            raise PermissionDenied("Seul l'usager propriétaire peut soumettre son dossier.")

        ok, problemes = soumettre_dossier(dossier)
        if not ok:
            return Response({"detail": "Soumission impossible.", "problemes": problemes},
                            status=status.HTTP_400_BAD_REQUEST)

        log_action("DOSSIER_SOUMIS", user=request.user, objet=dossier,
                   request=request, numero=dossier.numero_dossier)

        # Déclenche la vérification automatique (import local pour éviter un cycle).
        from apps.verifications.services import lancer_verification
        from apps.verifications.serializers import VerificationAutoSerializer

        verif = lancer_verification(dossier, request=request)
        dossier.refresh_from_db()
        data = DossierDetailSerializer(dossier).data
        data["verification"] = VerificationAutoSerializer(verif).data
        return Response(data)

    @extend_schema(
        request=None,
        responses={200: OpenApiResponse(description="Dossier rouvert pour correction"),
                   400: OpenApiResponse(description="Le dossier n'est pas rejeté")},
    )
    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        """Rouvre un dossier rejeté (REJETE → BROUILLON) pour que l'usager le corrige."""
        dossier = self.get_object()
        if request.user.role != "USAGER" or dossier.usager_id != request.user.id:
            raise PermissionDenied("Seul l'usager propriétaire peut corriger son dossier.")
        ok, message = rouvrir_dossier(dossier, request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        dossier.refresh_from_db()
        return Response(DossierDetailSerializer(dossier).data)


class HistoriqueView(APIView):
    """Dossier de vie : frise chronologique agrégée (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated, IsProprietaireOrStaff]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, dossier_id):
        dossier = get_object_or_404(
            Dossier.objects.select_related("vehicule", "usager"), pk=dossier_id)
        self.check_object_permissions(request, dossier)
        return Response(construire_historique(dossier))


class HistoriquePdfView(APIView):
    """Export PDF du dossier de vie (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated, IsProprietaireOrStaff]

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    def get(self, request, dossier_id):
        dossier = get_object_or_404(
            Dossier.objects.select_related("vehicule", "usager"), pk=dossier_id)
        self.check_object_permissions(request, dossier)
        pdf = rendre_historique_pdf(construire_historique(dossier))
        resp = FileResponse(BytesIO(pdf), content_type="application/pdf",
                            as_attachment=False, filename=f"dossier-de-vie-{dossier.numero_dossier}.pdf")
        return resp


class ArchiverView(APIView):
    """Archive un dossier (fin de cycle de vie) — administration uniquement."""

    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(request=None, responses={200: DossierDetailSerializer})
    def post(self, request, dossier_id):
        dossier = get_object_or_404(Dossier, pk=dossier_id)
        ok, message = archiver_dossier(dossier, request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        data = DossierDetailSerializer(dossier).data
        data["message"] = message
        return Response(data)


class DocumentListCreateView(ListCreateAPIView):
    """Liste et dépôt des pièces d'un dossier."""

    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsProprietaireOrStaff]

    def get_dossier(self) -> Dossier:
        dossier = get_object_or_404(Dossier, pk=self.kwargs["dossier_id"])
        self.check_object_permissions(self.request, dossier)
        return dossier

    def get_queryset(self):
        return self.get_dossier().documents.all()

    def perform_create(self, serializer):
        dossier = self.get_dossier()
        if dossier.usager_id != self.request.user.id:
            raise PermissionDenied("Seul l'usager propriétaire peut déposer des pièces.")
        if not dossier.est_modifiable:
            raise ValidationError("Impossible d'ajouter une pièce à un dossier déjà soumis.")
        document = serializer.save(dossier=dossier)
        log_action("DOCUMENT_AJOUTE", user=self.request.user, objet=dossier,
                   request=self.request, type_document=document.type_document)


class DocumentFichierView(APIView):
    """
    Sert le FICHIER d'une pièce justificative (propriétaire ou staff).

    Indispensable pour que l'agent puisse *consulter* les pièces avant de valider
    un dossier : les médias ne sont pas servis publiquement en production, on passe
    donc par cet endpoint authentifié (comme le PDF du certificat). Réponse *inline*
    pour un affichage direct dans le navigateur (PDF / image).
    """

    permission_classes = [IsAuthenticated, IsProprietaireOrStaff]

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        document = get_object_or_404(Document.objects.select_related("dossier"), pk=pk)
        self.check_object_permissions(request, document)
        if not document.fichier:
            raise NotFound("Fichier indisponible.")
        content_type = mimetypes.guess_type(document.fichier.name)[0] or "application/octet-stream"
        extension = (document.format or "").lower().lstrip(".")
        nom = f"{document.type_document.lower()}-{str(document.id)[:8]}"
        if extension:
            nom = f"{nom}.{extension}"
        return FileResponse(
            document.fichier.open("rb"),
            content_type=content_type,
            as_attachment=False,
            filename=nom,
        )


class DocumentVerifierView(APIView):
    """
    Validation d'une pièce, une par une, par l'agent : conforme ou non conforme
    (avec motif). Indépendant de la décision globale sur le dossier.
    """

    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(request=VerifierDocumentSerializer, responses={200: DocumentSerializer})
    def post(self, request, pk):
        document = get_object_or_404(Document.objects.select_related("dossier"), pk=pk)
        s = VerifierDocumentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        statut = s.validated_data["statut"]
        motif = s.validated_data.get("motif", "").strip()
        if statut == StatutVerifDocument.NON_CONFORME and not motif:
            return Response({"detail": "Un motif est requis pour une pièce non conforme."},
                            status=status.HTTP_400_BAD_REQUEST)

        document.statut_verif = statut
        document.motif_verif = motif if statut == StatutVerifDocument.NON_CONFORME else ""
        document.verifie_par = request.user
        document.save(update_fields=["statut_verif", "motif_verif", "verifie_par", "date_maj"])

        log_action("PIECE_VERIFIEE", user=request.user, objet=document.dossier,
                   request=request, type_document=document.type_document, statut=statut)

        # L'usager est prévenu qu'une pièce précise de son dossier a été refusée.
        if statut == StatutVerifDocument.NON_CONFORME:
            from apps.notifications.models import NiveauNotification
            from apps.notifications.services import notifier
            dossier = document.dossier
            notifier(
                dossier.usager, NiveauNotification.ACTION,
                titre="Pièce refusée",
                message=f"La pièce « {document.get_type_document_display()} » de votre dossier "
                        f"{dossier.numero_dossier} a été refusée. Motif : {motif}",
                categorie="Action requise", lien=f"/dossiers/{dossier.id}",
                cta_label="Voir le dossier",
            )
        return Response(DocumentSerializer(document).data)


class DocumentDetailView(RetrieveDestroyAPIView):
    """Consultation et suppression d'une pièce."""

    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsProprietaireOrStaff]
    queryset = Document.objects.select_related("dossier")

    def perform_destroy(self, instance):
        if instance.dossier.usager_id != self.request.user.id:
            raise PermissionDenied("Seul l'usager propriétaire peut supprimer une pièce.")
        if not instance.dossier.est_modifiable:
            raise ValidationError("Impossible de supprimer une pièce d'un dossier déjà soumis.")
        instance.delete()

"""Endpoints paiements : montant, règlement, reçu, liste (staff), configuration (admin)."""
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdmin, IsStaffRole
from apps.dossiers.models import Dossier
from apps.dossiers.permissions import STAFF_ROLES, IsProprietaireOrStaff

from .models import ConfigurationPaiement, OperateurPaiement, Paiement, StatutPaiement
from .serializers import (
    ConfigurationPaiementSerializer,
    MontantSerializer,
    OperateurPaiementSerializer,
    PaiementSerializer,
    PayerSerializer,
)
from .services import config, operateurs_actifs, paiement_paye, payer


class MontantView(APIView):
    """Montant dû + opérateurs actifs pour un dossier (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated, IsProprietaireOrStaff]

    @extend_schema(responses={200: MontantSerializer})
    def get(self, request, dossier_id):
        dossier = get_object_or_404(Dossier, pk=dossier_id)
        self.check_object_permissions(request, dossier)
        cfg = config()
        data = {
            "devise": cfg.devise,
            "lignes": cfg.lignes(),
            "total": cfg.total(),
            "operateurs": OperateurPaiementSerializer(
                operateurs_actifs(), many=True).data,
            "deja_paye": paiement_paye(dossier),
        }
        return Response(data)


class DossierPaiementView(APIView):
    """
    Paiement d'un dossier.
    - GET : le paiement réglé du dossier (propriétaire ou staff).
    - POST : règle la taxe (propriétaire) via mobile money.
    """

    permission_classes = [IsAuthenticated, IsProprietaireOrStaff]

    @extend_schema(responses={200: PaiementSerializer})
    def get(self, request, dossier_id):
        dossier = get_object_or_404(Dossier, pk=dossier_id)
        self.check_object_permissions(request, dossier)
        paiement = (
            dossier.paiements.filter(statut=StatutPaiement.PAYE).first()
            or dossier.paiements.first()
        )
        if paiement is None:
            return Response({"detail": "Aucun paiement pour ce dossier."},
                            status=status.HTTP_404_NOT_FOUND)
        return Response(PaiementSerializer(paiement).data)

    @extend_schema(request=PayerSerializer, responses={201: PaiementSerializer})
    def post(self, request, dossier_id):
        dossier = get_object_or_404(Dossier, pk=dossier_id)
        self.check_object_permissions(request, dossier)
        if request.user.role not in STAFF_ROLES and dossier.usager_id != request.user.id:
            return Response({"detail": "Seul le propriétaire peut régler la taxe."},
                            status=status.HTTP_403_FORBIDDEN)
        s = PayerSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ok, message, paiement = payer(
            dossier, operateur_code=s.validated_data["operateur"],
            numero=s.validated_data["numero"], user=request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        data = PaiementSerializer(paiement).data
        data["message"] = message
        return Response(data, status=status.HTTP_201_CREATED)


class RecuPdfView(APIView):
    """Téléchargement du reçu PDF (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        paiement = get_object_or_404(Paiement.objects.select_related("dossier"), pk=pk)
        dossier = paiement.dossier
        if request.user.role not in STAFF_ROLES and dossier.usager_id != request.user.id:
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)
        if not paiement.pdf_fichier:
            return Response({"detail": "Reçu indisponible."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(paiement.pdf_fichier.open("rb"), content_type="application/pdf",
                            as_attachment=False, filename=f"recu-{paiement.reference}.pdf")


class PaiementListView(ListAPIView):
    """
    Liste des paiements.
    - Staff (agent / admin) : tous les paiements (« voir les achats »).
    - Usager : ses propres paiements.
    Filtres : ?statut= , ?q= (référence / dossier / usager).
    """

    serializer_class = PaiementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Paiement.objects.select_related("dossier", "dossier__usager", "dossier__vehicule")
        if user.role not in STAFF_ROLES:
            qs = qs.filter(dossier__usager=user)
        params = self.request.query_params
        if statut := params.get("statut"):
            qs = qs.filter(statut=statut)
        if q := params.get("q"):
            from django.db.models import Q
            qs = qs.filter(
                Q(reference__icontains=q)
                | Q(dossier__numero_dossier__icontains=q)
                | Q(dossier__usager__nom__icontains=q)
                | Q(dossier__usager__prenom__icontains=q)
            )
        return qs


class PaiementStatsView(APIView):
    """Synthèse des paiements (staff) pour le tableau de bord."""

    permission_classes = [IsAuthenticated, IsStaffRole]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        from django.db.models import Sum
        payes = Paiement.objects.filter(statut=StatutPaiement.PAYE)
        return Response({
            "nombre_payes": payes.count(),
            "montant_total": payes.aggregate(s=Sum("montant_total"))["s"] or 0,
            "en_attente": Paiement.objects.filter(statut=StatutPaiement.EN_ATTENTE).count(),
            "devise": config().devise,
        })


class ConfigurationView(APIView):
    """
    Configuration des paiements.
    - GET : lecture (tout utilisateur authentifié — nécessaire au parcours).
    - PUT : mise à jour (administration).
    """

    def get_permissions(self):
        if self.request.method == "PUT":
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    @extend_schema(responses={200: ConfigurationPaiementSerializer})
    def get(self, request):
        return Response(ConfigurationPaiementSerializer(config()).data)

    @extend_schema(request=ConfigurationPaiementSerializer, responses={200: ConfigurationPaiementSerializer})
    def put(self, request):
        cfg = config()
        s = ConfigurationPaiementSerializer(cfg, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class OperateurListCreateView(ListAPIView):
    """Liste des opérateurs (lecture authentifiée) et création (admin)."""

    serializer_class = OperateurPaiementSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return OperateurPaiement.objects.all()

    @extend_schema(request=OperateurPaiementSerializer, responses={201: OperateurPaiementSerializer})
    def post(self, request):
        s = OperateurPaiementSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data, status=status.HTTP_201_CREATED)


class OperateurDetailView(APIView):
    """Mise à jour / suppression d'un opérateur (administration)."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        op = get_object_or_404(OperateurPaiement, pk=pk)
        s = OperateurPaiementSerializer(op, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    def delete(self, request, pk):
        op = get_object_or_404(OperateurPaiement, pk=pk)
        op.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

"""Endpoints d'émission, consultation, PDF et révocation du certificat (étape 6)."""
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdmin, IsAgentOrAdmin, IsStaffRole
from apps.dossiers.models import Dossier
from apps.dossiers.permissions import STAFF_ROLES

from .models import Certificat, ResultatScan
from .serializers import (
    CertificatSerializer,
    RevocationSerializer,
    ScanLogSerializer,
    VerificationResultSerializer,
)
from .services import emettre_certificat, revoquer_certificat
from .verification import MESSAGES, verifier_certificat

# Résultats pour lesquels on affiche les données du véhicule (données fiables).
_RESULTATS_AVEC_DONNEES = {ResultatScan.AUTHENTIQUE, ResultatScan.REVOQUE, ResultatScan.EXPIRE}


def _accessible(user, certificat) -> bool:
    return user.role in STAFF_ROLES or certificat.dossier.usager_id == user.id


class EmettreCertificatView(APIView):
    """Émet le certificat QR d'un dossier immatriculé (agent / admin)."""

    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(request=None,
                   responses={201: CertificatSerializer,
                              400: OpenApiResponse(description="Dossier non immatriculé ou déjà certifié")})
    def post(self, request, dossier_id):
        dossier = get_object_or_404(Dossier, pk=dossier_id)
        ok, message, certificat = emettre_certificat(dossier, request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        data = CertificatSerializer(certificat, context={"request": request}).data
        data["message"] = message
        return Response(data, status=status.HTTP_201_CREATED)


class CertificatDetailView(APIView):
    """Détail d'un certificat (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: CertificatSerializer})
    def get(self, request, uuid):
        certificat = get_object_or_404(Certificat, pk=uuid)
        if not _accessible(request.user, certificat):
            raise NotFound()
        return Response(CertificatSerializer(certificat, context={"request": request}).data)


class CertificatPdfView(APIView):
    """Téléchargement du PDF du certificat (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    def get(self, request, uuid):
        certificat = get_object_or_404(Certificat, pk=uuid)
        if not _accessible(request.user, certificat):
            raise NotFound()
        if not certificat.pdf_fichier:
            raise NotFound("PDF indisponible.")
        return FileResponse(certificat.pdf_fichier.open("rb"),
                            content_type="application/pdf",
                            filename=f"certificat-{certificat.id}.pdf")


class RevoquerCertificatView(APIView):
    """Révocation d'un certificat (admin uniquement)."""

    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(request=RevocationSerializer,
                   responses={200: CertificatSerializer})
    def post(self, request, uuid):
        certificat = get_object_or_404(Certificat, pk=uuid)
        s = RevocationSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ok, message, certificat = revoquer_certificat(
            certificat, request.user, s.validated_data["motif"], request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        data = CertificatSerializer(certificat, context={"request": request}).data
        data["message"] = message
        return Response(data)


def _donnees_publiques(certificat) -> dict:
    snap = certificat.donnees_snapshot
    return {
        "immatriculation": snap.get("immatriculation"),
        "proprietaire": snap.get("proprietaire"),
        "marque_modele": f"{snap.get('marque', '')} {snap.get('modele', '')}".strip() or None,
        "annee": snap.get("annee"),
        "statut": certificat.statut,
        "assurance_echeance": snap.get("assurance_echeance"),
        "ct_echeance": snap.get("ct_echeance"),
        "date_emission": certificat.date_emission,
        "date_expiration": certificat.date_expiration,
    }


class VerifyView(APIView):
    """
    Vérification PUBLIQUE d'un certificat par QR (forces de l'ordre).
    Recalcule l'empreinte, vérifie la signature RSA et le statut, journalise
    le scan. Répond AUTHENTIQUE / FALSIFIE / REVOQUE / EXPIRE / INTROUVABLE.
    """

    permission_classes = [AllowAny]
    throttle_scope = "verify"

    @extend_schema(responses={200: VerificationResultSerializer})
    def get(self, request, uuid):
        hash_fourni = request.query_params.get("h")
        localisation = request.query_params.get("loc", "")
        user = request.user if request.user.is_authenticated else None

        resultat, certificat = verifier_certificat(
            uuid, hash_fourni, user=user, request=request, localisation=localisation)

        donnees = (
            _donnees_publiques(certificat)
            if certificat is not None and resultat in _RESULTATS_AVEC_DONNEES
            else None
        )
        return Response({
            "resultat": resultat,
            "message": MESSAGES[resultat],
            "verifie_le": timezone.now(),
            "certificat": donnees,
        })


class ScansListView(ListAPIView):
    """Historique des scans d'un certificat (personnel SNICV / forces de l'ordre)."""

    serializer_class = ScanLogSerializer
    permission_classes = [IsAuthenticated, IsStaffRole]

    def get_queryset(self):
        certificat = get_object_or_404(Certificat, pk=self.kwargs["uuid"])
        return certificat.scans.select_related("scanne_par")

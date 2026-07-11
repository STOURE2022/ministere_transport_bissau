"""Endpoints de consultation et de relance de la vérification automatique."""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAgentOrAdmin
from apps.dossiers.models import Dossier
from apps.dossiers.permissions import STAFF_ROLES

from .models import VerificationAuto
from .serializers import VerificationAutoSerializer
from .services import lancer_verification


class VerificationDetailView(APIView):
    """Rapport de vérification d'un dossier (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: VerificationAutoSerializer,
                   404: OpenApiResponse(description="Aucune vérification (dossier non soumis)")},
    )
    def get(self, request, dossier_id):
        dossier = get_object_or_404(Dossier, pk=dossier_id)
        user = request.user
        # Non-propriétaire non-staff : 404 (on ne révèle pas l'existence du dossier).
        if user.role not in STAFF_ROLES and dossier.usager_id != user.id:
            raise NotFound()
        verif = get_object_or_404(VerificationAuto, dossier=dossier)
        return Response(VerificationAutoSerializer(verif).data)


class RelancerVerificationView(APIView):
    """Relance les contrôles automatiques d'un dossier (agent / admin)."""

    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(request=None, responses={200: VerificationAutoSerializer})
    def post(self, request, dossier_id):
        dossier = get_object_or_404(Dossier, pk=dossier_id)
        verif = lancer_verification(dossier, request=request)
        return Response(VerificationAutoSerializer(verif).data)

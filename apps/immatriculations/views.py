"""Endpoints d'attribution et de consultation d'immatriculation (étape 5)."""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAgentOrAdmin
from apps.dossiers.models import Dossier
from apps.dossiers.permissions import STAFF_ROLES

from .models import Immatriculation
from .serializers import ImmatriculationSerializer
from .services import attribuer_immatriculation


class ImmatriculerView(APIView):
    """Attribue une immatriculation à un dossier validé (agent / admin)."""

    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(
        request=None,
        responses={201: ImmatriculationSerializer,
                   400: OpenApiResponse(description="Dossier non validé ou déjà immatriculé")},
    )
    def post(self, request, dossier_id):
        dossier = get_object_or_404(Dossier, pk=dossier_id)
        ok, message, immat = attribuer_immatriculation(dossier, request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        data = ImmatriculationSerializer(immat).data
        data["message"] = message
        return Response(data, status=status.HTTP_201_CREATED)


class ImmatriculationDetailView(APIView):
    """Consultation de l'immatriculation d'un dossier (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: ImmatriculationSerializer,
                              404: OpenApiResponse(description="Non immatriculé")})
    def get(self, request, dossier_id):
        dossier = get_object_or_404(Dossier, pk=dossier_id)
        user = request.user
        if user.role not in STAFF_ROLES and dossier.usager_id != user.id:
            raise NotFound()
        immat = get_object_or_404(Immatriculation, vehicule=dossier.vehicule)
        return Response(ImmatriculationSerializer(immat).data)

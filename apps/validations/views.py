"""Endpoints de validation agent (étape 4)."""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAgentOrAdmin
from apps.dossiers.models import Dossier
from apps.dossiers.permissions import STAFF_ROLES

from .models import ValidationAgent
from .serializers import (
    ComplementSerializer,
    CommentaireSerializer,
    MotifSerializer,
    ValidationAgentSerializer,
)
from .services import demander_complement, rejeter_dossier, valider_dossier


class _ActionValidationView(APIView):
    """Base commune aux actions agent sur un dossier."""

    permission_classes = [IsAuthenticated, IsAgentOrAdmin]
    serializer_class = CommentaireSerializer

    def _dossier(self, dossier_id):
        return get_object_or_404(Dossier, pk=dossier_id)

    def _reponse(self, ok, message, decision):
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "message": message,
            "statut": self.dossier.statut,
            "decision": ValidationAgentSerializer(decision).data,
        })


class ValiderView(_ActionValidationView):
    serializer_class = CommentaireSerializer

    @extend_schema(request=CommentaireSerializer,
                   responses={200: OpenApiResponse(description="Dossier validé")})
    def post(self, request, dossier_id):
        self.dossier = self._dossier(dossier_id)
        s = CommentaireSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ok, message, decision = valider_dossier(
            self.dossier, request.user, s.validated_data["commentaire"], request=request)
        return self._reponse(ok, message, decision)


class RejeterView(_ActionValidationView):
    serializer_class = MotifSerializer

    @extend_schema(request=MotifSerializer,
                   responses={200: OpenApiResponse(description="Dossier rejeté"),
                              400: OpenApiResponse(description="Motif manquant ou statut invalide")})
    def post(self, request, dossier_id):
        self.dossier = self._dossier(dossier_id)
        s = MotifSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ok, message, decision = rejeter_dossier(
            self.dossier, request.user, s.validated_data["motif"], request=request)
        return self._reponse(ok, message, decision)


class DemanderComplementView(_ActionValidationView):
    serializer_class = ComplementSerializer

    @extend_schema(request=ComplementSerializer,
                   responses={200: OpenApiResponse(description="Demande envoyée")})
    def post(self, request, dossier_id):
        self.dossier = self._dossier(dossier_id)
        s = ComplementSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ok, message, decision = demander_complement(
            self.dossier, request.user, s.validated_data["commentaire"], request=request)
        return self._reponse(ok, message, decision)


class HistoriqueView(ListAPIView):
    """Historique des décisions d'un dossier (propriétaire ou staff)."""

    serializer_class = ValidationAgentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        dossier = get_object_or_404(Dossier, pk=self.kwargs["dossier_id"])
        user = self.request.user
        if user.role not in STAFF_ROLES and dossier.usager_id != user.id:
            raise NotFound()
        return ValidationAgent.objects.filter(dossier=dossier).select_related("agent")

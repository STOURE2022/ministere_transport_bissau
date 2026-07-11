"""Endpoints des signalements (déclaration, liste, levée)."""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdmin, IsStaffRole, PeutDeclarerSignalement

from .models import Signalement, StatutSignalement
from .serializers import LeverSerializer, SignalementSerializer, SignalerSerializer
from .services import (
    lever_signalement,
    signaler_vehicule,
    trouver_vehicule,
    usager_possede_vehicule,
)


class SignalementListCreateView(APIView):
    """
    - GET  : liste des signalements actifs (personnel : agent / forces de l'ordre / admin).
    - POST : déclaration d'un véhicule volé/recherché. Ouverte à l'usager (son propre
      véhicule) et aux agents/admin. Les forces de l'ordre ne déclarent pas ; elles
      découvrent l'alerte lors d'un contrôle.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), PeutDeclarerSignalement()]
        return [IsAuthenticated(), IsStaffRole()]

    @extend_schema(responses={200: SignalementSerializer(many=True)})
    def get(self, request):
        qs = Signalement.objects.select_related("vehicule", "signale_par")
        if statut := request.query_params.get("statut"):
            qs = qs.filter(statut=statut)
        else:
            qs = qs.filter(statut=StatutSignalement.ACTIF)
        return Response(SignalementSerializer(qs[:200], many=True).data)

    @extend_schema(request=SignalerSerializer,
                   responses={201: SignalementSerializer,
                              400: OpenApiResponse(description="Véhicule introuvable ou déjà signalé")})
    def post(self, request):
        s = SignalerSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        vehicule = trouver_vehicule(
            immatriculation=data["immatriculation"], vin=data["vin"])
        if vehicule is None:
            return Response({"detail": "Aucun véhicule ne correspond à cette immatriculation / ce VIN."},
                            status=status.HTTP_400_BAD_REQUEST)
        # Un usager ne peut signaler que son propre véhicule.
        if request.user.role == "USAGER" and not usager_possede_vehicule(request.user, vehicule):
            return Response({"detail": "Vous ne pouvez déclarer que l'un de vos propres véhicules."},
                            status=status.HTTP_403_FORBIDDEN)
        ok, message, signalement = signaler_vehicule(
            vehicule, request.user, type=data["type"], reference=data["reference"],
            motif=data["motif"], request=request)
        code = status.HTTP_201_CREATED if ok else status.HTTP_400_BAD_REQUEST
        payload = SignalementSerializer(signalement).data if signalement else {}
        payload["message"] = message
        return Response(payload, status=code)


class SignalementLeverView(APIView):
    """Levée d'un signalement (administrateur)."""

    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(request=LeverSerializer, responses={200: OpenApiResponse(description="Signalement levé")})
    def post(self, request, pk):
        signalement = get_object_or_404(Signalement, pk=pk)
        s = LeverSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ok, message = lever_signalement(signalement, request.user, s.validated_data["motif"],
                                        request=request)
        code = status.HTTP_200_OK if ok else status.HTTP_400_BAD_REQUEST
        return Response({"message": message, "statut": signalement.statut}, status=code)

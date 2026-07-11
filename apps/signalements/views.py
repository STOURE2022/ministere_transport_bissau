"""Endpoints des signalements (déclaration, liste, levée)."""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import IsAdmin, IsStaffRole

from .models import Signalement, StatutSignalement
from .serializers import LeverSerializer, SignalementSerializer, SignalerSerializer
from .services import lever_signalement, signaler_vehicule, trouver_vehicule


class SignalementListCreateView(APIView):
    """Liste des signalements et déclaration d'un nouveau (personnel autorisé)."""

    permission_classes = [IsAuthenticated, IsStaffRole]

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

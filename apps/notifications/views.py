"""Endpoints des notifications, échéances et préférences (usager connecté)."""
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, PreferencesNotification
from .serializers import (
    EcheanceSerializer,
    NotificationSerializer,
    PreferencesSerializer,
)
from .services import compter_non_lues, echeances_pour


class NotificationListView(ListAPIView):
    """Fil des notifications de l'utilisateur connecté. Filtre `?filtre=non_lues|alertes`."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(destinataire=self.request.user)
        filtre = self.request.query_params.get("filtre")
        if filtre == "non_lues":
            qs = qs.filter(lu=False)
        elif filtre == "alertes":
            qs = qs.filter(niveau="ALERTE")
        return qs


class CompteurNonLuesView(APIView):
    """Nombre de notifications non lues (pour la pastille de la cloche)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: OpenApiResponse(description="{ non_lues, alertes }")})
    def get(self, request):
        base = Notification.objects.filter(destinataire=request.user)
        return Response({
            "non_lues": base.filter(lu=False).count(),
            "alertes": base.filter(lu=False, niveau="ALERTE").count(),
        })


class MarquerLuView(APIView):
    """Marque une notification comme lue (ou non lue avec ?lu=false)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: NotificationSerializer})
    def post(self, request, pk):
        notif = Notification.objects.filter(destinataire=request.user, pk=pk).first()
        if notif is None:
            return Response({"detail": "Introuvable."}, status=status.HTTP_404_NOT_FOUND)
        notif.lu = request.query_params.get("lu", "true").lower() != "false"
        notif.save(update_fields=["lu", "date_maj"])
        return Response(NotificationSerializer(notif).data)


class MarquerToutLuView(APIView):
    """Marque toutes les notifications de l'usager comme lues."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: OpenApiResponse(description="{ modifiees }")})
    def post(self, request):
        n = Notification.objects.filter(destinataire=request.user, lu=False).update(lu=True)
        return Response({"modifiees": n})


class EcheancesView(APIView):
    """Prochaines échéances de l'usager (assurance, contrôle technique, certificat)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: EcheanceSerializer(many=True)})
    def get(self, request):
        return Response(EcheanceSerializer(echeances_pour(request.user), many=True).data)


class PreferencesView(APIView):
    """Consultation et mise à jour des préférences de notification."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PreferencesSerializer})
    def get(self, request):
        prefs = PreferencesNotification.pour(request.user)
        return Response(PreferencesSerializer(prefs).data)

    @extend_schema(request=PreferencesSerializer, responses={200: PreferencesSerializer})
    def put(self, request):
        prefs = PreferencesNotification.pour(request.user)
        s = PreferencesSerializer(prefs, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

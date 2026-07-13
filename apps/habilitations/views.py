"""Endpoints des habilitations : inscription, file de validation, gestion des corps."""
import mimetypes

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import FileResponse, Http404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import OTPCanal
from apps.accounts.serializers import UserSerializer
from apps.accounts.services import creer_et_envoyer_otp
from apps.core.permissions import IsAdmin, IsAgentOrAdmin
from apps.core.services import log_action

from .models import CorpsControle, DemandeHabilitation, StatutHabilitation
from .serializers import (
    CorpsControleSerializer,
    DemandeHabilitationSerializer,
    InscriptionControleSerializer,
    RejetHabilitationSerializer,
    ResoumettreHabilitationSerializer,
)
from .services import (
    corps_actifs,
    creer_demande_habilitation,
    habilitation_stats,
    rejeter_habilitation,
    valider_habilitation,
)

User = get_user_model()


# ── Public : corps proposés + inscription ──
class CorpsActifsView(generics.ListAPIView):
    """Liste publique des corps de contrôle proposés à l'inscription."""

    serializer_class = CorpsControleSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return corps_actifs()


class InscriptionControleView(APIView):
    """Auto-inscription d'un agent de contrôle → compte en attente + code SMS."""

    permission_classes = [AllowAny]
    throttle_scope = "register"

    @extend_schema(
        request=InscriptionControleSerializer,
        responses={201: OpenApiResponse(description="Demande déposée, compte à vérifier par OTP.")},
    )
    def post(self, request):
        serializer = InscriptionControleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        creer_et_envoyer_otp(user, canal=OTPCanal.SMS)
        log_action("COMPTE_CREE", user=user, objet=user, request=request,
                   canal="SMS", role="FORCE_ORDRE")
        log_action("HABILITATION_DEMANDEE", user=user, objet=user, request=request,
                   reference=user.habilitation.reference)
        return Response(
            {
                "message": "Demande déposée. Un code de vérification a été envoyé par SMS.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ResoumettreHabilitationView(APIView):
    """Un compte de contrôle refusé dépose une nouvelle demande (repasse en attente)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=ResoumettreHabilitationSerializer,
        responses={200: OpenApiResponse(description="Demande resoumise, de nouveau en attente.")},
    )
    def post(self, request):
        user = request.user
        if user.role != "FORCE_ORDRE":
            return Response({"detail": "Réservé aux comptes de corps de contrôle."},
                            status=status.HTTP_403_FORBIDDEN)
        demande = getattr(user, "habilitation", None)
        if demande is None or demande.statut != StatutHabilitation.REJETE:
            return Response({"detail": "Aucune demande refusée à resoumettre."},
                            status=status.HTTP_400_BAD_REQUEST)
        serializer = ResoumettreHabilitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        creer_demande_habilitation(
            user, d["corps"], matricule=d["matricule"], justificatif=d["justificatif"],
            grade=d.get("grade", ""), unite=d.get("unite", ""), region=d.get("region", ""),
        )
        # Recharge le compte pour renvoyer l'habilitation à jour (relation 1-1 recréée).
        fresh = User.objects.select_related("habilitation__corps").get(pk=user.pk)
        log_action("HABILITATION_RESOUMISE", user=user, objet=user, request=request,
                   reference=fresh.habilitation.reference)
        return Response(
            {"message": "Demande resoumise.", "user": UserSerializer(fresh).data},
            status=status.HTTP_200_OK,
        )


# ── Staff : file de validation ──
class HabilitationListView(generics.ListAPIView):
    """Demandes d'habilitation (agents et administrateurs)."""

    serializer_class = DemandeHabilitationSerializer
    permission_classes = [IsAgentOrAdmin]

    def get_queryset(self):
        qs = (
            DemandeHabilitation.objects
            .select_related("corps", "user", "decide_par")
            .all()
        )
        statut = self.request.query_params.get("statut")
        if statut in StatutHabilitation.values:
            qs = qs.filter(statut=statut)
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(
                Q(reference__icontains=q) | Q(matricule__icontains=q)
                | Q(user__nom__icontains=q) | Q(user__prenom__icontains=q)
                | Q(corps__nom__icontains=q)
            )
        return qs


class HabilitationStatsView(APIView):
    permission_classes = [IsAgentOrAdmin]

    def get(self, request):
        return Response(habilitation_stats())


class HabilitationDetailView(generics.RetrieveAPIView):
    serializer_class = DemandeHabilitationSerializer
    permission_classes = [IsAgentOrAdmin]
    queryset = DemandeHabilitation.objects.select_related("corps", "user", "decide_par")


class HabilitationJustificatifView(APIView):
    """Consultation de la pièce justificative (média non servi publiquement en prod)."""

    permission_classes = [IsAgentOrAdmin]

    def get(self, request, pk):
        demande = DemandeHabilitation.objects.filter(pk=pk).first()
        if demande is None or not demande.justificatif:
            raise Http404("Pièce introuvable.")
        fichier = demande.justificatif
        content_type = mimetypes.guess_type(fichier.name)[0] or "application/octet-stream"
        return FileResponse(fichier.open("rb"), content_type=content_type)


class HabilitationValiderView(APIView):
    permission_classes = [IsAgentOrAdmin]

    def post(self, request, pk):
        demande = DemandeHabilitation.objects.filter(pk=pk).first()
        if demande is None:
            raise Http404("Demande introuvable.")
        valider_habilitation(demande, request.user, request=request)
        return Response(DemandeHabilitationSerializer(demande).data)


class HabilitationRejeterView(APIView):
    permission_classes = [IsAgentOrAdmin]

    @extend_schema(request=RejetHabilitationSerializer, responses={200: DemandeHabilitationSerializer})
    def post(self, request, pk):
        demande = DemandeHabilitation.objects.filter(pk=pk).first()
        if demande is None:
            raise Http404("Demande introuvable.")
        serializer = RejetHabilitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rejeter_habilitation(demande, request.user, serializer.validated_data["motif"], request=request)
        return Response(DemandeHabilitationSerializer(demande).data)


# ── Admin : gestion des corps de contrôle ──
class CorpsAdminListView(generics.ListCreateAPIView):
    """Tous les corps (agents en lecture, admin en écriture)."""

    serializer_class = CorpsControleSerializer

    def get_permissions(self):
        return [IsAdmin()] if self.request.method == "POST" else [IsAgentOrAdmin()]

    def get_queryset(self):
        return CorpsControle.objects.annotate(nb_membres=Count("demandes"))


class CorpsAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CorpsControleSerializer
    queryset = CorpsControle.objects.all()

    def get_permissions(self):
        return [IsAgentOrAdmin()] if self.request.method in ("GET", "HEAD") else [IsAdmin()]

"""Endpoints infractions : barème (admin), verbalisation (staff), règlement, quittance."""
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
from apps.dossiers.permissions import STAFF_ROLES
from apps.immatriculations.models import Immatriculation

from .models import Infraction, TypeInfraction
from .serializers import (
    DresserPVSerializer,
    InfractionSerializer,
    MotifSerializer,
    PayerAmendeSerializer,
    TypeInfractionSerializer,
)
from .services import (
    annuler_infraction,
    contester_infraction,
    dresser_infraction,
    infraction_stats,
    payer_infraction,
    rejeter_contestation,
    types_actifs,
)


def _est_staff(user) -> bool:
    return user.role in STAFF_ROLES or user.role == "FORCE_ORDRE"


def _est_proprietaire(user, infraction) -> bool:
    return infraction.vehicule.proprietaire_id == user.id


def _resoudre_vehicule(immatriculation):
    immat = (
        Immatriculation.objects
        .select_related("vehicule", "vehicule__proprietaire")
        .filter(numero__iexact=(immatriculation or "").strip())
        .first()
    )
    return immat.vehicule if immat else None


class TypeInfractionListCreateView(ListAPIView):
    """Barème des infractions : lecture (auth) et création (admin)."""

    serializer_class = TypeInfractionSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return TypeInfraction.objects.all()

    @extend_schema(request=TypeInfractionSerializer, responses={201: TypeInfractionSerializer})
    def post(self, request):
        s = TypeInfractionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data, status=status.HTTP_201_CREATED)


class TypeInfractionDetailView(APIView):
    """Mise à jour / suppression d'un type d'infraction (administration)."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        t = get_object_or_404(TypeInfraction, pk=pk)
        s = TypeInfractionSerializer(t, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    def delete(self, request, pk):
        t = get_object_or_404(TypeInfraction, pk=pk)
        t.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CibleView(APIView):
    """Résout un véhicule par sa plaque pour pré-remplir un PV (staff)."""

    permission_classes = [IsAuthenticated, IsStaffRole]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        vehicule = _resoudre_vehicule(request.query_params.get("immatriculation"))
        if vehicule is None:
            return Response({"detail": "Aucun véhicule immatriculé pour cette plaque."},
                            status=status.HTTP_404_NOT_FOUND)
        immat = getattr(vehicule, "immatriculation", None)
        u = vehicule.proprietaire
        return Response({
            "vehicule_id": str(vehicule.id),
            "immatriculation": immat.numero if immat else None,
            "titulaire": f"{u.prenom} {u.nom}".strip() if u else "—",
            "marque": vehicule.marque,
            "modele": vehicule.modele,
            "annee": vehicule.annee,
            "types": TypeInfractionSerializer(types_actifs(), many=True).data,
        })


class InfractionListCreateView(ListAPIView):
    """
    Liste des infractions (staff = toutes, usager = les siennes) et verbalisation (staff).
    Filtres : ?statut= , ?type= (code), ?q= (référence / plaque / titulaire).
    """

    serializer_class = InfractionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Infraction.objects.select_related(
            "vehicule", "vehicule__proprietaire", "type_infraction", "dressee_par")
        if not _est_staff(user):
            qs = qs.filter(vehicule__proprietaire=user)
        params = self.request.query_params
        if statut := params.get("statut"):
            qs = qs.filter(statut=statut)
        if type_code := params.get("type"):
            qs = qs.filter(type_infraction__code=type_code)
        if q := params.get("q"):
            from django.db.models import Q
            qs = qs.filter(
                Q(reference__icontains=q)
                | Q(vehicule__immatriculation__numero__icontains=q)
                | Q(vehicule__proprietaire__nom__icontains=q)
                | Q(vehicule__proprietaire__prenom__icontains=q)
            )
        return qs

    @extend_schema(request=DresserPVSerializer, responses={201: InfractionSerializer})
    def post(self, request):
        if not _est_staff(request.user):
            return Response({"detail": "Seules les forces de l'ordre peuvent dresser un PV."},
                            status=status.HTTP_403_FORBIDDEN)
        s = DresserPVSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        vehicule = _resoudre_vehicule(s.validated_data["immatriculation"])
        if vehicule is None:
            return Response({"detail": "Aucun véhicule immatriculé pour cette plaque."},
                            status=status.HTTP_400_BAD_REQUEST)
        ok, message, infraction = dresser_infraction(
            vehicule, type_code=s.validated_data["type"],
            lieu=s.validated_data.get("lieu", ""),
            observations=s.validated_data.get("observations", ""),
            agent=request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        data = InfractionSerializer(infraction).data
        data["message"] = message
        return Response(data, status=status.HTTP_201_CREATED)


class InfractionStatsView(APIView):
    """Synthèse des infractions (staff) pour le tableau de bord."""

    permission_classes = [IsAuthenticated, IsStaffRole]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        return Response(infraction_stats())


class InfractionDetailView(APIView):
    """Détail d'une infraction (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        infraction = get_object_or_404(
            Infraction.objects.select_related("vehicule", "vehicule__proprietaire"), pk=pk)
        if not _est_staff(request.user) and not _est_proprietaire(request.user, infraction):
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)
        return Response(InfractionSerializer(infraction).data)


class PayerAmendeView(APIView):
    """Règlement d'une amende par mobile money (propriétaire du véhicule)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=PayerAmendeSerializer, responses={200: InfractionSerializer})
    def post(self, request, pk):
        infraction = get_object_or_404(
            Infraction.objects.select_related("vehicule", "vehicule__proprietaire"), pk=pk)
        if not _est_proprietaire(request.user, infraction):
            return Response({"detail": "Seul le titulaire du véhicule peut régler l'amende."},
                            status=status.HTTP_403_FORBIDDEN)
        s = PayerAmendeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ok, message, infraction = payer_infraction(
            infraction, operateur_code=s.validated_data["operateur"],
            numero=s.validated_data["numero"], user=request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        data = InfractionSerializer(infraction).data
        data["message"] = message
        return Response(data)


class ContesterView(APIView):
    """Contestation d'une amende (propriétaire du véhicule)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=MotifSerializer, responses={200: InfractionSerializer})
    def post(self, request, pk):
        infraction = get_object_or_404(
            Infraction.objects.select_related("vehicule", "vehicule__proprietaire"), pk=pk)
        if not _est_proprietaire(request.user, infraction):
            return Response({"detail": "Seul le titulaire du véhicule peut contester."},
                            status=status.HTTP_403_FORBIDDEN)
        s = MotifSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ok, message, infraction = contester_infraction(
            infraction, motif=s.validated_data.get("motif", ""), user=request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InfractionSerializer(infraction).data)


class AnnulerView(APIView):
    """Annulation d'une amende (administration)."""

    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(request=MotifSerializer, responses={200: InfractionSerializer})
    def post(self, request, pk):
        infraction = get_object_or_404(Infraction, pk=pk)
        s = MotifSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        ok, message, infraction = annuler_infraction(
            infraction, motif=s.validated_data.get("motif", ""), admin=request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InfractionSerializer(infraction).data)


class RejeterContestationView(APIView):
    """Rejet d'une contestation (administration) : l'amende redevient à régler."""

    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(responses={200: InfractionSerializer})
    def post(self, request, pk):
        infraction = get_object_or_404(Infraction, pk=pk)
        ok, message, infraction = rejeter_contestation(
            infraction, admin=request.user, request=request)
        if not ok:
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InfractionSerializer(infraction).data)


class QuittancePdfView(APIView):
    """Téléchargement de la quittance PDF (propriétaire ou staff)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        infraction = get_object_or_404(
            Infraction.objects.select_related("vehicule", "vehicule__proprietaire"), pk=pk)
        if not _est_staff(request.user) and not _est_proprietaire(request.user, infraction):
            return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)
        if not infraction.quittance_fichier:
            return Response({"detail": "Quittance indisponible."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            infraction.quittance_fichier.open("rb"), content_type="application/pdf",
            as_attachment=False, filename=f"quittance-{infraction.quittance_reference}.pdf")

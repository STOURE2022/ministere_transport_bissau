"""Serializers des signalements."""
from rest_framework import serializers

from .models import Signalement, TypeSignalement


class SignalementSerializer(serializers.ModelSerializer):
    type_libelle = serializers.CharField(source="get_type_display", read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    immatriculation = serializers.SerializerMethodField()
    vin = serializers.CharField(source="vehicule.vin", read_only=True)
    signale_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = Signalement
        fields = (
            "id", "type", "type_libelle", "statut", "statut_libelle", "reference", "motif",
            "immatriculation", "vin", "signale_par_nom", "date_signalement",
            "date_levee", "motif_levee",
        )
        read_only_fields = fields

    def get_immatriculation(self, obj) -> str | None:
        immat = getattr(obj.vehicule, "immatriculation", None)
        return immat.numero if immat else None

    def get_signale_par_nom(self, obj) -> str | None:
        if obj.signale_par is None:
            return None
        return f"{obj.signale_par.prenom} {obj.signale_par.nom}"


class AlerteSerializer(serializers.Serializer):
    """Alerte compacte injectée dans la réponse de vérification."""

    type = serializers.CharField()
    type_libelle = serializers.CharField()
    reference = serializers.CharField(allow_blank=True)
    motif = serializers.CharField(allow_blank=True)
    date_signalement = serializers.DateTimeField()


class SignalerSerializer(serializers.Serializer):
    """Déclaration d'un signalement par plaque ou VIN."""

    immatriculation = serializers.CharField(required=False, allow_blank=True, default="")
    vin = serializers.CharField(required=False, allow_blank=True, default="")
    type = serializers.ChoiceField(choices=TypeSignalement.choices, default=TypeSignalement.VOLE)
    reference = serializers.CharField(required=False, allow_blank=True, default="")
    motif = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs.get("immatriculation") and not attrs.get("vin"):
            raise serializers.ValidationError("Fournissez une immatriculation ou un VIN.")
        return attrs


class LeverSerializer(serializers.Serializer):
    motif = serializers.CharField(required=False, allow_blank=True, default="")


def alerte_payload(signalement) -> dict:
    """Construit le dict d'alerte à partir d'un Signalement actif."""
    return {
        "type": signalement.type,
        "type_libelle": signalement.get_type_display(),
        "reference": signalement.reference,
        "motif": signalement.motif,
        "date_signalement": signalement.date_signalement,
    }

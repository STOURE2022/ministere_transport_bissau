"""Serializers de l'app infractions."""
from rest_framework import serializers

from .models import Infraction, TypeInfraction


class TypeInfractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeInfraction
        fields = ("id", "libelle", "code", "montant", "actif", "ordre")
        read_only_fields = ("id",)


class InfractionSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    immatriculation = serializers.SerializerMethodField()
    vin = serializers.CharField(source="vehicule.vin", read_only=True)
    marque = serializers.CharField(source="vehicule.marque", read_only=True)
    modele = serializers.CharField(source="vehicule.modele", read_only=True)
    titulaire = serializers.SerializerMethodField()
    dressee_par_nom = serializers.SerializerMethodField()
    a_quittance = serializers.SerializerMethodField()

    class Meta:
        model = Infraction
        fields = (
            "id", "reference", "libelle", "montant", "devise", "lieu", "observations",
            "date_infraction", "statut", "statut_libelle", "motif_contestation",
            "motif_annulation", "operateur", "numero_telephone", "reference_transaction",
            "quittance_reference", "paye_le", "date_creation",
            "immatriculation", "vin", "marque", "modele", "titulaire",
            "dressee_par_nom", "a_quittance",
        )
        read_only_fields = fields

    def get_immatriculation(self, obj) -> str | None:
        immat = getattr(obj.vehicule, "immatriculation", None)
        return immat.numero if immat else None

    def get_titulaire(self, obj) -> str:
        u = obj.vehicule.proprietaire
        return f"{u.prenom} {u.nom}".strip() if u else "—"

    def get_dressee_par_nom(self, obj) -> str | None:
        u = obj.dressee_par
        return f"{u.prenom} {u.nom}".strip() if u else None

    def get_a_quittance(self, obj) -> bool:
        return bool(obj.quittance_fichier)


class DresserPVSerializer(serializers.Serializer):
    immatriculation = serializers.CharField()
    type = serializers.CharField(help_text="Code du type d'infraction (ex. EXCES_VITESSE)")
    lieu = serializers.CharField(required=False, allow_blank=True, default="")
    observations = serializers.CharField(required=False, allow_blank=True, default="")


class PayerAmendeSerializer(serializers.Serializer):
    operateur = serializers.CharField(help_text="Code de l'opérateur (ex. ORANGE)")
    numero = serializers.CharField()


class MotifSerializer(serializers.Serializer):
    motif = serializers.CharField(required=False, allow_blank=True, default="")

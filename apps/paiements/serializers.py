"""Serializers de l'app paiements."""
from rest_framework import serializers

from .models import ConfigurationPaiement, OperateurPaiement, Paiement


class OperateurPaiementSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperateurPaiement
        fields = ("id", "nom", "code", "code_ussd", "couleur", "actif", "ordre")
        read_only_fields = ("id",)


class ConfigurationPaiementSerializer(serializers.ModelSerializer):
    total = serializers.SerializerMethodField()
    lignes = serializers.SerializerMethodField()

    class Meta:
        model = ConfigurationPaiement
        fields = ("devise", "montant_taxe", "montant_timbre", "frais_service",
                  "paiement_requis", "total", "lignes")
        read_only_fields = ("total", "lignes")

    def get_total(self, obj) -> int:
        return obj.total()

    def get_lignes(self, obj) -> list:
        return obj.lignes()


class MontantSerializer(serializers.Serializer):
    """Ce que la page de paiement affiche : montant dû + opérateurs actifs."""

    devise = serializers.CharField()
    lignes = serializers.ListField()
    total = serializers.IntegerField()
    operateurs = OperateurPaiementSerializer(many=True)
    deja_paye = serializers.BooleanField()


class PaiementSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    numero_dossier = serializers.CharField(source="dossier.numero_dossier", read_only=True)
    immatriculation = serializers.SerializerMethodField()
    usager_nom = serializers.SerializerMethodField()
    a_recu = serializers.SerializerMethodField()

    class Meta:
        model = Paiement
        fields = (
            "id", "reference", "devise", "montant_total", "detail", "operateur",
            "code_ussd", "numero_telephone", "reference_transaction", "statut",
            "statut_libelle", "paye_le", "date_creation",
            "numero_dossier", "immatriculation", "usager_nom", "a_recu",
        )
        read_only_fields = fields

    def get_immatriculation(self, obj) -> str | None:
        immat = getattr(obj.dossier.vehicule, "immatriculation", None)
        return immat.numero if immat else None

    def get_usager_nom(self, obj) -> str:
        u = obj.dossier.usager
        return f"{u.prenom} {u.nom}".strip() if u else "—"

    def get_a_recu(self, obj) -> bool:
        return bool(obj.pdf_fichier)


class PayerSerializer(serializers.Serializer):
    operateur = serializers.CharField(help_text="Code de l'opérateur (ex. ORANGE)")
    numero = serializers.CharField()

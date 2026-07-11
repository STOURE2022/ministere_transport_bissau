"""Serializers de l'app vérifications."""
from rest_framework import serializers

from .models import VerificationAuto


class VerificationAutoSerializer(serializers.ModelSerializer):
    dossier_numero = serializers.CharField(source="dossier.numero_dossier", read_only=True)
    dossier_doublon_numero = serializers.CharField(
        source="dossier_doublon.numero_dossier", read_only=True, default=None,
    )
    niveau_risque_libelle = serializers.CharField(
        source="get_niveau_risque_display", read_only=True,
    )
    tout_conforme = serializers.BooleanField(read_only=True)

    class Meta:
        model = VerificationAuto
        fields = (
            "dossier", "dossier_numero", "vin_valide", "assurance_valide",
            "ct_valide", "doublon_detecte", "dossier_doublon", "dossier_doublon_numero",
            "score_fraude", "niveau_risque", "niveau_risque_libelle",
            "tout_conforme", "details", "date_maj",
        )
        read_only_fields = fields

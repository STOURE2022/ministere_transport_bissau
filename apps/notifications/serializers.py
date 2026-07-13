"""Serializers de l'app notifications."""
from rest_framework import serializers

from .models import DELAIS_RELANCE, Notification, PreferencesNotification


class NotificationSerializer(serializers.ModelSerializer):
    niveau_libelle = serializers.CharField(source="get_niveau_display", read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id", "niveau", "niveau_libelle", "categorie", "titre", "message",
            "lien", "cta_label", "lu", "date_creation",
        )
        read_only_fields = fields


class EcheanceSerializer(serializers.Serializer):
    """Échéance à venir (calculée en direct, non stockée)."""

    categorie = serializers.CharField()
    label = serializers.CharField()
    immatriculation = serializers.CharField(allow_null=True)
    echeance = serializers.DateField()
    jours_restants = serializers.IntegerField()
    niveau = serializers.CharField()
    lien = serializers.CharField()


class PreferencesSerializer(serializers.ModelSerializer):
    delais_disponibles = serializers.SerializerMethodField()

    class Meta:
        model = PreferencesNotification
        fields = ("canal_email", "canal_sms", "canal_push", "delais_relance", "delais_disponibles")
        read_only_fields = ("delais_disponibles",)

    def get_delais_disponibles(self, obj) -> list[int]:
        return list(DELAIS_RELANCE)

    def validate_delais_relance(self, valeur):
        if not isinstance(valeur, list):
            raise serializers.ValidationError("Une liste de jours est attendue.")
        nettoyes = sorted({int(v) for v in valeur if int(v) in DELAIS_RELANCE}, reverse=True)
        return nettoyes

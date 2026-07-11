"""Serializers de l'app validations (étape 4)."""
from rest_framework import serializers

from .models import ValidationAgent


class ValidationAgentSerializer(serializers.ModelSerializer):
    """Entrée d'historique des décisions (lecture)."""

    action_libelle = serializers.CharField(source="get_action_display", read_only=True)
    agent_nom = serializers.SerializerMethodField()

    class Meta:
        model = ValidationAgent
        fields = ("id", "action", "action_libelle", "agent", "agent_nom",
                  "commentaire", "date_creation")
        read_only_fields = fields

    def get_agent_nom(self, obj) -> str | None:
        if obj.agent is None:
            return None
        return f"{obj.agent.prenom} {obj.agent.nom}"


class CommentaireSerializer(serializers.Serializer):
    """Corps optionnel pour la validation."""

    commentaire = serializers.CharField(required=False, allow_blank=True, default="")


class MotifSerializer(serializers.Serializer):
    """Corps obligatoire pour le rejet."""

    motif = serializers.CharField()


class ComplementSerializer(serializers.Serializer):
    """Corps obligatoire pour une demande de complément."""

    commentaire = serializers.CharField()

"""Serializers de l'app immatriculations."""
from rest_framework import serializers

from .models import Immatriculation


class ImmatriculationSerializer(serializers.ModelSerializer):
    vehicule_uuid = serializers.UUIDField(source="vehicule_id", read_only=True)
    agent_nom = serializers.SerializerMethodField()

    class Meta:
        model = Immatriculation
        fields = ("numero", "serie_plaque", "vehicule_uuid", "agent_nom", "date_attribution")
        read_only_fields = fields

    def get_agent_nom(self, obj) -> str | None:
        if obj.agent is None:
            return None
        return f"{obj.agent.prenom} {obj.agent.nom}"

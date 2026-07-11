"""Serializers DRF de l'app dossiers."""
from rest_framework import serializers

from .models import Document, Dossier, Vehicule
from .services import calculer_hash_fichier
from .validators import extension_de, valider_fichier


class VehiculeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicule
        fields = (
            "id", "vin", "marque", "modele", "annee", "couleur",
            "energie", "type_vehicule",
        )
        read_only_fields = ("id",)

    def validate_vin(self, value):
        value = value.strip().upper()
        if len(value) != 17:
            raise serializers.ValidationError("Le VIN doit comporter exactement 17 caractères.")
        return value


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = (
            "id", "dossier", "type_document", "fichier", "format", "taille",
            "hash_fichier", "date_debut", "date_fin", "statut_verif", "date_creation",
        )
        read_only_fields = (
            "id", "dossier", "format", "taille", "hash_fichier",
            "statut_verif", "date_creation",
        )

    def validate_fichier(self, fichier):
        valider_fichier(fichier)
        return fichier

    def create(self, validated_data):
        fichier = validated_data["fichier"]
        validated_data["format"] = extension_de(fichier.name)
        validated_data["taille"] = fichier.size
        validated_data["hash_fichier"] = calculer_hash_fichier(fichier)
        return super().create(validated_data)


class DossierListSerializer(serializers.ModelSerializer):
    """Vue liste : résumé pour les tableaux (dashboard, suivi usager)."""

    vehicule = VehiculeSerializer(read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    nb_documents = serializers.IntegerField(source="documents.count", read_only=True)

    class Meta:
        model = Dossier
        fields = (
            "id", "numero_dossier", "statut", "statut_libelle", "vehicule",
            "nb_documents", "date_creation", "date_soumission",
        )


class DossierCreateSerializer(serializers.ModelSerializer):
    """Création d'un dossier avec son véhicule (imbriqué)."""

    vehicule = VehiculeSerializer()

    class Meta:
        model = Dossier
        fields = ("id", "numero_dossier", "statut", "vehicule")
        read_only_fields = ("id", "numero_dossier", "statut")

    def create(self, validated_data):
        vehicule_data = validated_data.pop("vehicule")
        usager = self.context["request"].user
        vehicule = Vehicule.objects.create(proprietaire=usager, **vehicule_data)
        # numero_dossier et usager sont fixés dans la vue (perform_create).
        return Dossier.objects.create(usager=usager, vehicule=vehicule, **validated_data)

    def update(self, instance, validated_data):
        # Mise à jour des caractéristiques du véhicule (dossier au stade brouillon).
        vehicule_data = validated_data.pop("vehicule", None)
        if vehicule_data:
            for champ, valeur in vehicule_data.items():
                setattr(instance.vehicule, champ, valeur)
            instance.vehicule.save()
        return super().update(instance, validated_data)


class DossierDetailSerializer(serializers.ModelSerializer):
    """Vue détail : véhicule + pièces + pièces obligatoires manquantes."""

    vehicule = VehiculeSerializer(read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    documents_requis_manquants = serializers.SerializerMethodField()

    class Meta:
        model = Dossier
        fields = (
            "id", "numero_dossier", "statut", "statut_libelle", "motif_rejet",
            "vehicule", "documents", "documents_requis_manquants",
            "date_creation", "date_soumission",
        )
        read_only_fields = fields

    def get_documents_requis_manquants(self, obj) -> list[str]:
        return obj.documents_requis_manquants()

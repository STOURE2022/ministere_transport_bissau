"""Serializers de l'app habilitations."""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import CorpsControle, DemandeHabilitation
from .services import corps_actifs, creer_demande_habilitation

User = get_user_model()


class CorpsControleSerializer(serializers.ModelSerializer):
    """Corps de contrôle (lecture + gestion admin)."""

    nb_membres = serializers.SerializerMethodField()

    class Meta:
        model = CorpsControle
        fields = ("id", "nom", "nom_court", "code", "sigle", "couleur", "actif", "ordre", "nb_membres")
        read_only_fields = ("id", "nb_membres")

    def get_nb_membres(self, obj) -> int:
        return getattr(obj, "nb_membres", None) if hasattr(obj, "nb_membres") else obj.demandes.count()


class InscriptionControleSerializer(serializers.Serializer):
    """Auto-inscription d'un membre d'un corps de contrôle (multipart)."""

    prenom = serializers.CharField(max_length=100)
    nom = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    telephone = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirmation")

    corps = serializers.SlugRelatedField(slug_field="code", queryset=CorpsControle.objects.all())
    matricule = serializers.CharField(max_length=40)
    grade = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    unite = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    region = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    justificatif = serializers.FileField()

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet e-mail.")
        return value

    def validate_telephone(self, value):
        if User.objects.filter(telephone=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec ce téléphone.")
        return value

    def validate_corps(self, value):
        if not value.actif:
            raise serializers.ValidationError("Ce corps de contrôle n'est plus proposé.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Les mots de passe ne correspondent pas."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        corps = validated_data.pop("corps")
        user = User(
            email=validated_data["email"], telephone=validated_data["telephone"],
            nom=validated_data["nom"], prenom=validated_data["prenom"],
            role="FORCE_ORDRE", is_active=False,
        )
        user.set_password(password)
        user.save()
        creer_demande_habilitation(
            user, corps,
            matricule=validated_data["matricule"],
            justificatif=validated_data["justificatif"],
            grade=validated_data.get("grade", ""),
            unite=validated_data.get("unite", ""),
            region=validated_data.get("region", ""),
        )
        return user


class DemandeHabilitationSerializer(serializers.ModelSerializer):
    """Demande d'habilitation vue par l'agent (liste + détail)."""

    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    corps_nom = serializers.CharField(source="corps.nom", read_only=True)
    corps_sigle = serializers.CharField(source="corps.sigle", read_only=True)
    corps_couleur = serializers.CharField(source="corps.couleur", read_only=True)
    nom = serializers.CharField(source="user.nom", read_only=True)
    prenom = serializers.CharField(source="user.prenom", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    telephone = serializers.CharField(source="user.telephone", read_only=True)
    decide_par_nom = serializers.SerializerMethodField()
    a_justificatif = serializers.SerializerMethodField()

    class Meta:
        model = DemandeHabilitation
        fields = (
            "id", "reference", "statut", "statut_libelle",
            "corps", "corps_nom", "corps_sigle", "corps_couleur",
            "nom", "prenom", "email", "telephone",
            "matricule", "grade", "unite", "region",
            "motif_decision", "decide_par_nom", "decide_le",
            "a_justificatif", "date_creation",
        )

    def get_decide_par_nom(self, obj):
        return f"{obj.decide_par.prenom} {obj.decide_par.nom}" if obj.decide_par else None

    def get_a_justificatif(self, obj) -> bool:
        return bool(obj.justificatif)


class RejetHabilitationSerializer(serializers.Serializer):
    motif = serializers.CharField(max_length=500)

    def validate_motif(self, value):
        if not value.strip():
            raise serializers.ValidationError("Le motif du refus est obligatoire.")
        return value.strip()


class ResoumettreHabilitationSerializer(serializers.Serializer):
    """Nouvelle demande d'un compte de contrôle dont la précédente a été refusée."""

    corps = serializers.SlugRelatedField(slug_field="code", queryset=CorpsControle.objects.all())
    matricule = serializers.CharField(max_length=40)
    grade = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    unite = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    region = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    justificatif = serializers.FileField()

    def validate_corps(self, value):
        if not value.actif:
            raise serializers.ValidationError("Ce corps de contrôle n'est plus proposé.")
        return value

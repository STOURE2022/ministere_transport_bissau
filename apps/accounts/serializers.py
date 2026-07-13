"""Serializers DRF de l'app comptes."""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import OTPCanal, User


class RegisterSerializer(serializers.ModelSerializer):
    """Création d'un compte usager (le compte reste inactif jusqu'à l'OTP)."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirmation")

    class Meta:
        model = User
        fields = ("id", "email", "telephone", "nom", "prenom", "password", "password2")
        read_only_fields = ("id",)

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Les mots de passe ne correspondent pas."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        # Un compte créé par ce flux est toujours un USAGER, inactif au départ.
        user = User(role="USAGER", is_active=False, **validated_data)
        user.set_password(password)
        user.save()
        return user


class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=12)
    canal = serializers.ChoiceField(choices=OTPCanal.choices, default=OTPCanal.SMS)


class OTPResendSerializer(serializers.Serializer):
    email = serializers.EmailField()
    canal = serializers.ChoiceField(choices=OTPCanal.choices, default=OTPCanal.SMS)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(help_text="Refresh token à blacklister.")


class UserSerializer(serializers.ModelSerializer):
    """Profil utilisateur (lecture / mise à jour partielle)."""

    habilitation = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "email", "telephone", "nom", "prenom", "role",
            "is_email_verifie", "is_telephone_verifie", "is_active",
            "date_creation", "habilitation",
        )
        read_only_fields = (
            "id", "email", "role", "is_email_verifie",
            "is_telephone_verifie", "is_active", "date_creation", "habilitation",
        )

    def get_habilitation(self, obj):
        """État d'habilitation d'un compte force de l'ordre (None sinon)."""
        demande = getattr(obj, "habilitation", None)
        if demande is None:
            return None
        return {
            "statut": demande.statut,
            "statut_libelle": demande.get_statut_display(),
            "corps": demande.corps.nom if demande.corps_id else "",
            "reference": demande.reference,
            "motif_decision": demande.motif_decision,
        }


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT enrichi : ajoute le rôle et l'identité dans le token et la réponse."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["nom"] = user.nom
        token["prenom"] = user.prenom
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Un compte non vérifié ne peut pas se connecter.
        if not self.user.is_active:
            raise serializers.ValidationError(
                "Compte non activé. Vérifiez votre e-mail ou téléphone via le code reçu."
            )
        data["user"] = UserSerializer(self.user).data
        return data

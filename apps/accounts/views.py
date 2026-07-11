"""Endpoints de l'app comptes (étape 1 du processus métier)."""
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.core.services import log_action

from .models import OTPCanal
from .serializers import (
    CustomTokenObtainPairSerializer,
    LogoutSerializer,
    OTPResendSerializer,
    OTPVerifySerializer,
    RegisterSerializer,
    UserSerializer,
)
from .services import creer_et_envoyer_otp, verifier_otp

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """Création de compte usager + envoi du code de vérification (SMS)."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_scope = "register"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        creer_et_envoyer_otp(user, canal=OTPCanal.SMS)
        log_action("COMPTE_CREE", user=user, objet=user, request=request, canal="SMS")

        return Response(
            {
                "message": "Compte créé. Un code de vérification a été envoyé par SMS.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyOTPView(APIView):
    """Validation du code OTP → active le compte."""

    permission_classes = [AllowAny]
    throttle_scope = "otp"

    @extend_schema(
        request=OTPVerifySerializer,
        responses={200: OpenApiResponse(description="Compte vérifié"),
                   400: OpenApiResponse(description="Code invalide ou expiré")},
    )
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User.objects.filter(email=data["email"]).first()
        if user is None:
            return Response({"detail": "Compte introuvable."}, status=status.HTTP_404_NOT_FOUND)

        ok, message = verifier_otp(user, data["code"], canal=data["canal"])
        if not ok:
            log_action("OTP_ECHEC", user=user, objet=user, request=request, canal=data["canal"])
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        log_action("COMPTE_VERIFIE", user=user, objet=user, request=request, canal=data["canal"])
        return Response({"message": message, "user": UserSerializer(user).data})


class ResendOTPView(APIView):
    """Renvoi d'un nouveau code de vérification."""

    permission_classes = [AllowAny]
    throttle_scope = "otp"

    @extend_schema(request=OTPResendSerializer, responses={200: OpenApiResponse(description="Code renvoyé")})
    def post(self, request):
        serializer = OTPResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User.objects.filter(email=data["email"]).first()
        # Réponse volontairement identique que le compte existe ou non (anti-énumération).
        if user and not user.is_active:
            creer_et_envoyer_otp(user, canal=data["canal"])
            log_action("OTP_RENVOYE", user=user, objet=user, request=request, canal=data["canal"])

        return Response({"message": "Si le compte existe et n'est pas activé, un nouveau code a été envoyé."})


class LoginView(TokenObtainPairView):
    """Connexion → access + refresh JWT (avec le rôle dans le token)."""

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        email = request.data.get("email")
        user = User.objects.filter(email=email).first()
        if user:
            log_action("CONNEXION", user=user, objet=user, request=request)
        return response


class LogoutView(APIView):
    """Déconnexion : blackliste le refresh token fourni."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=LogoutSerializer, responses={205: OpenApiResponse(description="Déconnecté")})
    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response({"detail": "Le refresh token est requis."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh).blacklist()
        except Exception:
            return Response({"detail": "Token invalide."}, status=status.HTTP_400_BAD_REQUEST)
        log_action("DECONNEXION", user=request.user, objet=request.user, request=request)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    """Profil de l'utilisateur connecté (GET / PATCH)."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

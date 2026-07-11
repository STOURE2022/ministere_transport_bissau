"""Modèles de l'app comptes : User personnalisé + code OTP."""
import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class Role(models.TextChoices):
    USAGER = "USAGER", "Usager"
    AGENT = "AGENT", "Agent validateur"
    FORCE_ORDRE = "FORCE_ORDRE", "Force de l'ordre"
    ADMIN = "ADMIN", "Administrateur"


class User(AbstractBaseUser, PermissionsMixin):
    """
    Utilisateur unique différencié par `role`.
    Connexion par e-mail ; téléphone et e-mail vérifiables par OTP.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField("Adresse e-mail", unique=True)
    telephone = models.CharField(
        "Téléphone", max_length=20, unique=True,
        help_text="Format international, ex : +245955123456",
    )
    nom = models.CharField("Nom", max_length=100)
    prenom = models.CharField("Prénom", max_length=100)
    role = models.CharField("Rôle", max_length=16, choices=Role.choices, default=Role.USAGER)

    is_email_verifie = models.BooleanField("E-mail vérifié", default=False)
    is_telephone_verifie = models.BooleanField("Téléphone vérifié", default=False)

    is_active = models.BooleanField("Actif", default=False)  # activé après vérification OTP
    is_staff = models.BooleanField("Accès admin Django", default=False)

    date_creation = models.DateTimeField("Créé le", auto_now_add=True)
    date_maj = models.DateTimeField("Modifié le", auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["telephone", "nom", "prenom"]

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.prenom} {self.nom} <{self.email}> ({self.role})"

    @property
    def is_verifie(self) -> bool:
        """Le compte est vérifié si l'un des canaux (e-mail/SMS) est confirmé."""
        return self.is_email_verifie or self.is_telephone_verifie


class OTPCanal(models.TextChoices):
    SMS = "SMS", "SMS"
    EMAIL = "EMAIL", "E-mail"


class OTPCode(models.Model):
    """
    Code à usage unique pour la vérification de compte.
    Le code n'est jamais stocké en clair — seul son hash est conservé.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="codes_otp")
    canal = models.CharField(max_length=8, choices=OTPCanal.choices)
    code_hash = models.CharField(max_length=128)
    tentatives = models.PositiveSmallIntegerField(default=0)
    consomme = models.BooleanField(default=False)
    expire_le = models.DateTimeField()
    date_creation = models.DateTimeField(auto_now_add=True)

    MAX_TENTATIVES = 5

    class Meta:
        verbose_name = "Code OTP"
        verbose_name_plural = "Codes OTP"
        ordering = ["-date_creation"]
        indexes = [models.Index(fields=["user", "consomme"])]

    def __str__(self):
        return f"OTP {self.canal} — {self.user.email} ({'consommé' if self.consomme else 'actif'})"

    @property
    def est_expire(self) -> bool:
        return timezone.now() >= self.expire_le

    @property
    def est_valide(self) -> bool:
        return (
            not self.consomme
            and not self.est_expire
            and self.tentatives < self.MAX_TENTATIVES
        )

"""
Inscription et habilitation des corps de contrôle (forces de l'ordre).

Un membre d'un corps de contrôle s'inscrit lui-même en choisissant son corps
d'appartenance et en joignant une pièce justificative. Son compte reste **en
attente** tant qu'un agent SNICV (ou un administrateur) n'a pas validé la
demande. Les corps sont **éditables depuis le tableau de bord admin** — rien
n'est codé en dur.
"""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class CorpsControle(TimeStampedModel):
    """Corps de contrôle habilité (Police de la circulation, Garde Nationale…)."""

    nom = models.CharField("Nom", max_length=80)
    nom_court = models.CharField("Nom court", max_length=40, blank=True, default="")
    code = models.CharField("Code", max_length=24, unique=True, help_text="Ex. CIRCULATION, GARDE_NAT")
    sigle = models.CharField("Sigle", max_length=4, help_text="Badge court, ex. PT, GN")
    couleur = models.CharField("Couleur (hex)", max_length=9, default="#0d2748")
    actif = models.BooleanField("Actif", default=True)
    ordre = models.PositiveSmallIntegerField("Ordre d'affichage", default=0)

    class Meta:
        verbose_name = "Corps de contrôle"
        verbose_name_plural = "Corps de contrôle"
        ordering = ["ordre", "nom"]

    def __str__(self):
        return self.nom


class StatutHabilitation(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente"
    VALIDE = "VALIDE", "Validée"
    REJETE = "REJETE", "Rejetée"


class DemandeHabilitation(TimeStampedModel):
    """
    Demande d'accès d'un membre d'un corps de contrôle.

    Reliée 1-1 au compte utilisateur (rôle FORCE_ORDRE). Tant que le statut
    n'est pas VALIDE, le compte ne peut pas accéder aux fonctions de contrôle.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="habilitation", verbose_name="Compte",
    )
    corps = models.ForeignKey(
        CorpsControle, on_delete=models.PROTECT,
        related_name="demandes", verbose_name="Corps",
    )
    reference = models.CharField("Référence", max_length=24, unique=True, editable=False)
    matricule = models.CharField("Matricule / N° de service", max_length=40)
    grade = models.CharField("Grade", max_length=60, blank=True, default="")
    unite = models.CharField("Unité / Brigade", max_length=100, blank=True, default="")
    region = models.CharField("Région", max_length=60, blank=True, default="")
    justificatif = models.FileField(
        "Pièce justificative", upload_to="habilitations/",
        help_text="Carte professionnelle ou ordre de mission.",
    )
    statut = models.CharField(
        "Statut", max_length=12, choices=StatutHabilitation.choices,
        default=StatutHabilitation.EN_ATTENTE, db_index=True,
    )
    motif_decision = models.TextField("Motif de la décision", blank=True, default="")
    decide_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="habilitations_traitees", verbose_name="Décidée par",
    )
    decide_le = models.DateTimeField("Décidée le", null=True, blank=True)

    class Meta:
        verbose_name = "Demande d'habilitation"
        verbose_name_plural = "Demandes d'habilitation"
        ordering = ["-date_creation"]
        indexes = [models.Index(fields=["statut", "date_creation"])]

    def __str__(self):
        return f"{self.reference} — {self.user.prenom} {self.user.nom} ({self.get_statut_display()})"

    @property
    def est_validee(self) -> bool:
        return self.statut == StatutHabilitation.VALIDE

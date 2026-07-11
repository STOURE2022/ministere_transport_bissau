"""Modèle de l'étape 4 : historique des décisions des agents sur les dossiers."""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.dossiers.models import Dossier


class ActionValidation(models.TextChoices):
    VALIDE = "VALIDE", "Validé"
    REJETE = "REJETE", "Rejeté"
    DEMANDE_COMPLEMENT = "DEMANDE_COMPLEMENT", "Demande de complément"


class ValidationAgent(TimeStampedModel):
    """
    Trace une décision d'agent sur un dossier (validation, rejet, demande de
    complément). Conserve l'historique complet : plusieurs entrées par dossier.
    """

    dossier = models.ForeignKey(
        Dossier, on_delete=models.CASCADE, related_name="validations",
        verbose_name="Dossier",
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="decisions", verbose_name="Agent",
    )
    action = models.CharField("Action", max_length=20, choices=ActionValidation.choices)
    commentaire = models.TextField("Commentaire / motif", blank=True, default="")

    class Meta:
        verbose_name = "Décision d'agent"
        verbose_name_plural = "Historique des décisions"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.get_action_display()} — {self.dossier.numero_dossier}"

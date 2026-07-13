"""
Notifications usager & préférences d'envoi.

Le fil de notifications (`Notification`) trace les événements du cycle de vie
d'un dossier (soumission, validation, certificat…) et les alertes d'échéance
générées par la commande `generer_alertes_echeance`. Les préférences
(`PreferencesNotification`) pilotent les canaux (e-mail / SMS / push) et les
délais de relance avant échéance.
"""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class NiveauNotification(models.TextChoices):
    """Détermine l'icône et la couleur côté interface."""

    SUCCES = "SUCCES", "Succès"          # vert  — étape franchie
    INFO = "INFO", "Information"          # bleu  — certificat, document
    ALERTE = "ALERTE", "Alerte"          # rouge — échéance / rejet
    ACTION = "ACTION", "Action requise"  # ambre — l'usager doit agir
    NEUTRE = "NEUTRE", "Neutre"          # gris  — informatif


# Délais de relance proposés (jours avant échéance).
DELAIS_RELANCE = [30, 15, 7, 2]
DELAIS_DEFAUT = [15, 7]


class Notification(TimeStampedModel):
    """Un élément du fil de notifications d'un usager."""

    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="notifications", verbose_name="Destinataire",
    )
    niveau = models.CharField(
        "Niveau", max_length=8, choices=NiveauNotification.choices,
        default=NiveauNotification.NEUTRE,
    )
    categorie = models.CharField("Catégorie", max_length=40, blank=True, default="")
    titre = models.CharField("Titre", max_length=140)
    message = models.TextField("Message", blank=True, default="")
    lien = models.CharField("Lien (route front)", max_length=200, blank=True, default="")
    cta_label = models.CharField("Libellé du bouton", max_length=60, blank=True, default="")
    # Empreinte d'idempotence (ex. « echeance:ASSURANCE:<uuid>:7 ») pour éviter
    # de recréer la même alerte d'échéance à chaque passage de la commande.
    cle_unicite = models.CharField("Clé d'unicité", max_length=160, blank=True, default="", db_index=True)
    lu = models.BooleanField("Lu", default=False, db_index=True)

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ["-date_creation"]
        indexes = [models.Index(fields=["destinataire", "lu"])]

    def __str__(self):
        return f"{self.titre} → {self.destinataire_id} ({'lu' if self.lu else 'non lu'})"


class PreferencesNotification(TimeStampedModel):
    """Préférences d'envoi d'un usager (canaux + délais de relance)."""

    utilisateur = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="preferences_notification", verbose_name="Utilisateur",
    )
    canal_email = models.BooleanField("E-mail", default=True)
    canal_sms = models.BooleanField("SMS", default=True)
    canal_push = models.BooleanField("Notifications push", default=False)
    delais_relance = models.JSONField("Délais de relance (jours)", default=list)

    class Meta:
        verbose_name = "Préférences de notification"
        verbose_name_plural = "Préférences de notification"

    def __str__(self):
        return f"Préférences de {self.utilisateur_id}"

    @classmethod
    def pour(cls, user) -> "PreferencesNotification":
        obj, _ = cls.objects.get_or_create(
            utilisateur=user, defaults={"delais_relance": list(DELAIS_DEFAUT)}
        )
        return obj

"""Modèles transversaux : base horodatée + journal d'audit (audit trail)."""
import uuid

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class TimeStampedModel(models.Model):
    """Base commune : identifiant UUID + horodatage création/màj."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_maj = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class LogAction(models.Model):
    """
    Journal d'audit global : trace toute action sensible, indépendamment
    du module métier. Alimenté par le service `core.services.log_action`.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="actions",
        verbose_name="Utilisateur",
    )
    action = models.CharField("Action", max_length=64, db_index=True)
    # Référence générique vers l'objet concerné (dossier, certificat, etc.)
    objet_type = models.ForeignKey(
        ContentType, null=True, blank=True, on_delete=models.SET_NULL
    )
    objet_id = models.UUIDField(null=True, blank=True)
    objet = GenericForeignKey("objet_type", "objet_id")

    metadata = models.JSONField("Métadonnées", default=dict, blank=True)
    ip = models.GenericIPAddressField("Adresse IP", null=True, blank=True)
    user_agent = models.TextField("User-Agent", blank=True, default="")
    date = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Journal d'action"
        verbose_name_plural = "Journal d'audit"
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["action", "date"]),
            models.Index(fields=["objet_type", "objet_id"]),
        ]

    def __str__(self):
        return f"{self.action} — {self.date:%Y-%m-%d %H:%M}"

"""Modèle de l'étape 5 : immatriculation attribuée à un véhicule."""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.dossiers.models import Vehicule


class Immatriculation(TimeStampedModel):
    """
    Immatriculation officielle d'un véhicule.
    `numero` (plaque) et `sequence` sont uniques ; `sequence` sert à la
    génération séquentielle fiable des numéros.
    """

    vehicule = models.OneToOneField(
        Vehicule, on_delete=models.CASCADE, related_name="immatriculation",
        verbose_name="Véhicule",
    )
    numero = models.CharField("Numéro d'immatriculation", max_length=16, unique=True, editable=False)
    serie_plaque = models.CharField("Série", max_length=4, editable=False)
    sequence = models.PositiveIntegerField("Rang séquentiel", unique=True, editable=False)
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="immatriculations_attribuees", verbose_name="Agent",
    )
    date_attribution = models.DateTimeField("Attribuée le", auto_now_add=True)

    class Meta:
        verbose_name = "Immatriculation"
        verbose_name_plural = "Immatriculations"
        ordering = ["-sequence"]

    def __str__(self):
        return self.numero

"""Modèle de l'étape 5 : immatriculation attribuée à un véhicule."""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.dossiers.models import Vehicule


class CategoriePlaque(models.TextChoices):
    """Famille de plaque : les motos/tricycles ont leur propre série et compteur."""

    STANDARD = "STANDARD", "Standard (voiture, utilitaire…)"
    MOTO = "MOTO", "Moto / tricycle"


class Immatriculation(TimeStampedModel):
    """
    Immatriculation officielle d'un véhicule.
    `numero` (plaque) est unique. `sequence` sert à la génération séquentielle
    fiable des numéros ; il est propre à chaque `categorie` (les motos ont leur
    propre suite qui repart de 1), d'où l'unicité conjointe (catégorie, séquence).
    """

    vehicule = models.OneToOneField(
        Vehicule, on_delete=models.CASCADE, related_name="immatriculation",
        verbose_name="Véhicule",
    )
    numero = models.CharField("Numéro d'immatriculation", max_length=16, unique=True, editable=False)
    serie_plaque = models.CharField("Série", max_length=4, editable=False)
    categorie = models.CharField(
        "Catégorie de plaque", max_length=12,
        choices=CategoriePlaque.choices, default=CategoriePlaque.STANDARD, editable=False,
    )
    sequence = models.PositiveIntegerField("Rang séquentiel", editable=False)
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="immatriculations_attribuees", verbose_name="Agent",
    )
    date_attribution = models.DateTimeField("Attribuée le", auto_now_add=True)

    class Meta:
        verbose_name = "Immatriculation"
        verbose_name_plural = "Immatriculations"
        ordering = ["-date_attribution"]
        constraints = [
            models.UniqueConstraint(
                fields=["categorie", "sequence"], name="immat_sequence_unique_par_categorie",
            ),
        ]

    def __str__(self):
        return self.numero

    @property
    def est_moto(self) -> bool:
        return self.categorie == CategoriePlaque.MOTO

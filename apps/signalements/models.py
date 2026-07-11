"""
Signalements de véhicules (volé, recherché, opposition administrative).

Un signalement ACTIF déclenche une alerte lors d'un contrôle (vérification par
QR ou par plaque) — visible uniquement par le personnel autorisé.
"""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.dossiers.models import Vehicule


class TypeSignalement(models.TextChoices):
    VOLE = "VOLE", "Véhicule volé"
    RECHERCHE = "RECHERCHE", "Véhicule recherché"
    OPPOSITION = "OPPOSITION", "Opposition administrative"


class StatutSignalement(models.TextChoices):
    ACTIF = "ACTIF", "Actif"
    LEVE = "LEVE", "Levé"


class Signalement(TimeStampedModel):
    vehicule = models.ForeignKey(
        Vehicule, on_delete=models.CASCADE, related_name="signalements", verbose_name="Véhicule",
    )
    type = models.CharField("Type", max_length=12, choices=TypeSignalement.choices,
                            default=TypeSignalement.VOLE)
    statut = models.CharField("Statut", max_length=8, choices=StatutSignalement.choices,
                              default=StatutSignalement.ACTIF, db_index=True)
    reference = models.CharField("Référence (PV / dossier)", max_length=60, blank=True, default="")
    motif = models.TextField("Motif / circonstances", blank=True, default="")
    signale_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="signalements_emis", verbose_name="Signalé par",
    )
    date_signalement = models.DateTimeField("Signalé le", auto_now_add=True)
    leve_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="signalements_leves", verbose_name="Levé par",
    )
    date_levee = models.DateTimeField("Levé le", null=True, blank=True)
    motif_levee = models.CharField("Motif de levée", max_length=200, blank=True, default="")

    class Meta:
        verbose_name = "Signalement"
        verbose_name_plural = "Signalements"
        ordering = ["-date_signalement"]
        indexes = [models.Index(fields=["vehicule", "statut"])]

    def __str__(self):
        return f"{self.get_type_display()} — {self.vehicule.vin} ({self.get_statut_display()})"

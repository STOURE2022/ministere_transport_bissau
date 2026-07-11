"""Modèle de l'étape 3 : résultat de la vérification automatique d'un dossier."""
from django.db import models

from apps.core.models import TimeStampedModel
from apps.dossiers.models import Dossier


class NiveauRisque(models.TextChoices):
    FAIBLE = "FAIBLE", "Faible"
    MOYEN = "MOYEN", "Moyen"
    ELEVE = "ELEVE", "Élevé"


class VerificationAuto(TimeStampedModel):
    """
    Rapport des contrôles automatiques exécutés sur un dossier soumis.
    Un seul rapport par dossier (recalculé à chaque relance).
    """

    dossier = models.OneToOneField(
        Dossier, on_delete=models.CASCADE, related_name="verification",
        verbose_name="Dossier",
    )
    vin_valide = models.BooleanField("VIN valide", default=False)
    assurance_valide = models.BooleanField("Assurance valide", default=False)
    ct_valide = models.BooleanField("Contrôle technique valide", default=False)
    doublon_detecte = models.BooleanField("Doublon détecté", default=False)
    dossier_doublon = models.ForeignKey(
        Dossier, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="doublons_signales", verbose_name="Dossier en doublon",
    )
    score_fraude = models.PositiveSmallIntegerField("Score de fraude (0-100)", default=0)
    niveau_risque = models.CharField(
        "Niveau de risque", max_length=8, choices=NiveauRisque.choices,
        default=NiveauRisque.FAIBLE,
    )
    details = models.JSONField("Détail des contrôles", default=dict, blank=True)

    class Meta:
        verbose_name = "Vérification automatique"
        verbose_name_plural = "Vérifications automatiques"
        ordering = ["-date_maj"]

    def __str__(self):
        return f"Vérif {self.dossier.numero_dossier} — risque {self.get_niveau_risque_display()}"

    @property
    def tout_conforme(self) -> bool:
        return (
            self.vin_valide and self.assurance_valide
            and self.ct_valide and not self.doublon_detecte
        )

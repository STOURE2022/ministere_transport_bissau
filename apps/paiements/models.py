"""
Paiement de la taxe d'immatriculation par mobile money.

Rien n'est codé en dur : les montants (`ConfigurationPaiement`) et les opérateurs
(`OperateurPaiement`) sont modifiables depuis le tableau de bord administrateur.
La passerelle est abstraite et mockée pour l'instant (voir `passerelle.py`).
"""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.dossiers.models import Dossier


class ConfigurationPaiement(TimeStampedModel):
    """Paramètres de facturation (singleton, éditable par l'admin)."""

    devise = models.CharField("Devise", max_length=8, default="XOF")
    montant_taxe = models.PositiveIntegerField("Taxe d'immatriculation", default=15000)
    montant_timbre = models.PositiveIntegerField("Timbre fiscal", default=2000)
    frais_service = models.PositiveIntegerField("Frais de service", default=500)
    paiement_requis = models.BooleanField(
        "Paiement requis avant le certificat", default=False,
        help_text="Si activé, le certificat ne peut être émis qu'après règlement de la taxe.",
    )

    class Meta:
        verbose_name = "Configuration des paiements"
        verbose_name_plural = "Configuration des paiements"

    def __str__(self):
        return f"Configuration paiements ({self.total()} {self.devise})"

    @classmethod
    def actuelle(cls) -> "ConfigurationPaiement":
        obj = cls.objects.first()
        if obj is None:
            obj = cls.objects.create()
        return obj

    def lignes(self) -> list[dict]:
        return [
            {"libelle": "Taxe d'immatriculation", "montant": self.montant_taxe},
            {"libelle": "Timbre fiscal", "montant": self.montant_timbre},
            {"libelle": "Frais de service", "montant": self.frais_service},
        ]

    def total(self) -> int:
        return self.montant_taxe + self.montant_timbre + self.frais_service


class OperateurPaiement(TimeStampedModel):
    """Opérateur mobile money proposé (Orange Money, MTN MoMo…), éditable par l'admin."""

    nom = models.CharField("Nom", max_length=40)
    code = models.CharField("Code court", max_length=20, help_text="Ex. ORANGE, MTN")
    code_ussd = models.CharField("Code USSD", max_length=20, blank=True, default="")
    couleur = models.CharField("Couleur (hex)", max_length=9, default="#0d2748")
    actif = models.BooleanField("Actif", default=True)
    ordre = models.PositiveSmallIntegerField("Ordre d'affichage", default=0)

    class Meta:
        verbose_name = "Opérateur de paiement"
        verbose_name_plural = "Opérateurs de paiement"
        ordering = ["ordre", "nom"]

    def __str__(self):
        return self.nom


class StatutPaiement(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente"
    PAYE = "PAYE", "Payé"
    ECHOUE = "ECHOUE", "Échoué"


class Paiement(TimeStampedModel):
    """Règlement de la taxe d'immatriculation d'un dossier."""

    dossier = models.ForeignKey(
        Dossier, on_delete=models.CASCADE, related_name="paiements", verbose_name="Dossier",
    )
    reference = models.CharField("Référence du reçu", max_length=24, unique=True, editable=False)
    devise = models.CharField("Devise", max_length=8, default="XOF")
    montant_total = models.PositiveIntegerField("Montant total")
    detail = models.JSONField("Détail (lignes)", default=list)
    operateur = models.CharField("Opérateur", max_length=40)
    code_ussd = models.CharField("Code USSD", max_length=20, blank=True, default="")
    numero_telephone = models.CharField("Numéro mobile money", max_length=24)
    reference_transaction = models.CharField("Réf. transaction opérateur", max_length=40, blank=True, default="")
    statut = models.CharField(
        "Statut", max_length=12, choices=StatutPaiement.choices,
        default=StatutPaiement.EN_ATTENTE, db_index=True,
    )
    paye_le = models.DateTimeField("Payé le", null=True, blank=True)
    initie_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="paiements_inities", verbose_name="Initié par",
    )
    pdf_fichier = models.FileField("Reçu PDF", upload_to="recus/", null=True, blank=True)

    class Meta:
        verbose_name = "Paiement"
        verbose_name_plural = "Paiements"
        ordering = ["-date_creation"]
        indexes = [models.Index(fields=["dossier", "statut"])]

    def __str__(self):
        return f"{self.reference} — {self.montant_total} {self.devise} ({self.get_statut_display()})"

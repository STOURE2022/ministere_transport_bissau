"""
Amendes & procès-verbaux (infractions routières).

Les forces de l'ordre dressent un procès-verbal rattaché à un véhicule ; l'usager
est notifié et règle l'amende par mobile money (passerelle **partagée** avec les
paiements de taxe). Rien n'est codé en dur : le barème (`TypeInfraction`) est
modifiable depuis le tableau de bord administrateur.
"""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.dossiers.models import Vehicule


class TypeInfraction(TimeStampedModel):
    """Type d'infraction et son montant (barème éditable par l'admin)."""

    libelle = models.CharField("Libellé", max_length=80)
    code = models.CharField("Code court", max_length=32, unique=True, help_text="Ex. EXCES_VITESSE")
    montant = models.PositiveIntegerField("Montant de l'amende")
    actif = models.BooleanField("Actif", default=True)
    ordre = models.PositiveSmallIntegerField("Ordre d'affichage", default=0)

    class Meta:
        verbose_name = "Type d'infraction"
        verbose_name_plural = "Barème des infractions"
        ordering = ["ordre", "libelle"]

    def __str__(self):
        return f"{self.libelle} ({self.montant})"


class StatutInfraction(models.TextChoices):
    A_REGLER = "A_REGLER", "À régler"
    PAYEE = "PAYEE", "Soldée"
    CONTESTEE = "CONTESTEE", "Contestée"
    ANNULEE = "ANNULEE", "Annulée"


class Infraction(TimeStampedModel):
    """Procès-verbal dressé sur un véhicule."""

    vehicule = models.ForeignKey(
        Vehicule, on_delete=models.CASCADE, related_name="infractions", verbose_name="Véhicule",
    )
    reference = models.CharField("Référence du PV", max_length=24, unique=True, editable=False)
    type_infraction = models.ForeignKey(
        TypeInfraction, null=True, on_delete=models.SET_NULL,
        related_name="infractions", verbose_name="Type d'infraction",
    )
    libelle = models.CharField("Infraction", max_length=80)  # figé à l'émission
    montant = models.PositiveIntegerField("Montant")
    devise = models.CharField("Devise", max_length=8, default="XOF")
    lieu = models.CharField("Lieu du contrôle", max_length=160, blank=True, default="")
    observations = models.TextField("Observations", blank=True, default="")
    date_infraction = models.DateTimeField("Constatée le")
    dressee_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
        related_name="infractions_dressees", verbose_name="Agent verbalisateur",
    )
    statut = models.CharField(
        "Statut", max_length=12, choices=StatutInfraction.choices,
        default=StatutInfraction.A_REGLER, db_index=True,
    )
    motif_contestation = models.TextField("Motif de contestation", blank=True, default="")
    motif_annulation = models.TextField("Motif d'annulation", blank=True, default="")

    # Règlement (mobile money) — rempli à la clôture.
    operateur = models.CharField("Opérateur", max_length=40, blank=True, default="")
    code_ussd = models.CharField("Code USSD", max_length=20, blank=True, default="")
    numero_telephone = models.CharField("Numéro mobile money", max_length=24, blank=True, default="")
    reference_transaction = models.CharField("Réf. transaction", max_length=40, blank=True, default="")
    quittance_reference = models.CharField("Référence quittance", max_length=24, blank=True, default="")
    paye_le = models.DateTimeField("Réglée le", null=True, blank=True)
    quittance_fichier = models.FileField("Quittance PDF", upload_to="quittances/", null=True, blank=True)

    class Meta:
        verbose_name = "Infraction"
        verbose_name_plural = "Infractions"
        ordering = ["-date_infraction"]
        indexes = [models.Index(fields=["vehicule", "statut"])]

    def __str__(self):
        return f"{self.reference} — {self.libelle} ({self.get_statut_display()})"

    @property
    def est_reglee(self) -> bool:
        return self.statut == StatutInfraction.PAYEE

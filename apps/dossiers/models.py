"""
Modèles de l'étape 2 : véhicule, dossier d'immatriculation et pièces jointes.

- `Vehicule.id` est un UUIDv4 (fourni par TimeStampedModel) : c'est
  l'identifiant qui sera encodé dans le QR du certificat (étape 6).
- Le VIN est indexé mais NON unique : la détection de doublons est traitée à
  l'étape 3 (vérification automatique), pas bloquée au niveau base.
"""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


# ── Énumérations ──
class Energie(models.TextChoices):
    ESSENCE = "ESSENCE", "Essence"
    DIESEL = "DIESEL", "Diesel"
    ELECTRIQUE = "ELECTRIQUE", "Électrique"
    HYBRIDE = "HYBRIDE", "Hybride"
    GPL = "GPL", "GPL"


class TypeVehicule(models.TextChoices):
    VP = "VP", "Voiture particulière"
    UTILITAIRE = "UTILITAIRE", "Utilitaire"
    MOTO = "MOTO", "Moto / tricycle"
    POIDS_LOURD = "POIDS_LOURD", "Poids lourd"
    BUS = "BUS", "Bus / transport en commun"


class StatutDossier(models.TextChoices):
    BROUILLON = "BROUILLON", "Brouillon"
    SOUMIS = "SOUMIS", "Soumis"
    VERIF_AUTO = "VERIF_AUTO", "Vérification automatique"
    EN_VALIDATION = "EN_VALIDATION", "En validation"
    VALIDE = "VALIDE", "Validé"
    REJETE = "REJETE", "Rejeté"
    IMMATRICULE = "IMMATRICULE", "Immatriculé"
    CERTIFIE = "CERTIFIE", "Certifié"
    ARCHIVE = "ARCHIVE", "Archivé"


class TypeDocument(models.TextChoices):
    CNI = "CNI", "Pièce d'identité"
    CARTE_GRISE = "CARTE_GRISE", "Carte grise"
    ASSURANCE = "ASSURANCE", "Attestation d'assurance"
    CONTROLE_TECHNIQUE = "CONTROLE_TECHNIQUE", "Contrôle technique"
    FACTURE = "FACTURE", "Facture d'achat"
    AUTRE = "AUTRE", "Autre pièce"


class StatutVerifDocument(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente"
    CONFORME = "CONFORME", "Conforme"
    NON_CONFORME = "NON_CONFORME", "Non conforme"


# Pièces obligatoires pour soumettre un dossier.
DOCUMENTS_REQUIS = (
    TypeDocument.ASSURANCE,
    TypeDocument.CONTROLE_TECHNIQUE,
    TypeDocument.FACTURE,
)


class Vehicule(TimeStampedModel):
    """Véhicule rattaché à un dossier. Son UUID sert d'identifiant QR."""

    vin = models.CharField("Numéro de châssis (VIN)", max_length=17, db_index=True)
    marque = models.CharField("Marque", max_length=60)
    modele = models.CharField("Modèle", max_length=60)
    annee = models.PositiveIntegerField("Année")
    couleur = models.CharField("Couleur", max_length=40, blank=True, default="")
    energie = models.CharField("Énergie", max_length=12, choices=Energie.choices)
    type_vehicule = models.CharField("Type", max_length=12, choices=TypeVehicule.choices)
    proprietaire = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vehicules",
        verbose_name="Propriétaire",
    )

    class Meta:
        verbose_name = "Véhicule"
        verbose_name_plural = "Véhicules"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.marque} {self.modele} ({self.vin})"


class Dossier(TimeStampedModel):
    """Dossier d'immatriculation : pilote le workflow (statuts)."""

    numero_dossier = models.CharField("N° de dossier", max_length=24, unique=True, editable=False)
    usager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dossiers",
        verbose_name="Usager",
    )
    vehicule = models.OneToOneField(
        Vehicule, on_delete=models.CASCADE, related_name="dossier", verbose_name="Véhicule",
    )
    statut = models.CharField(
        "Statut", max_length=16, choices=StatutDossier.choices,
        default=StatutDossier.BROUILLON, db_index=True,
    )
    motif_rejet = models.TextField("Motif de rejet", blank=True, default="")
    agent_assigne = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="dossiers_assignes", verbose_name="Agent assigné",
    )
    date_soumission = models.DateTimeField("Soumis le", null=True, blank=True)

    class Meta:
        verbose_name = "Dossier"
        verbose_name_plural = "Dossiers"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.numero_dossier} — {self.get_statut_display()}"

    @property
    def est_modifiable(self) -> bool:
        """Un dossier n'est modifiable par l'usager qu'au stade brouillon."""
        return self.statut == StatutDossier.BROUILLON

    def documents_requis_manquants(self) -> list[str]:
        """Retourne les types de documents obligatoires non encore déposés."""
        presents = set(self.documents.values_list("type_document", flat=True))
        return [t.label for t in DOCUMENTS_REQUIS if t not in presents]


def chemin_document(instance, filename: str) -> str:
    """Range les fichiers par dossier : documents/<dossier_id>/<fichier>."""
    return f"documents/{instance.dossier_id}/{filename}"


class Document(TimeStampedModel):
    """Pièce justificative déposée dans un dossier."""

    dossier = models.ForeignKey(
        Dossier, on_delete=models.CASCADE, related_name="documents", verbose_name="Dossier",
    )
    type_document = models.CharField("Type", max_length=20, choices=TypeDocument.choices)
    fichier = models.FileField("Fichier", upload_to=chemin_document)
    format = models.CharField("Format", max_length=8, blank=True, default="")
    taille = models.PositiveIntegerField("Taille (octets)", default=0)
    hash_fichier = models.CharField("Empreinte SHA-256", max_length=64, blank=True, default="")
    ocr_texte = models.TextField("Texte OCR", blank=True, default="")  # alimenté en V2
    # Dates portées par la pièce (ex. période de validité assurance / CT).
    date_debut = models.DateField("Date de début / d'émission", null=True, blank=True)
    date_fin = models.DateField("Date de fin / d'échéance", null=True, blank=True)
    statut_verif = models.CharField(
        "Statut de vérification", max_length=14,
        choices=StatutVerifDocument.choices, default=StatutVerifDocument.EN_ATTENTE,
    )
    motif_verif = models.TextField("Motif (si non conforme)", blank=True, default="")
    verifie_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="documents_verifies", verbose_name="Vérifié par",
    )

    class Meta:
        verbose_name = "Document"
        verbose_name_plural = "Documents"
        ordering = ["type_document"]

    def __str__(self):
        return f"{self.get_type_document_display()} — {self.dossier.numero_dossier}"

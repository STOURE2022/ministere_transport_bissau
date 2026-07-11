"""Modèles du certificat numérique sécurisé (étapes 6 et 7)."""
import uuid

from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.dossiers.models import Dossier, Vehicule


class StatutCertificat(models.TextChoices):
    ACTIF = "ACTIF", "Actif"
    SUSPENDU = "SUSPENDU", "Suspendu"
    REVOQUE = "REVOQUE", "Révoqué"
    EXPIRE = "EXPIRE", "Expiré"


class Certificat(TimeStampedModel):
    """
    Certificat d'immatriculation numérique. `id` (UUIDv4) sert d'identifiant
    dans le QR et l'URL de vérification. Les données sont figées dans
    `donnees_snapshot`, dont l'empreinte SHA-256 est signée en RSA.
    """

    dossier = models.OneToOneField(
        Dossier, on_delete=models.CASCADE, related_name="certificat", verbose_name="Dossier",
    )
    vehicule = models.ForeignKey(
        Vehicule, on_delete=models.CASCADE, related_name="certificats", verbose_name="Véhicule",
    )
    donnees_snapshot = models.JSONField("Données figées", default=dict)
    hash_sha256 = models.CharField("Empreinte SHA-256", max_length=64)
    signature_rsa = models.TextField("Signature RSA (base64)")
    qr_payload = models.TextField("Contenu du QR")
    pdf_fichier = models.FileField("Certificat PDF", upload_to="certificats/", blank=True)
    statut = models.CharField(
        "Statut", max_length=10, choices=StatutCertificat.choices,
        default=StatutCertificat.ACTIF, db_index=True,
    )
    date_emission = models.DateTimeField("Émis le")
    date_expiration = models.DateTimeField("Expire le")
    motif_revocation = models.TextField("Motif de révocation", blank=True, default="")

    class Meta:
        verbose_name = "Certificat"
        verbose_name_plural = "Certificats"
        ordering = ["-date_emission"]

    def __str__(self):
        return f"Certificat {self.id} — {self.get_statut_display()}"

    @property
    def est_valide(self) -> bool:
        """Certificat exploitable : actif et non expiré."""
        from django.utils import timezone
        return self.statut == StatutCertificat.ACTIF and self.date_expiration >= timezone.now()


class ResultatScan(models.TextChoices):
    AUTHENTIQUE = "AUTHENTIQUE", "Authentique"
    FALSIFIE = "FALSIFIE", "Falsifié"
    REVOQUE = "REVOQUE", "Révoqué"
    EXPIRE = "EXPIRE", "Expiré"
    INTROUVABLE = "INTROUVABLE", "Introuvable"


class ScanLog(models.Model):
    """
    Trace chaque vérification de QR (étape 7). Conserve l'UUID scanné même si
    le certificat est introuvable (traçabilité des tentatives).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    certificat = models.ForeignKey(
        Certificat, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="scans", verbose_name="Certificat",
    )
    uuid_scanne = models.UUIDField("UUID scanné", db_index=True)
    resultat = models.CharField("Résultat", max_length=12, choices=ResultatScan.choices)
    scanne_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="scans", verbose_name="Scanné par",
    )
    ip = models.GenericIPAddressField("Adresse IP", null=True, blank=True)
    localisation = models.CharField("Localisation", max_length=120, blank=True, default="")
    date_scan = models.DateTimeField("Scanné le", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Scan de vérification"
        verbose_name_plural = "Scans de vérification"
        ordering = ["-date_scan"]

    def __str__(self):
        return f"Scan {self.uuid_scanne} → {self.resultat}"

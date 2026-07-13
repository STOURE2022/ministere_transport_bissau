"""
Émission du certificat QR (étape 6).

Sur un dossier IMMATRICULE : fige les données, calcule l'empreinte SHA-256,
la signe en RSA, construit le contenu du QR (UUID + hash + URL de vérification),
génère le PDF et fait transiter le dossier IMMATRICULE → CERTIFIE.
"""
from __future__ import annotations

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.core.services import log_action
from apps.dossiers.models import Dossier, StatutDossier, TypeDocument
from apps.notifications.models import NiveauNotification
from apps.notifications.services import notifier

from . import crypto
from .models import Certificat, StatutCertificat
from .pdf import rendre_certificat_pdf


def _echeance(dossier, type_doc) -> str | None:
    doc = dossier.documents.filter(type_document=type_doc).first()
    if doc and doc.date_fin:
        return doc.date_fin.isoformat()
    return None


def _construire_snapshot(dossier: Dossier, date_emission) -> dict:
    """Fige les données du certificat au moment de l'émission."""
    v = dossier.vehicule
    immat = getattr(v, "immatriculation", None)
    return {
        "numero_dossier": dossier.numero_dossier,
        "uuid_vehicule": str(v.id),
        "immatriculation": immat.numero if immat else None,
        "serie": immat.serie_plaque if immat else None,
        "proprietaire": f"{dossier.usager.prenom} {dossier.usager.nom}".strip(),
        "marque": v.marque,
        "modele": v.modele,
        "annee": v.annee,
        "energie": v.get_energie_display(),
        "type": v.get_type_vehicule_display(),
        "assurance_echeance": _echeance(dossier, TypeDocument.ASSURANCE),
        "ct_echeance": _echeance(dossier, TypeDocument.CONTROLE_TECHNIQUE),
        "date_emission": date_emission.isoformat(),
    }


@transaction.atomic
def emettre_certificat(dossier: Dossier, agent, *, request=None):
    """Retourne (succès, message, certificat)."""
    if dossier.statut != StatutDossier.IMMATRICULE:
        return False, "Seul un dossier immatriculé peut être certifié.", None
    if Certificat.objects.filter(dossier=dossier).exists():
        return False, "Un certificat existe déjà pour ce dossier.", None

    # Le paiement de la taxe peut être exigé (configurable par l'admin).
    from apps.paiements.services import paiement_bloque_certificat
    if paiement_bloque_certificat(dossier):
        return False, "La taxe d'immatriculation doit être réglée avant l'émission du certificat.", None

    now = timezone.now()
    snapshot = _construire_snapshot(dossier, now)

    # Empreinte + signature de la sérialisation canonique.
    canonical = crypto.canonicaliser(snapshot)
    hash_hex = crypto.hash_sha256(canonical)
    signature = crypto.signer(canonical)

    expiration = now + timezone.timedelta(days=365 * settings.CERTIFICAT_VALIDITE_ANNEES)

    certificat = Certificat(
        dossier=dossier,
        vehicule=dossier.vehicule,
        donnees_snapshot=snapshot,
        hash_sha256=hash_hex,
        signature_rsa=signature,
        statut=StatutCertificat.ACTIF,
        date_emission=now,
        date_expiration=expiration,
    )
    # Le QR encode l'UUID du certificat + l'empreinte + l'URL de vérification (étape 7).
    base = settings.SNICV_VERIFY_BASE_URL.rstrip("/")
    certificat.qr_payload = f"{base}/verify/{certificat.id}/?h={hash_hex}"

    # PDF (avec QR intégré).
    pdf_bytes = rendre_certificat_pdf(certificat)
    certificat.pdf_fichier.save(
        f"certificat-{certificat.id}.pdf", ContentFile(pdf_bytes), save=False)

    certificat.save()

    dossier.statut = StatutDossier.CERTIFIE
    dossier.save(update_fields=["statut", "date_maj"])

    log_action("CERTIFICAT_EMIS", user=agent, objet=dossier, request=request,
               certificat=str(certificat.id), hash=hash_hex)
    notifier(dossier.usager, NiveauNotification.INFO,
             titre="Certificat émis · PDF disponible",
             message="Votre certificat d'immatriculation est disponible. "
                     "Présentez son QR lors d'un contrôle.",
             categorie="Certificat", lien=f"/dossiers/{dossier.id}",
             cta_label="Télécharger le PDF")
    return True, "Certificat émis.", certificat


@transaction.atomic
def revoquer_certificat(certificat: Certificat, agent, motif: str = "", *, request=None):
    if certificat.statut == StatutCertificat.REVOQUE:
        return False, "Certificat déjà révoqué.", certificat
    certificat.statut = StatutCertificat.REVOQUE
    certificat.motif_revocation = motif
    certificat.save(update_fields=["statut", "motif_revocation", "date_maj"])
    log_action("CERTIFICAT_REVOQUE", user=agent, objet=certificat.dossier, request=request,
               certificat=str(certificat.id), motif=motif)
    return True, "Certificat révoqué.", certificat

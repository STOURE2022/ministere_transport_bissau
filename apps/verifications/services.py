"""
Moteur de vérification automatique (étape 3).

Contrôle le VIN, la validité de l'assurance et du contrôle technique, détecte
les doublons (même VIN sur plusieurs dossiers actifs) et calcule un score de
fraude. Fait transiter le dossier SOUMIS → VERIF_AUTO → EN_VALIDATION.
"""
from __future__ import annotations

from django.utils import timezone

from apps.core.services import log_action
from apps.dossiers.models import Dossier, StatutDossier, TypeDocument, Vehicule

from .models import NiveauRisque, VerificationAuto

# Caractères VIN valides (norme ISO 3779 : ni I, ni O, ni Q pour éviter les confusions).
VIN_CHARS = set("ABCDEFGHJKLMNPRSTUVWXYZ0123456789")

# Un dossier « actif » (donc susceptible d'être un doublon) n'est ni rejeté ni archivé.
STATUTS_INACTIFS = (StatutDossier.REJETE, StatutDossier.ARCHIVE)

# Pondération du score de fraude (0-100).
POIDS_DOUBLON = 50
POIDS_VIN = 25
POIDS_ASSURANCE = 15
POIDS_CT = 10

# Seuils de niveau de risque.
SEUIL_MOYEN = 30
SEUIL_ELEVE = 70


def valider_vin(vin: str) -> tuple[bool, str]:
    """Contrôle la forme du VIN (17 caractères, alphabet ISO)."""
    vin = (vin or "").strip().upper()
    if len(vin) != 17:
        return False, f"Longueur invalide ({len(vin)} caractères, 17 attendus)."
    invalides = sorted(set(vin) - VIN_CHARS)
    if invalides:
        return False, f"Caractères non autorisés : {', '.join(invalides)}."
    return True, "Format conforme."


def _document_valide(dossier: Dossier, type_doc: str) -> tuple[bool, str]:
    """Le document existe et n'est pas expiré (date_fin >= aujourd'hui)."""
    doc = dossier.documents.filter(type_document=type_doc).first()
    if doc is None:
        return False, "Pièce absente."
    if doc.date_fin and doc.date_fin < timezone.now().date():
        return False, f"Expiré le {doc.date_fin:%d/%m/%Y}."
    return True, "Valide."


def detecter_doublon(dossier: Dossier) -> Dossier | None:
    """Cherche un autre dossier actif portant le même VIN."""
    vin = dossier.vehicule.vin
    autre = (
        Vehicule.objects.filter(vin=vin, dossier__isnull=False)
        .exclude(pk=dossier.vehicule_id)
        .exclude(dossier__statut__in=STATUTS_INACTIFS)
        .select_related("dossier")
        .first()
    )
    return autre.dossier if autre else None


def _niveau(score: int) -> str:
    if score >= SEUIL_ELEVE:
        return NiveauRisque.ELEVE
    if score >= SEUIL_MOYEN:
        return NiveauRisque.MOYEN
    return NiveauRisque.FAIBLE


def lancer_verification(dossier: Dossier, *, request=None) -> VerificationAuto:
    """Exécute tous les contrôles, enregistre le rapport et fait avancer le dossier."""
    # Marque le dossier en cours de vérification.
    dossier.statut = StatutDossier.VERIF_AUTO
    dossier.save(update_fields=["statut", "date_maj"])

    vin_ok, vin_msg = valider_vin(dossier.vehicule.vin)
    assurance_ok, assurance_msg = _document_valide(dossier, TypeDocument.ASSURANCE)
    ct_ok, ct_msg = _document_valide(dossier, TypeDocument.CONTROLE_TECHNIQUE)
    doublon = detecter_doublon(dossier)
    doublon_detecte = doublon is not None

    score = 0
    if doublon_detecte:
        score += POIDS_DOUBLON
    if not vin_ok:
        score += POIDS_VIN
    if not assurance_ok:
        score += POIDS_ASSURANCE
    if not ct_ok:
        score += POIDS_CT
    score = min(score, 100)

    details = {
        "vin": {"valide": vin_ok, "message": vin_msg},
        "assurance": {"valide": assurance_ok, "message": assurance_msg},
        "controle_technique": {"valide": ct_ok, "message": ct_msg},
        "doublon": {
            "detecte": doublon_detecte,
            "dossier": doublon.numero_dossier if doublon else None,
        },
    }

    verif, _ = VerificationAuto.objects.update_or_create(
        dossier=dossier,
        defaults={
            "vin_valide": vin_ok,
            "assurance_valide": assurance_ok,
            "ct_valide": ct_ok,
            "doublon_detecte": doublon_detecte,
            "dossier_doublon": doublon,
            "score_fraude": score,
            "niveau_risque": _niveau(score),
            "details": details,
        },
    )

    # Le dossier entre dans la file de validation d'un agent (étape 4).
    dossier.statut = StatutDossier.EN_VALIDATION
    dossier.save(update_fields=["statut", "date_maj"])

    log_action(
        "VERIFICATION_AUTO", user=getattr(request, "user", None), objet=dossier,
        request=request, score=score, doublon=doublon_detecte,
        niveau=verif.niveau_risque,
    )
    return verif

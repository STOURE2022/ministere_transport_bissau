"""Logique métier des dossiers : numérotation, empreinte fichier, cohérence des dates."""
from __future__ import annotations

import hashlib

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from .models import Dossier, StatutDossier, TypeDocument


def generer_numero_dossier() -> str:
    """
    Génère un numéro lisible et séquentiel : SNICV-<année>-<compteur 6 chiffres>.
    Le compteur repart de 1 chaque année.
    """
    annee = timezone.now().year
    prefixe = f"SNICV-{annee}-"
    with transaction.atomic():
        dernier = (
            Dossier.objects.select_for_update()
            .filter(numero_dossier__startswith=prefixe)
            .aggregate(m=Max("numero_dossier"))["m"]
        )
        suivant = (int(dernier.split("-")[-1]) + 1) if dernier else 1
    return f"{prefixe}{suivant:06d}"


def calculer_hash_fichier(fichier) -> str:
    """Empreinte SHA-256 du contenu (lecture par blocs, sans tout charger en mémoire)."""
    sha = hashlib.sha256()
    for bloc in fichier.chunks():
        sha.update(bloc)
    fichier.seek(0)
    return sha.hexdigest()


def verifier_coherence_dates(dossier: Dossier) -> list[str]:
    """
    Contrôle de cohérence des dates des pièces d'un dossier (étape 2).
    Retourne la liste des incohérences (vide = tout est cohérent).
    """
    problemes: list[str] = []
    aujourdhui = timezone.now().date()
    docs = {d.type_document: d for d in dossier.documents.all()}

    # 1. Sur chaque pièce : la date de début ne peut pas être après la date de fin.
    for doc in docs.values():
        if doc.date_debut and doc.date_fin and doc.date_debut > doc.date_fin:
            problemes.append(
                f"{doc.get_type_document_display()} : date de début postérieure à la date de fin."
            )

    # 2. Assurance et contrôle technique ne doivent pas être expirés à la soumission.
    for type_doc in (TypeDocument.ASSURANCE, TypeDocument.CONTROLE_TECHNIQUE):
        doc = docs.get(type_doc)
        if doc and doc.date_fin and doc.date_fin < aujourdhui:
            problemes.append(
                f"{doc.get_type_document_display()} expiré(e) le {doc.date_fin:%d/%m/%Y}."
            )

    # 3. Cohérence croisée : le contrôle technique ne peut précéder la facture d'achat.
    facture = docs.get(TypeDocument.FACTURE)
    ct = docs.get(TypeDocument.CONTROLE_TECHNIQUE)
    if facture and ct and facture.date_debut and ct.date_debut and ct.date_debut < facture.date_debut:
        problemes.append(
            "Le contrôle technique est antérieur à la facture d'achat du véhicule."
        )

    return problemes


def soumettre_dossier(dossier: Dossier) -> tuple[bool, list[str]]:
    """
    Tente de passer un dossier de BROUILLON à SOUMIS.
    Retourne (succès, problemes). Bloque si des pièces obligatoires manquent
    ou si les dates sont incohérentes.
    """
    if dossier.statut != StatutDossier.BROUILLON:
        return False, ["Seul un dossier au statut « Brouillon » peut être soumis."]

    manquants = dossier.documents_requis_manquants()
    if manquants:
        return False, [f"Document obligatoire manquant : {m}." for m in manquants]

    incoherences = verifier_coherence_dates(dossier)
    if incoherences:
        return False, incoherences

    dossier.statut = StatutDossier.SOUMIS
    dossier.date_soumission = timezone.now()
    dossier.save(update_fields=["statut", "date_soumission", "date_maj"])
    return True, []


# Statuts depuis lesquels un dossier peut être archivé (fin de cycle de vie).
STATUTS_ARCHIVABLES = {StatutDossier.CERTIFIE, StatutDossier.IMMATRICULE, StatutDossier.REJETE}


@transaction.atomic
def archiver_dossier(dossier: Dossier, user, *, request=None):
    """
    Clôt le cycle de vie : passe le dossier à ARCHIVE (consultable, non modifiable).
    Retourne (succès, message).
    """
    from apps.core.services import log_action

    if dossier.statut == StatutDossier.ARCHIVE:
        return False, "Ce dossier est déjà archivé."
    if dossier.statut not in STATUTS_ARCHIVABLES:
        return False, "Seul un dossier immatriculé, certifié ou rejeté peut être archivé."
    dossier.statut = StatutDossier.ARCHIVE
    dossier.save(update_fields=["statut", "date_maj"])
    log_action("DOSSIER_ARCHIVE", user=user, objet=dossier, request=request,
               numero=dossier.numero_dossier)
    return True, "Dossier archivé."

"""
Logique métier de la validation agent (étape 4).

Un dossier au statut EN_VALIDATION peut être :
- validé          → VALIDE       (prêt pour l'attribution d'immatriculation, étape 5)
- rejeté          → REJETE       (motif obligatoire)
- renvoyé pour    → BROUILLON    (l'usager complète puis re-soumet)
  complément

Chaque décision est historisée dans ValidationAgent et journalisée.
"""
from __future__ import annotations

from django.db import transaction

from apps.core.services import log_action
from apps.dossiers.models import Dossier, StatutDossier

from .models import ActionValidation, ValidationAgent

# Seuls les dossiers en attente de décision peuvent être traités.
STATUT_TRAITABLE = StatutDossier.EN_VALIDATION


def _enregistrer(dossier, agent, action, commentaire, request):
    dossier.agent_assigne = agent
    dossier.save(update_fields=["statut", "agent_assigne", "motif_rejet", "date_maj"])
    decision = ValidationAgent.objects.create(
        dossier=dossier, agent=agent, action=action, commentaire=commentaire,
    )
    log_action(f"DOSSIER_{action}", user=agent, objet=dossier, request=request,
               numero=dossier.numero_dossier)
    return decision


@transaction.atomic
def valider_dossier(dossier: Dossier, agent, commentaire: str = "", *, request=None):
    if dossier.statut != STATUT_TRAITABLE:
        return False, "Seul un dossier en attente de validation peut être validé.", None
    dossier.statut = StatutDossier.VALIDE
    dossier.motif_rejet = ""
    decision = _enregistrer(dossier, agent, ActionValidation.VALIDE, commentaire, request)
    return True, "Dossier validé.", decision


@transaction.atomic
def rejeter_dossier(dossier: Dossier, agent, motif: str, *, request=None):
    if dossier.statut != STATUT_TRAITABLE:
        return False, "Seul un dossier en attente de validation peut être rejeté.", None
    if not (motif or "").strip():
        return False, "Le motif de rejet est obligatoire.", None
    dossier.statut = StatutDossier.REJETE
    dossier.motif_rejet = motif
    decision = _enregistrer(dossier, agent, ActionValidation.REJETE, motif, request)
    return True, "Dossier rejeté.", decision


@transaction.atomic
def demander_complement(dossier: Dossier, agent, commentaire: str, *, request=None):
    if dossier.statut != STATUT_TRAITABLE:
        return False, "Seul un dossier en attente de validation peut faire l'objet d'une demande.", None
    if not (commentaire or "").strip():
        return False, "Précisez les pièces ou informations à compléter.", None
    # Le dossier redevient modifiable par l'usager (retour au brouillon).
    dossier.statut = StatutDossier.BROUILLON
    dossier.motif_rejet = ""
    decision = _enregistrer(dossier, agent, ActionValidation.DEMANDE_COMPLEMENT, commentaire, request)
    return True, "Demande de complément envoyée à l'usager.", decision

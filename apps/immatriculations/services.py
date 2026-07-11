"""
Attribution d'immatriculation (étape 5).

Sur un dossier VALIDE, génère un numéro de plaque unique et séquentiel au
format Guinée-Bissau « <série> <numéro> <bureau> » (ex. « AB 4821 BS »),
attribue la série et fait transiter le dossier VALIDE → IMMATRICULE. L'UUID du
véhicule (déjà présent) servira d'identifiant du QR au certificat (étape 6).
"""
from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.db.models import Max

from apps.core.services import log_action
from apps.dossiers.models import Dossier, StatutDossier

from .models import Immatriculation

# Un « bloc » de série couvre 0001..9999 avant de passer à la série suivante.
NUMEROS_PAR_SERIE = 9999


def _composer_numero(sequence: int) -> tuple[str, str]:
    """Traduit un rang séquentiel (≥ 1) en (numéro de plaque, série)."""
    idx = sequence - 1
    numero_bloc = idx % NUMEROS_PAR_SERIE + 1          # 1..9999
    serie_idx = idx // NUMEROS_PAR_SERIE               # 0, 1, 2, ...
    serie = chr(65 + serie_idx // 26) + chr(65 + serie_idx % 26)  # AA, AB, ...
    suffixe = getattr(settings, "IMMATRICULATION_SUFFIXE", "BS")
    return f"{serie} {numero_bloc:04d} {suffixe}", serie


@transaction.atomic
def attribuer_immatriculation(dossier: Dossier, agent, *, request=None):
    """Retourne (succès, message, immatriculation)."""
    if dossier.statut != StatutDossier.VALIDE:
        return False, "Seul un dossier validé peut être immatriculé.", None
    if Immatriculation.objects.filter(vehicule=dossier.vehicule).exists():
        return False, "Ce véhicule est déjà immatriculé.", None

    dernier = (
        Immatriculation.objects.select_for_update().aggregate(m=Max("sequence"))["m"] or 0
    )
    sequence = dernier + 1
    numero, serie = _composer_numero(sequence)

    immat = Immatriculation.objects.create(
        vehicule=dossier.vehicule, numero=numero, serie_plaque=serie,
        sequence=sequence, agent=agent,
    )
    dossier.statut = StatutDossier.IMMATRICULE
    dossier.save(update_fields=["statut", "date_maj"])

    log_action("IMMATRICULATION_ATTRIBUEE", user=agent, objet=dossier, request=request,
               numero=numero, vehicule=str(dossier.vehicule_id))
    return True, "Immatriculation attribuée.", immat

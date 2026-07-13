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
from apps.dossiers.models import Dossier, StatutDossier, TypeVehicule
from apps.notifications.models import NiveauNotification
from apps.notifications.services import notifier

from .models import CategoriePlaque, Immatriculation

# Un « bloc » de série couvre 0001..9999 avant de passer à la série suivante.
NUMEROS_PAR_SERIE = 9999


def _categorie_pour(vehicule) -> str:
    """Les motos/tricycles reçoivent une plaque dédiée, les autres une plaque standard."""
    if vehicule.type_vehicule == TypeVehicule.MOTO:
        return CategoriePlaque.MOTO
    return CategoriePlaque.STANDARD


def _composer_numero(sequence: int, categorie: str) -> tuple[str, str]:
    """Traduit un rang séquentiel (≥ 1) en (numéro de plaque, série).

    - Standard : « AA 1234 BS » (série à deux lettres, suffixe bureau BS).
    - Moto     : « M 1234 SB » (préfixe M, suffixe dédié SB) ; au-delà de 9999,
      une lettre de série s'ajoute au préfixe (« MA 1234 SB », « MB 1234 SB »…).
    """
    idx = sequence - 1
    numero_bloc = idx % NUMEROS_PAR_SERIE + 1          # 1..9999
    serie_idx = idx // NUMEROS_PAR_SERIE               # 0, 1, 2, ...
    serie = chr(65 + serie_idx // 26) + chr(65 + serie_idx % 26)  # AA, AB, ...

    if categorie == CategoriePlaque.MOTO:
        suffixe = getattr(settings, "IMMATRICULATION_SUFFIXE_MOTO", "SB")
        prefixe = "M" if serie_idx == 0 else "M" + chr(65 + serie_idx - 1)  # M, MA, MB, …
        return f"{prefixe} {numero_bloc:04d} {suffixe}", prefixe

    suffixe = getattr(settings, "IMMATRICULATION_SUFFIXE", "BS")
    return f"{serie} {numero_bloc:04d} {suffixe}", serie


@transaction.atomic
def attribuer_immatriculation(dossier: Dossier, agent, *, request=None):
    """Retourne (succès, message, immatriculation)."""
    if dossier.statut != StatutDossier.VALIDE:
        return False, "Seul un dossier validé peut être immatriculé.", None
    if Immatriculation.objects.filter(vehicule=dossier.vehicule).exists():
        return False, "Ce véhicule est déjà immatriculé.", None

    categorie = _categorie_pour(dossier.vehicule)
    dernier = (
        Immatriculation.objects.select_for_update()
        .filter(categorie=categorie)
        .aggregate(m=Max("sequence"))["m"] or 0
    )
    sequence = dernier + 1
    numero, serie = _composer_numero(sequence, categorie)

    immat = Immatriculation.objects.create(
        vehicule=dossier.vehicule, numero=numero, serie_plaque=serie,
        categorie=categorie, sequence=sequence, agent=agent,
    )
    dossier.statut = StatutDossier.IMMATRICULE
    dossier.save(update_fields=["statut", "date_maj"])

    log_action("IMMATRICULATION_ATTRIBUEE", user=agent, objet=dossier, request=request,
               numero=numero, vehicule=str(dossier.vehicule_id))
    notifier(dossier.usager, NiveauNotification.SUCCES,
             titre="Immatriculation attribuée",
             message=f"Le numéro {numero} a été attribué à votre véhicule.",
             categorie="Traitement", lien=f"/dossiers/{dossier.id}",
             cta_label="Voir le dossier")
    return True, "Immatriculation attribuée.", immat

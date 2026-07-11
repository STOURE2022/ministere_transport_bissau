"""Logique métier des signalements de véhicules."""
from __future__ import annotations

from django.utils import timezone

from apps.core.services import log_action
from apps.dossiers.models import Vehicule
from apps.immatriculations.models import Immatriculation

from .models import Signalement, StatutSignalement, TypeSignalement


def alerte_active(vehicule) -> Signalement | None:
    """Renvoie le signalement ACTIF le plus récent d'un véhicule, s'il existe."""
    if vehicule is None:
        return None
    return (
        vehicule.signalements
        .filter(statut=StatutSignalement.ACTIF)
        .order_by("-date_signalement")
        .first()
    )


def trouver_vehicule(*, immatriculation: str = "", vin: str = "") -> Vehicule | None:
    """Retrouve un véhicule par sa plaque (prioritaire) ou son VIN."""
    numero = " ".join((immatriculation or "").upper().split())
    if numero:
        immat = (
            Immatriculation.objects.select_related("vehicule")
            .filter(numero__iexact=numero).first()
        )
        if immat:
            return immat.vehicule
    vin_norm = (vin or "").strip().upper()
    if vin_norm:
        return Vehicule.objects.filter(vin__iexact=vin_norm).order_by("-date_creation").first()
    return None


def signaler_vehicule(vehicule, agent, *, type=TypeSignalement.VOLE, reference="",
                      motif="", request=None) -> tuple[bool, str, Signalement | None]:
    """Crée un signalement ACTIF (idempotent : réutilise l'actif existant du même type)."""
    existant = (
        vehicule.signalements
        .filter(statut=StatutSignalement.ACTIF, type=type)
        .first()
    )
    if existant:
        return False, "Un signalement actif de ce type existe déjà pour ce véhicule.", existant

    signalement = Signalement.objects.create(
        vehicule=vehicule, type=type, reference=reference, motif=motif, signale_par=agent,
    )
    log_action("VEHICULE_SIGNALE", user=agent, objet=vehicule, request=request,
               type=type, vin=vehicule.vin)
    return True, "Signalement enregistré.", signalement


def lever_signalement(signalement, agent, motif="", *, request=None) -> tuple[bool, str]:
    if signalement.statut == StatutSignalement.LEVE:
        return False, "Ce signalement est déjà levé."
    signalement.statut = StatutSignalement.LEVE
    signalement.leve_par = agent
    signalement.date_levee = timezone.now()
    signalement.motif_levee = motif
    signalement.save(update_fields=["statut", "leve_par", "date_levee", "motif_levee", "date_maj"])
    log_action("SIGNALEMENT_LEVE", user=agent, objet=signalement.vehicule, request=request,
               signalement=str(signalement.id))
    return True, "Signalement levé."

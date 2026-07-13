"""Logique métier des habilitations : demande, validation, rejet, statistiques."""
from __future__ import annotations

import datetime

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.core.services import log_action

from .models import CorpsControle, DemandeHabilitation, StatutHabilitation


def corps_actifs():
    """Corps de contrôle proposés à l'inscription (ordre d'affichage)."""
    return CorpsControle.objects.filter(actif=True)


def _reference_demande() -> str:
    """Génère une référence séquentielle annuelle HAB-YYYY-NNNNNN."""
    annee = timezone.now().year
    prefixe = f"HAB-{annee}-"
    dernier = (
        DemandeHabilitation.objects.filter(reference__startswith=prefixe)
        .aggregate(m=Max("reference"))["m"]
    )
    sequence = int(dernier.split("-")[-1]) + 1 if dernier else 1
    return f"{prefixe}{sequence:06d}"


@transaction.atomic
def creer_demande_habilitation(user, corps, *, matricule, justificatif,
                               grade="", unite="", region="") -> DemandeHabilitation:
    """Crée (ou remet à zéro) la demande d'habilitation d'un compte force de l'ordre."""
    # Une nouvelle demande écrase une éventuelle demande précédente rejetée.
    DemandeHabilitation.objects.filter(user=user).delete()
    return DemandeHabilitation.objects.create(
        user=user,
        corps=corps,
        reference=_reference_demande(),
        matricule=matricule,
        grade=grade,
        unite=unite,
        region=region,
        justificatif=justificatif,
        statut=StatutHabilitation.EN_ATTENTE,
    )


def _notifier(user, niveau, titre, message, lien="", cta_label=""):
    try:
        from apps.notifications.services import notifier
        notifier(user, niveau, titre, message=message, categorie="HABILITATION",
                 lien=lien, cta_label=cta_label)
    except Exception:  # noqa: BLE001 — une notification ne doit jamais bloquer la décision.
        pass


@transaction.atomic
def valider_habilitation(demande: DemandeHabilitation, agent, request=None) -> DemandeHabilitation:
    """Accorde l'accès : le compte peut désormais utiliser l'espace de contrôle."""
    demande.statut = StatutHabilitation.VALIDE
    demande.motif_decision = ""
    demande.decide_par = agent
    demande.decide_le = timezone.now()
    demande.save(update_fields=["statut", "motif_decision", "decide_par", "decide_le", "date_maj"])
    log_action("HABILITATION_VALIDEE", user=agent, objet=demande.user, request=request,
               reference=demande.reference, corps=demande.corps.nom)
    _notifier(
        demande.user, "SUCCES", "Accès habilité",
        f"Votre inscription au corps « {demande.corps.nom} » a été validée. "
        "Vous pouvez maintenant accéder à l'espace de contrôle.",
        lien="/controle", cta_label="Ouvrir le contrôle",
    )
    return demande


@transaction.atomic
def rejeter_habilitation(demande: DemandeHabilitation, agent, motif: str, request=None) -> DemandeHabilitation:
    """Refuse la demande. Le motif est communiqué au demandeur."""
    demande.statut = StatutHabilitation.REJETE
    demande.motif_decision = motif
    demande.decide_par = agent
    demande.decide_le = timezone.now()
    demande.save(update_fields=["statut", "motif_decision", "decide_par", "decide_le", "date_maj"])
    log_action("HABILITATION_REJETEE", user=agent, objet=demande.user, request=request,
               reference=demande.reference, motif=motif)
    _notifier(
        demande.user, "ALERTE", "Demande d'habilitation refusée",
        f"Votre demande d'accès ({demande.corps.nom}) a été refusée. Motif : {motif}",
    )
    return demande


def habilitation_stats() -> dict:
    """KPIs de la file de validation."""
    from django.db.models import Count

    par_statut = dict(
        DemandeHabilitation.objects.values_list("statut").annotate(n=Count("id"))
    )
    return {
        "en_attente": par_statut.get(StatutHabilitation.EN_ATTENTE, 0),
        "validees": par_statut.get(StatutHabilitation.VALIDE, 0),
        "rejetees": par_statut.get(StatutHabilitation.REJETE, 0),
        "corps_actifs": CorpsControle.objects.filter(actif=True).count(),
    }


def force_ordre_en_attente(user) -> bool:
    """
    Vrai si l'utilisateur est un agent de contrôle dont la demande n'est PAS
    encore validée. Un compte FORCE_ORDRE **sans** demande (créé par l'admin /
    le seed) est considéré habilité — aucune régression sur l'existant.
    """
    if getattr(user, "role", None) != "FORCE_ORDRE":
        return False
    demande = getattr(user, "habilitation", None)
    return demande is not None and demande.statut != StatutHabilitation.VALIDE

"""
Services infractions : barème, verbalisation, règlement (mock), contestation, quittance.

Le règlement réutilise la **passerelle mobile money** de l'app `paiements`
(`get_passerelle`) et ses opérateurs actifs — le jour où le vrai Orange Money /
MTN MoMo est branché, taxes et amendes deviennent réelles d'un coup.
"""
from __future__ import annotations

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Max, Sum
from django.utils import timezone

from apps.core.services import log_action
from apps.paiements.passerelle import get_passerelle
from apps.paiements.services import config as config_paiement
from apps.paiements.services import operateurs_actifs

from .models import Infraction, StatutInfraction, TypeInfraction


def types_actifs():
    return TypeInfraction.objects.filter(actif=True)


def _sequence_reference(prefixe: str, champ: str) -> str:
    """Référence lisible et séquentielle : <PREFIXE>-<année>-<6 chiffres>."""
    annee = timezone.now().year
    base = f"{prefixe}-{annee}-"
    with transaction.atomic():
        dernier = (
            Infraction.objects.select_for_update()
            .filter(**{f"{champ}__startswith": base})
            .aggregate(m=Max(champ))["m"]
        )
        suivant = (int(dernier.split("-")[-1]) + 1) if dernier else 1
    return f"{base}{suivant:06d}"


def _notifier(usager, niveau, titre, message, cta_label):
    """Notifie l'usager sans jamais bloquer l'opération métier."""
    try:
        from apps.notifications.services import notifier
        notifier(usager, niveau, titre=titre, message=message,
                 categorie="Amende", lien="/amendes", cta_label=cta_label)
    except Exception:  # noqa: BLE001
        pass


@transaction.atomic
def dresser_infraction(vehicule, *, type_code, lieu="", observations="",
                       agent=None, date=None, request=None):
    """Émet un procès-verbal. Retourne (succès, message, infraction)."""
    type_inf = types_actifs().filter(code=type_code).first()
    if type_inf is None:
        return False, "Type d'infraction invalide ou inactif.", None

    infraction = Infraction.objects.create(
        vehicule=vehicule,
        reference=_sequence_reference("PV", "reference"),
        type_infraction=type_inf,
        libelle=type_inf.libelle,
        montant=type_inf.montant,
        devise=config_paiement().devise,
        lieu=(lieu or "").strip(),
        observations=(observations or "").strip(),
        date_infraction=date or timezone.now(),
        dressee_par=agent,
    )

    log_action("INFRACTION_DRESSEE", user=agent, objet=vehicule, request=request,
               reference=infraction.reference, montant=infraction.montant)

    from apps.notifications.models import NiveauNotification
    _notifier(vehicule.proprietaire, NiveauNotification.ALERTE,
              titre="Amende à régler",
              message=f"{infraction.libelle} — {infraction.montant} {infraction.devise} "
                      f"(PV {infraction.reference}).",
              cta_label="Régler l'amende")

    return True, "Procès-verbal émis.", infraction


@transaction.atomic
def payer_infraction(infraction, *, operateur_code, numero, user=None, request=None):
    """Règle une amende via la passerelle mockée. Retourne (succès, message, infraction)."""
    if infraction.statut == StatutInfraction.PAYEE:
        return False, "Cette amende est déjà réglée.", infraction
    if infraction.statut == StatutInfraction.ANNULEE:
        return False, "Cette amende a été annulée.", infraction

    operateur = operateurs_actifs().filter(code=operateur_code).first()
    if operateur is None:
        return False, "Opérateur de paiement invalide ou indisponible.", None
    if not (numero or "").strip():
        return False, "Le numéro mobile money est obligatoire.", None

    infraction.operateur = operateur.nom
    infraction.code_ussd = operateur.code_ussd
    infraction.numero_telephone = numero.strip()

    ok, ref_txn = get_passerelle().demander_paiement(infraction)
    if not ok:
        return False, "Le paiement a échoué. Réessayez.", infraction

    infraction.statut = StatutInfraction.PAYEE
    infraction.reference_transaction = ref_txn
    infraction.quittance_reference = _sequence_reference("QIT", "quittance_reference")
    infraction.paye_le = timezone.now()
    infraction.save(update_fields=[
        "statut", "operateur", "code_ussd", "numero_telephone",
        "reference_transaction", "quittance_reference", "paye_le", "date_maj",
    ])
    _generer_quittance(infraction)

    log_action("AMENDE_REGLEE", user=user, objet=infraction.vehicule, request=request,
               reference=infraction.reference, montant=infraction.montant)

    from apps.notifications.models import NiveauNotification
    _notifier(infraction.vehicule.proprietaire, NiveauNotification.SUCCES,
              titre="Amende soldée",
              message=f"Paiement de {infraction.montant} {infraction.devise} confirmé "
                      f"(quittance {infraction.quittance_reference}).",
              cta_label="Voir la quittance")

    return True, "Paiement confirmé.", infraction


@transaction.atomic
def contester_infraction(infraction, *, motif, user=None, request=None):
    """L'usager conteste une amende à régler. Retourne (succès, message, infraction)."""
    if infraction.statut != StatutInfraction.A_REGLER:
        return False, "Seule une amende à régler peut être contestée.", infraction
    if not (motif or "").strip():
        return False, "Le motif de contestation est obligatoire.", infraction
    infraction.statut = StatutInfraction.CONTESTEE
    infraction.motif_contestation = motif.strip()
    infraction.save(update_fields=["statut", "motif_contestation", "date_maj"])
    log_action("AMENDE_CONTESTEE", user=user, objet=infraction.vehicule, request=request,
               reference=infraction.reference)
    return True, "Contestation enregistrée.", infraction


@transaction.atomic
def annuler_infraction(infraction, *, motif="", admin=None, request=None):
    """L'administration annule une amende (non réglée). Retourne (succès, message, infraction)."""
    if infraction.statut == StatutInfraction.PAYEE:
        return False, "Une amende réglée ne peut être annulée.", infraction
    infraction.statut = StatutInfraction.ANNULEE
    infraction.motif_annulation = (motif or "").strip()
    infraction.save(update_fields=["statut", "motif_annulation", "date_maj"])
    log_action("AMENDE_ANNULEE", user=admin, objet=infraction.vehicule, request=request,
               reference=infraction.reference, motif=infraction.motif_annulation)
    from apps.notifications.models import NiveauNotification
    _notifier(infraction.vehicule.proprietaire, NiveauNotification.INFO,
              titre="Amende annulée",
              message=f"Le PV {infraction.reference} a été annulé par l'administration.",
              cta_label="Voir mes amendes")
    return True, "Amende annulée.", infraction


@transaction.atomic
def rejeter_contestation(infraction, *, admin=None, request=None):
    """L'administration rejette une contestation : l'amende redevient à régler."""
    if infraction.statut != StatutInfraction.CONTESTEE:
        return False, "Cette amende n'est pas contestée.", infraction
    infraction.statut = StatutInfraction.A_REGLER
    infraction.save(update_fields=["statut", "date_maj"])
    log_action("CONTESTATION_REJETEE", user=admin, objet=infraction.vehicule, request=request,
               reference=infraction.reference)
    from apps.notifications.models import NiveauNotification
    _notifier(infraction.vehicule.proprietaire, NiveauNotification.ACTION,
              titre="Contestation rejetée",
              message=f"Votre contestation du PV {infraction.reference} a été rejetée. "
                      "L'amende reste à régler.",
              cta_label="Régler l'amende")
    return True, "Contestation rejetée.", infraction


def infraction_stats() -> dict:
    payees = Infraction.objects.filter(statut=StatutInfraction.PAYEE)
    return {
        "total": Infraction.objects.count(),
        "a_regler": Infraction.objects.filter(statut=StatutInfraction.A_REGLER).count(),
        "contestees": Infraction.objects.filter(statut=StatutInfraction.CONTESTEE).count(),
        "payees": payees.count(),
        "recettes": payees.aggregate(s=Sum("montant"))["s"] or 0,
        "devise": config_paiement().devise,
    }


def _generer_quittance(infraction):
    from .quittance_pdf import rendre_quittance_pdf
    pdf = rendre_quittance_pdf(infraction)
    infraction.quittance_fichier.save(
        f"quittance-{infraction.quittance_reference}.pdf", ContentFile(pdf), save=True)

"""Services de paiement : configuration, initiation, confirmation (mock), reçu."""
from __future__ import annotations

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.core.services import log_action

from .models import (
    ConfigurationPaiement,
    OperateurPaiement,
    Paiement,
    StatutPaiement,
)
from .passerelle import get_passerelle


def config() -> ConfigurationPaiement:
    return ConfigurationPaiement.actuelle()


def operateurs_actifs():
    return OperateurPaiement.objects.filter(actif=True)


def generer_reference() -> str:
    """Référence lisible et séquentielle : PAY-<année>-<6 chiffres>."""
    annee = timezone.now().year
    prefixe = f"PAY-{annee}-"
    with transaction.atomic():
        dernier = (
            Paiement.objects.select_for_update()
            .filter(reference__startswith=prefixe)
            .aggregate(m=Max("reference"))["m"]
        )
        suivant = (int(dernier.split("-")[-1]) + 1) if dernier else 1
    return f"{prefixe}{suivant:06d}"


def paiement_paye(dossier) -> bool:
    return dossier.paiements.filter(statut=StatutPaiement.PAYE).exists()


def paiement_bloque_certificat(dossier) -> bool:
    """Vrai si la config exige un paiement et qu'aucun n'est réglé."""
    return config().paiement_requis and not paiement_paye(dossier)


@transaction.atomic
def payer(dossier, *, operateur_code: str, numero: str, user=None, request=None):
    """
    Initie puis confirme (passerelle mockée) le règlement de la taxe d'un dossier.
    Retourne (succès, message, paiement).
    """
    if paiement_paye(dossier):
        return False, "La taxe de ce dossier est déjà réglée.", dossier.paiements.filter(
            statut=StatutPaiement.PAYE).first()

    operateur = operateurs_actifs().filter(code=operateur_code).first()
    if operateur is None:
        return False, "Opérateur de paiement invalide ou indisponible.", None
    if not (numero or "").strip():
        return False, "Le numéro mobile money est obligatoire.", None

    cfg = config()
    paiement = Paiement.objects.create(
        dossier=dossier,
        reference=generer_reference(),
        devise=cfg.devise,
        montant_total=cfg.total(),
        detail=cfg.lignes(),
        operateur=operateur.nom,
        code_ussd=operateur.code_ussd,
        numero_telephone=numero.strip(),
        statut=StatutPaiement.EN_ATTENTE,
        initie_par=user,
    )

    ok, ref_txn = get_passerelle().demander_paiement(paiement)
    if not ok:
        paiement.statut = StatutPaiement.ECHOUE
        paiement.save(update_fields=["statut", "date_maj"])
        return False, "Le paiement a échoué. Réessayez.", paiement

    paiement.statut = StatutPaiement.PAYE
    paiement.reference_transaction = ref_txn
    paiement.paye_le = timezone.now()
    paiement.save(update_fields=["statut", "reference_transaction", "paye_le", "date_maj"])

    _generer_recu(paiement)
    log_action("PAIEMENT_REGLE", user=user, objet=dossier, request=request,
               reference=paiement.reference, montant=paiement.montant_total)

    # Notifie l'usager (lien inter-modules).
    try:
        from apps.notifications.models import NiveauNotification
        from apps.notifications.services import notifier
        notifier(dossier.usager, NiveauNotification.SUCCES,
                 titre="Taxe d'immatriculation réglée",
                 message=f"Paiement de {paiement.montant_total} {paiement.devise} confirmé "
                         f"(reçu {paiement.reference}).",
                 categorie="Paiement", lien=f"/dossiers/{dossier.id}/paiement",
                 cta_label="Voir le reçu")
    except Exception:  # noqa: BLE001 — la notification ne doit jamais bloquer le paiement
        pass

    # Délivrance automatique du certificat : régler la taxe d'un dossier immatriculé
    # émet aussitôt le certificat (le paiement débloque et déclenche la délivrance).
    _delivrer_certificat_apres_paiement(dossier, user, request)

    return True, "Paiement confirmé.", paiement


def _delivrer_certificat_apres_paiement(dossier, user, request):
    """Émet le certificat si le dossier est prêt. N'interrompt jamais le paiement."""
    try:
        from apps.dossiers.models import StatutDossier
        if dossier.statut != StatutDossier.IMMATRICULE:
            return
        from apps.certificats.services import emettre_certificat
        emettre_certificat(dossier, user, request=request)
    except Exception:  # noqa: BLE001 — l'émission ne doit jamais faire échouer le paiement
        pass


def _generer_recu(paiement):
    from .recu_pdf import rendre_recu_pdf

    pdf = rendre_recu_pdf(paiement)
    paiement.pdf_fichier.save(f"recu-{paiement.reference}.pdf", ContentFile(pdf), save=True)

"""
Services notifications : création d'une notification et calcul des échéances.

`notifier()` est appelé par les services métier (validation, immatriculation,
certificat…). `echeances_pour()` calcule en direct les prochaines échéances
(assurance, contrôle technique, certificat) d'un usager — utilisé à la fois par
l'écran d'alertes et par la commande de génération des relances.
"""
from __future__ import annotations

from datetime import date

from django.utils import timezone

from .models import DELAIS_DEFAUT, NiveauNotification, Notification, PreferencesNotification

# Seuils (jours restants) → niveau de couleur de l'échéance.
SEUIL_ROUGE = 15
SEUIL_AMBRE = 45


def notifier(destinataire, niveau, titre, *, message="", categorie="", lien="", cta_label="",
             cle_unicite=""):
    """
    Crée une notification. Si `cle_unicite` est fournie, la notification n'est
    créée qu'une seule fois (idempotence des alertes d'échéance).
    """
    if destinataire is None:
        return None
    if cle_unicite and Notification.objects.filter(
        destinataire=destinataire, cle_unicite=cle_unicite
    ).exists():
        return None
    return Notification.objects.create(
        destinataire=destinataire, niveau=niveau, titre=titre, message=message,
        categorie=categorie, lien=lien, cta_label=cta_label, cle_unicite=cle_unicite,
    )


def _niveau_echeance(jours: int) -> str:
    if jours <= SEUIL_ROUGE:
        return NiveauNotification.ALERTE
    if jours <= SEUIL_AMBRE:
        return NiveauNotification.ACTION
    return NiveauNotification.SUCCES


def _echeance_doc(dossier, type_document, categorie, label):
    doc = (
        dossier.documents.filter(type_document=type_document, date_fin__isnull=False)
        .order_by("-date_fin")
        .first()
    )
    if not doc or not doc.date_fin:
        return None
    return {
        "categorie": categorie,
        "label": label,
        "immatriculation": _immat(dossier),
        "echeance": doc.date_fin,
        "jours_restants": (doc.date_fin - date.today()).days,
        "lien": f"/dossiers/{dossier.id}",
    }


def _immat(dossier) -> str | None:
    immat = getattr(dossier.vehicule, "immatriculation", None)
    return immat.numero if immat else None


def echeances_pour(user) -> list[dict]:
    """
    Prochaines échéances de l'usager (assurance, contrôle technique, certificat),
    triées de la plus urgente à la plus lointaine. `niveau` code la couleur.
    """
    from apps.certificats.models import Certificat  # import local (évite un cycle)
    from apps.dossiers.models import StatutDossier, TypeDocument

    items: list[dict] = []
    dossiers = (
        user.dossiers.filter(statut__in=[StatutDossier.IMMATRICULE, StatutDossier.CERTIFIE])
        .select_related("vehicule")
        .prefetch_related("documents")
    )
    for dossier in dossiers:
        for it in (
            _echeance_doc(dossier, TypeDocument.ASSURANCE, "ASSURANCE", "Assurance"),
            _echeance_doc(dossier, TypeDocument.CONTROLE_TECHNIQUE, "CT", "Contrôle technique"),
        ):
            if it:
                items.append(it)

        cert = (
            Certificat.objects.filter(dossier=dossier).order_by("-date_emission").first()
        )
        if cert and cert.date_expiration:
            ech = cert.date_expiration.date()
            items.append({
                "categorie": "CERTIFICAT",
                "label": "Certificat",
                "immatriculation": _immat(dossier),
                "echeance": ech,
                "jours_restants": (ech - date.today()).days,
                "lien": f"/dossiers/{dossier.id}",
            })

    for it in items:
        it["niveau"] = _niveau_echeance(it["jours_restants"])
    items.sort(key=lambda x: x["jours_restants"])
    return items


def generer_relances(user=None) -> int:
    """
    Génère les notifications d'alerte pour les échéances qui entrent dans les
    délais de relance de chaque usager. Idempotent (via `cle_unicite`).
    Retourne le nombre de notifications créées.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()
    cibles = [user] if user is not None else User.objects.filter(role="USAGER")
    crees = 0
    for u in cibles:
        prefs = PreferencesNotification.pour(u)
        delais = sorted(prefs.delais_relance or DELAIS_DEFAUT, reverse=True)
        for ech in echeances_pour(u):
            jours = ech["jours_restants"]
            # Le plus petit délai franchi (ex. 12 j restants → palier 15 j).
            palier = next((d for d in delais if jours <= d), None)
            if palier is None or jours < 0:
                continue
            cle = f"echeance:{ech['categorie']}:{ech['immatriculation']}:{palier}"
            n = notifier(
                u, NiveauNotification.ALERTE,
                titre=f"{ech['label']} expire bientôt",
                message=(
                    f"{ech['label']} du véhicule {ech['immatriculation'] or ''} "
                    f"expire le {ech['echeance'].strftime('%d/%m/%Y')} "
                    f"(dans {jours} jour{'s' if jours > 1 else ''})."
                ).strip(),
                categorie="Alerte d'échéance",
                lien=ech["lien"],
                cta_label="Voir le dossier",
                cle_unicite=cle,
            )
            if n:
                crees += 1
    return crees


def compter_non_lues(user) -> int:
    return Notification.objects.filter(destinataire=user, lu=False).count()


def maintenant():
    return timezone.now()

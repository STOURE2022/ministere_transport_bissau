"""
Dossier de vie du véhicule (étape 8 — archivage).

Agrège en une frise chronologique tous les événements déjà tracés par les
différents modules : création du dossier, dépôt des pièces, vérification
automatique, décisions d'agent, immatriculation, certificat, contrôles routiers
(ScanLog) et signalements. Aucune donnée nouvelle n'est stockée ici — c'est une
lecture transversale.
"""
from __future__ import annotations

from django.utils import timezone

from .models import StatutDossier

# Catégorie de filtrage (front) par type d'événement.
CATEGORIE = {
    "CREATION": "Traitement",
    "PIECES": "Traitement",
    "VERIFICATION": "Traitement",
    "VALIDATION": "Traitement",
    "REJET": "Traitement",
    "COMPLEMENT": "Traitement",
    "IMMATRICULATION": "Traitement",
    "ARCHIVAGE": "Traitement",
    "CERTIFICAT": "Certificat",
    "CERTIFICAT_REVOQUE": "Certificat",
    "CONTROLE": "Contrôles",
    "SIGNALEMENT": "Sécurité",
    "SIGNALEMENT_LEVE": "Sécurité",
    "INFRACTION": "Infractions",
}

_ROLE_LIBELLE = {
    "USAGER": "usager",
    "AGENT": "agent",
    "ADMIN": "admin",
    "FORCE_ORDRE": "forces de l'ordre",
}


def _acteur(user) -> str | None:
    if user is None:
        return None
    role = _ROLE_LIBELLE.get(getattr(user, "role", ""), "")
    nom = f"{user.prenom} {user.nom}".strip()
    return f"{nom} ({role})" if role else nom


def construire_historique(dossier) -> dict:
    from apps.certificats.models import Certificat

    v = dossier.vehicule
    evenements: list[dict] = []

    def ajouter(type_, titre, date, *, description="", acteur=None, tag="", tag_niveau=""):
        if date is None:
            return
        evenements.append({
            "type": type_,
            "categorie": CATEGORIE.get(type_, "Traitement"),
            "titre": titre,
            "description": description,
            "acteur": acteur,
            "date": date,
            "tag": tag,
            "tag_niveau": tag_niveau,
        })

    # 1. Création
    ajouter("CREATION", "Dossier créé", dossier.date_creation,
            description=f"Enregistrement du dossier {dossier.numero_dossier}.",
            acteur=_acteur(dossier.usager))

    # 2. Pièces déposées (regroupées)
    docs = list(dossier.documents.all())
    if docs:
        premiere = min(d.date_creation for d in docs)
        libelles = ", ".join(sorted({d.get_type_document_display() for d in docs}))
        ajouter("PIECES", f"{len(docs)} pièce(s) déposée(s)", premiere,
                description=libelles)

    # 3. Vérification automatique
    verif = getattr(dossier, "verification", None)
    if verif is not None:
        niveau = {"FAIBLE": "success", "MOYEN": "warning", "ELEVE": "danger"}.get(
            verif.niveau_risque, "success")
        ajouter("VERIFICATION", "Vérification automatique", verif.date_creation,
                description="VIN, assurance et contrôle technique contrôlés.",
                tag=f"Risque {verif.get_niveau_risque_display().lower()}", tag_niveau=niveau)

    # 4. Décisions d'agent
    for d in dossier.validations.all():
        if d.action == "VALIDE":
            ajouter("VALIDATION", "Validé par l'agent", d.date_creation,
                    description=d.commentaire, acteur=_acteur(d.agent))
        elif d.action == "REJETE":
            ajouter("REJET", "Dossier rejeté", d.date_creation,
                    description=d.commentaire, acteur=_acteur(d.agent),
                    tag="Rejet", tag_niveau="danger")
        else:
            ajouter("COMPLEMENT", "Complément demandé", d.date_creation,
                    description=d.commentaire, acteur=_acteur(d.agent),
                    tag="Action requise", tag_niveau="warning")

    # 5. Immatriculation
    immat = getattr(v, "immatriculation", None)
    if immat is not None:
        ajouter("IMMATRICULATION", "Immatriculation attribuée", immat.date_attribution,
                description=f"Numéro {immat.numero} · série {immat.serie_plaque}.",
                acteur=_acteur(immat.agent))

    # 6. Certificat + contrôles
    cert = Certificat.objects.filter(dossier=dossier).order_by("date_emission").first()
    if cert is not None:
        ajouter("CERTIFICAT", "Certificat émis", cert.date_emission,
                description=f"Valable jusqu'au {cert.date_expiration.date().isoformat()} "
                            "· empreinte SHA-256 signée (RSA-2048).",
                tag="QR", tag_niveau="gold")
        if cert.statut == "REVOQUE":
            ajouter("CERTIFICAT_REVOQUE", "Certificat révoqué", cert.date_maj,
                    description=cert.motif_revocation, tag="Révoqué", tag_niveau="danger")
        for scan in cert.scans.all():
            lieu = scan.localisation or "lieu non précisé"
            methode = "QR" if scan.methode == "QR" else "plaque"
            niveau = "success" if scan.resultat == "AUTHENTIQUE" else "danger"
            ajouter("CONTROLE", f"Contrôle routier · {lieu}", scan.date_scan,
                    description=f"Vérification par {methode} par les forces de l'ordre.",
                    tag=scan.get_resultat_display(), tag_niveau=niveau)

    # 7. Signalements
    for sig in v.signalements.all():
        ajouter("SIGNALEMENT", sig.get_type_display(), sig.date_signalement,
                description=sig.motif, acteur=_acteur(sig.signale_par),
                tag="Actif" if sig.statut == "ACTIF" else "Levé",
                tag_niveau="danger" if sig.statut == "ACTIF" else "success")
        if sig.statut == "LEVE" and sig.date_levee:
            ajouter("SIGNALEMENT_LEVE", "Signalement levé", sig.date_levee,
                    description=sig.motif_levee, acteur=_acteur(sig.leve_par),
                    tag="Levé", tag_niveau="success")

    # 8. Infractions / amendes (procès-verbaux)
    _TAG_INFRACTION = {
        "A_REGLER": ("À régler", "danger"),
        "CONTESTEE": ("Contestée", "warning"),
        "PAYEE": ("Soldée", "success"),
        "ANNULEE": ("Annulée", ""),
    }
    for inf in v.infractions.all():
        tag, niveau = _TAG_INFRACTION.get(inf.statut, ("", ""))
        lieu = inf.lieu or "lieu non précisé"
        ajouter("INFRACTION", f"PV · {inf.libelle}", inf.date_infraction,
                description=f"{inf.montant} {inf.devise} · {lieu} (PV {inf.reference}).",
                acteur=_acteur(inf.dressee_par), tag=tag, tag_niveau=niveau)

    # 9. Archivage
    if dossier.statut == StatutDossier.ARCHIVE:
        ajouter("ARCHIVAGE", "Dossier archivé", dossier.date_maj,
                description="Le dossier de vie a été figé (consultable, non modifiable).")

    evenements.sort(key=lambda e: e["date"])

    controles = [e for e in evenements if e["type"] == "CONTROLE"]
    signalements = [e for e in evenements if e["type"] == "SIGNALEMENT"]
    premier = evenements[0]["date"] if evenements else None
    anciennete = (timezone.now() - premier).days // 30 if premier else 0

    resume = {
        "statut": dossier.statut,
        "statut_libelle": dossier.get_statut_display(),
        "evenements": len(evenements),
        "controles": len(controles),
        "controles_authentiques": sum(1 for e in controles if e["tag_niveau"] == "success"),
        "signalements_actifs": sum(1 for e in signalements if e["tag"] == "Actif"),
        "signalements_leves": sum(1 for e in signalements if e["tag"] == "Levé"),
        "certificat_actif": bool(cert and cert.statut == "ACTIF"),
        "premier_evenement": premier,
        "dernier_controle": controles[-1]["date"] if controles else None,
        "anciennete_mois": anciennete,
    }

    return {
        "dossier": {
            "id": str(dossier.id),
            "numero_dossier": dossier.numero_dossier,
            "statut": dossier.statut,
            "statut_libelle": dossier.get_statut_display(),
        },
        "vehicule": {
            "vin": v.vin,
            "marque": v.marque,
            "modele": v.modele,
            "annee": v.annee,
            "energie": v.get_energie_display(),
            "immatriculation": immat.numero if immat else None,
            "titulaire": _nom(dossier.usager),
        },
        "certificat": (
            {"statut": cert.statut, "date_expiration": cert.date_expiration}
            if cert else None
        ),
        "immatricule_le": immat.date_attribution if immat else None,
        "resume": resume,
        "evenements": evenements,
    }


def _nom(user) -> str:
    return f"{user.prenom} {user.nom}".strip() if user else "—"

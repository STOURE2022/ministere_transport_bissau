"""
Jeu de données de démonstration SNICV.

Crée les comptes des 4 rôles et un parcours réaliste : des dossiers à chaque
étape du cycle + un véhicule entièrement certifié (QR scannable) prêt pour une
présentation. Idempotent : relançable, `--reset` régénère les dossiers de démo.

    python manage.py seed_demo
    python manage.py seed_demo --reset
"""
from __future__ import annotations

import datetime

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.certificats.services import emettre_certificat
from apps.dossiers.models import Document, Dossier, TypeDocument, Vehicule
from apps.dossiers.services import generer_numero_dossier, soumettre_dossier
from apps.immatriculations.services import attribuer_immatriculation
from apps.notifications.services import generer_relances
from apps.paiements.services import payer
from apps.signalements.models import TypeSignalement
from apps.signalements.services import signaler_vehicule
from apps.validations.services import valider_dossier
from apps.verifications.services import lancer_verification

MDP = "Demo1234!"

COMPTES = [
    ("admin@snicv.gw", "ADMIN", "Sissoko", "Amadú", "+245955000100"),
    ("agent@snicv.gw", "AGENT", "Sanhá", "Ansumane", "+245955000101"),
    ("police@snicv.gw", "FORCE_ORDRE", "Djaló", "Bacar", "+245955000102"),
    ("fatumata@exemplo.gw", "USAGER", "Djaló", "Fatumata", "+245955000103"),
    ("idrissa@exemplo.gw", "USAGER", "Baldé", "Idrissa", "+245955000104"),
]

# (vin, marque, modèle, année, énergie, type, cible_statut)
# CERTIFIE_VOLE : véhicule certifié PUIS signalé volé (démo de l'alerte au contrôle).
VEHICULES = [
    ("VF1RFB00X66512345", "Toyota", "Hilux", 2019, "DIESEL", "UTILITAIRE", "CERTIFIE"),
    ("JN1TANT31U0123456", "Nissan", "Navara", 2017, "DIESEL", "UTILITAIRE", "CERTIFIE_VOLE"),
    ("MD2A21CY7MWK12345", "Yamaha", "Crux", 2022, "ESSENCE", "MOTO", "CERTIFIE"),
    ("VF3CCHMZ6GT024518", "Peugeot", "208", 2016, "ESSENCE", "VP", "EN_VALIDATION"),
    ("MALA851CLMM298471", "Hyundai", "Grand i10", 2021, "ESSENCE", "VP", "EN_VALIDATION"),
    ("WDB9066331S123456", "Mercedes", "Sprinter", 2015, "DIESEL", "UTILITAIRE", "VALIDE"),
    ("KNADE512BM6789012", "Kia", "Picanto", 2022, "ESSENCE", "VP", "IMMATRICULE"),
    ("VF1FW51J158796421", "Renault", "Kangoo", 2018, "DIESEL", "UTILITAIRE", "BROUILLON"),
]


def _pdf(nom: str) -> SimpleUploadedFile:
    return SimpleUploadedFile(nom, b"%PDF-1.4 SNICV demo", content_type="application/pdf")


class Command(BaseCommand):
    help = "Crée un jeu de données de démonstration (comptes + parcours + véhicule certifié)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
                            help="Supprime les dossiers de démo avant de les recréer.")

    @transaction.atomic
    def handle(self, *args, **options):
        comptes = self._comptes()
        agent = comptes["agent@snicv.gw"]
        usagers = [comptes["fatumata@exemplo.gw"], comptes["idrissa@exemplo.gw"]]

        if options["reset"]:
            n, _ = Vehicule.objects.filter(proprietaire__in=usagers).delete()
            self.stdout.write(self.style.WARNING(f"Réinitialisation : {n} objets supprimés."))

        if Dossier.objects.filter(usager__in=usagers).exists():
            self.stdout.write(self.style.WARNING(
                "Des dossiers de démo existent déjà. Utilisez --reset pour les régénérer."))
            self._resume(comptes, None, None)
            return

        cert_plaque = vole_plaque = moto_plaque = None
        force = comptes["police@snicv.gw"]
        for i, (vin, marque, modele, annee, energie, type_v, cible) in enumerate(VEHICULES):
            usager = usagers[i % len(usagers)]
            veh = self._construire(usager, agent, vin, marque, modele, annee, energie, type_v, cible)
            plaque = getattr(getattr(veh, "immatriculation", None), "numero", None)
            if type_v == "MOTO":
                moto_plaque = plaque
            elif cible == "CERTIFIE":
                cert_plaque = plaque
            elif cible == "CERTIFIE_VOLE":
                signaler_vehicule(veh, force, type=TypeSignalement.VOLE, reference="PV-2026-0142",
                                  motif="Véhicule déclaré volé à Bissau (démonstration).")
                vole_plaque = plaque

        # Échéances proches pour illustrer les alertes (assurance ~12 j, CT ~28 j).
        self._rapprocher_echeances(usagers)
        generer_relances()

        # Paiement de démo (visible par l'agent / l'admin).
        self._payer_demo(usagers)

        # Procès-verbaux de démo (amende à régler + amende soldée).
        self._verbaliser_demo(usagers, force)

        self._resume(comptes, cert_plaque, vole_plaque, moto_plaque)

    def _verbaliser_demo(self, usagers, force):
        """Dresse deux PV sur un véhicule immatriculé : un à régler, un soldé."""
        from apps.infractions.services import dresser_infraction, payer_infraction

        veh = (
            Vehicule.objects.filter(proprietaire__in=usagers, immatriculation__isnull=False)
            .order_by("date_creation")
            .first()
        )
        if not veh or veh.infractions.exists():
            return
        dresser_infraction(veh, type_code="EXCES_VITESSE",
                           lieu="Avenida Amílcar Cabral, Bissau", agent=force)
        _, _, inf = dresser_infraction(veh, type_code="STATIONNEMENT",
                                       lieu="Mercado de Bandim, Bissau", agent=force)
        if inf:
            payer_infraction(inf, operateur_code="ORANGE", numero="95 500 01 03",
                             user=veh.proprietaire)

    def _payer_demo(self, usagers):
        """Règle la taxe d'un dossier certifié pour peupler la liste des paiements."""
        dossier = (
            Dossier.objects.filter(usager__in=usagers, statut="CERTIFIE")
            .order_by("date_creation")
            .first()
        )
        if dossier and not dossier.paiements.exists():
            payer(dossier, operateur_code="ORANGE", numero="95 500 01 03", user=dossier.usager)

    def _rapprocher_echeances(self, usagers):
        """Rapproche l'assurance/le contrôle technique d'un dossier certifié
        pour que l'écran d'alertes affiche des échéances rouge/ambre en démo."""
        today = datetime.date.today()
        dossier = (
            Dossier.objects.filter(usager__in=usagers, statut="CERTIFIE")
            .order_by("date_creation")
            .first()
        )
        if not dossier:
            return
        Document.objects.filter(dossier=dossier, type_document=TypeDocument.ASSURANCE).update(
            date_fin=today + datetime.timedelta(days=12))
        Document.objects.filter(dossier=dossier, type_document=TypeDocument.CONTROLE_TECHNIQUE).update(
            date_fin=today + datetime.timedelta(days=28))

    # ── création des comptes ──
    def _comptes(self) -> dict[str, User]:
        out = {}
        for email, role, nom, prenom, tel in COMPTES:
            user, created = User.objects.get_or_create(
                email=email,
                defaults=dict(role=role, nom=nom, prenom=prenom, telephone=tel,
                              is_active=True, is_email_verifie=True),
            )
            if created:
                user.set_password(MDP)
                user.save()
            out[email] = user
        return out

    # ── construit un dossier jusqu'au statut cible ──
    def _construire(self, usager, agent, vin, marque, modele, annee, energie, type_v, cible):
        veh = Vehicule.objects.create(
            proprietaire=usager, vin=vin, marque=marque, modele=modele,
            annee=annee, energie=energie, type_vehicule=type_v,
        )
        dossier = Dossier.objects.create(
            usager=usager, vehicule=veh, numero_dossier=generer_numero_dossier())

        # Pièces (assurance + CT valides dans le futur, facture).
        futur = datetime.date.today() + datetime.timedelta(days=210)
        passe = datetime.date.today() - datetime.timedelta(days=120)
        Document.objects.create(dossier=dossier, type_document=TypeDocument.ASSURANCE,
                                fichier=_pdf("assurance.pdf"), date_debut=passe, date_fin=futur)
        Document.objects.create(dossier=dossier, type_document=TypeDocument.CONTROLE_TECHNIQUE,
                                fichier=_pdf("ct.pdf"), date_debut=passe, date_fin=futur)
        Document.objects.create(dossier=dossier, type_document=TypeDocument.FACTURE,
                                fichier=_pdf("facture.pdf"), date_debut=passe)

        if cible == "BROUILLON":
            return veh

        # Soumission + vérification automatique.
        soumettre_dossier(dossier)
        lancer_verification(dossier)
        dossier.refresh_from_db()
        if cible == "EN_VALIDATION":
            return veh

        valider_dossier(dossier, agent, "Dossier conforme — pièces vérifiées.")
        dossier.refresh_from_db()
        if cible == "VALIDE":
            return veh

        attribuer_immatriculation(dossier, agent)
        dossier.refresh_from_db()
        if cible == "IMMATRICULE":
            return veh

        # CERTIFIE et CERTIFIE_VOLE : le règlement de la taxe délivre
        # automatiquement le certificat (le paiement est requis).
        from apps.paiements.services import payer
        payer(dossier, operateur_code="ORANGE", numero="95 500 01 03", user=dossier.usager)
        dossier.refresh_from_db()
        veh.refresh_from_db()
        return veh

    # ── résumé lisible ──
    def _resume(self, comptes, cert_plaque, vole_plaque, moto_plaque=None):
        w = self.stdout.write
        w("")
        w(self.style.SUCCESS("=== Donnees de demonstration SNICV pretes ==="))
        w("")
        w("Comptes (mot de passe commun : " + self.style.SUCCESS(MDP) + ")")
        for email, role, nom, prenom, _tel in COMPTES:
            w(f"  - {role:<12} {prenom} {nom:<10} -> {email}")
        w("")
        if cert_plaque:
            w("Vehicule CERTIFIE authentique (espace forces de l'ordre) :")
            w(self.style.SUCCESS(f"  Plaque : {cert_plaque}"))
        if moto_plaque:
            w("Moto CERTIFIEE (plaque carree jaune, format moto) :")
            w(self.style.SUCCESS(f"  Plaque : {moto_plaque}"))
        if vole_plaque:
            w("Vehicule certifie MAIS SIGNALE VOLE (alerte au controle) :")
            w(self.style.ERROR(f"  Plaque : {vole_plaque}"))
        w("  -> police@snicv.gw -> Controle -> Rechercher par immatriculation.")
        w("")
        w("File de validation (espace agent) : dossiers en attente a chaque etape.")
        w("")

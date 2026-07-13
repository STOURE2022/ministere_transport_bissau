"""Tests des notifications : création via cycle de vie, échéances, endpoints, préférences."""
import datetime

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.dossiers.models import Document, Dossier, StatutDossier, TypeDocument, Vehicule
from apps.validations.services import valider_dossier

from .models import NiveauNotification, Notification, PreferencesNotification
from .services import echeances_pour, generer_relances, notifier


def creer_user(email, role="USAGER", tel="+24570000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Nom", prenom="Prenom",
        password="pass1234", role=role, is_active=True,
    )


class NotificationBase(APITestCase):
    def setUp(self):
        self.usager = creer_user("usager@ex.gw")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+24570000003")

    def _dossier(self, statut=StatutDossier.EN_VALIDATION, vin="VF1RFB00X67891234"):
        veh = Vehicule.objects.create(
            proprietaire=self.usager, vin=vin, marque="Toyota", modele="Corolla",
            annee=2019, energie="ESSENCE", type_vehicule="VP",
        )
        return Dossier.objects.create(
            usager=self.usager, vehicule=veh, statut=statut,
            numero_dossier=f"SNICV-2026-{Dossier.objects.count() + 1:06d}",
        )


class CreationTests(NotificationBase):
    def test_notifier_cree_une_notification(self):
        notifier(self.usager, NiveauNotification.INFO, titre="Bonjour", categorie="Test")
        self.assertEqual(Notification.objects.filter(destinataire=self.usager).count(), 1)

    def test_cle_unicite_empeche_les_doublons(self):
        for _ in range(3):
            notifier(self.usager, NiveauNotification.ALERTE, titre="X", cle_unicite="echeance:A:1:7")
        self.assertEqual(Notification.objects.filter(destinataire=self.usager).count(), 1)

    def test_validation_dossier_notifie_lusager(self):
        dossier = self._dossier()
        valider_dossier(dossier, self.agent, "OK")
        notif = Notification.objects.filter(destinataire=self.usager).first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.niveau, NiveauNotification.SUCCES)
        self.assertIn(dossier.numero_dossier, notif.message)


class EcheancesTests(NotificationBase):
    def _dossier_certifie_avec_echeances(self, jours_assurance):
        dossier = self._dossier(statut=StatutDossier.CERTIFIE)
        # Une immatriculation est nécessaire pour afficher la plaque de l'échéance.
        from apps.immatriculations.models import Immatriculation
        Immatriculation.objects.create(
            vehicule=dossier.vehicule, numero="AA 0001 BS", serie_plaque="AA", sequence=1,
        )
        Document.objects.create(
            dossier=dossier, type_document=TypeDocument.ASSURANCE,
            date_fin=datetime.date.today() + datetime.timedelta(days=jours_assurance),
        )
        return dossier

    def test_echeance_proche_est_niveau_alerte(self):
        self._dossier_certifie_avec_echeances(jours_assurance=10)
        items = echeances_pour(self.usager)
        assurance = next(i for i in items if i["categorie"] == "ASSURANCE")
        self.assertEqual(assurance["niveau"], NiveauNotification.ALERTE)
        self.assertEqual(assurance["jours_restants"], 10)

    def test_generer_relances_cree_une_alerte(self):
        self._dossier_certifie_avec_echeances(jours_assurance=10)
        crees = generer_relances(self.usager)
        self.assertGreaterEqual(crees, 1)
        # Idempotent : un second passage ne recrée rien.
        self.assertEqual(generer_relances(self.usager), 0)


class EndpointsTests(NotificationBase):
    def test_liste_et_filtres(self):
        notifier(self.usager, NiveauNotification.NEUTRE, titre="Lu")
        notifier(self.usager, NiveauNotification.ALERTE, titre="Alerte")
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:notifications:liste"))
        self.assertEqual(resp.data["count"], 2)
        resp = self.client.get(reverse("v1:notifications:liste"), {"filtre": "alertes"})
        self.assertEqual(resp.data["count"], 1)

    def test_compteur_non_lues(self):
        notifier(self.usager, NiveauNotification.ALERTE, titre="A")
        notifier(self.usager, NiveauNotification.INFO, titre="B")
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:notifications:compteur"))
        self.assertEqual(resp.data["non_lues"], 2)
        self.assertEqual(resp.data["alertes"], 1)

    def test_marquer_lu_et_tout_lu(self):
        n = notifier(self.usager, NiveauNotification.INFO, titre="A")
        notifier(self.usager, NiveauNotification.INFO, titre="B")
        self.client.force_authenticate(self.usager)
        self.client.post(reverse("v1:notifications:marquer-lu", args=[n.id]))
        self.assertTrue(Notification.objects.get(pk=n.id).lu)
        self.client.post(reverse("v1:notifications:tout-lu"))
        self.assertEqual(Notification.objects.filter(destinataire=self.usager, lu=False).count(), 0)

    def test_ne_voit_pas_les_notifications_dautrui(self):
        autre = creer_user("autre@ex.gw", tel="+24570000009")
        notifier(autre, NiveauNotification.INFO, titre="Privé")
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:notifications:liste"))
        self.assertEqual(resp.data["count"], 0)

    def test_preferences_get_et_put(self):
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:notifications:preferences"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["canal_email"])
        resp = self.client.put(
            reverse("v1:notifications:preferences"),
            {"canal_sms": False, "delais_relance": [30, 7, 999]}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["canal_sms"])
        self.assertEqual(resp.data["delais_relance"], [30, 7])  # 999 filtré
        prefs = PreferencesNotification.objects.get(utilisateur=self.usager)
        self.assertFalse(prefs.canal_sms)

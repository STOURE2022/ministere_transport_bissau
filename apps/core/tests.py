"""Tests du tableau de bord de pilotage (statistiques nationales)."""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User


def creer_user(email, role="USAGER", tel="+245955000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Té", prenom="Ana",
        password="pass1234", role=role, is_active=True,
    )


class DashboardStatsTests(APITestCase):
    def setUp(self):
        self.usager = creer_user("u@ex.gw")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+245955000003")
        self.admin = creer_user("admin@snicv.gw", role="ADMIN", tel="+245955000004")
        self.force = creer_user("police@snicv.gw", role="FORCE_ORDRE", tel="+245955000005")
        self.url = reverse("v1:core:stats-dashboard")

    def test_admin_acces_et_cles(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for cle in ("vehicules", "certificats_actifs", "signalements_actifs",
                    "controles_total", "taux_fraude", "dossiers_par_statut",
                    "certificats_par_mois", "repartition_type"):
            self.assertIn(cle, resp.data)
        self.assertEqual(len(resp.data["certificats_par_mois"]), 6)

    def test_agent_autorise(self):
        self.client.force_authenticate(self.agent)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)

    def test_usager_refuse(self):
        self.client.force_authenticate(self.usager)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_force_ordre_refuse(self):
        self.client.force_authenticate(self.force)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)


class PublicStatsTests(APITestCase):
    def test_acces_public_sans_auth(self):
        resp = self.client.get(reverse("v1:core:stats-public"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for cle in ("vehicules", "immatriculations", "certificats_actifs",
                    "controles_total", "regions"):
            self.assertIn(cle, resp.data)
        self.assertEqual(resp.data["regions"], 9)

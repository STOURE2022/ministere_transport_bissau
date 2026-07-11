"""Tests de l'app comptes : inscription, OTP, connexion, profil."""
import re

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import OTPCode, User
from .notifications import MockBackend

CODE_RE = re.compile(r"est (\d+)\.")

# En test on garde l'OTP en mémoire (mock). Le throttling s'appuie sur le
# cache : on le vide en setUp pour isoler chaque test. NB : DRF lie
# `throttle_classes` à l'import, donc override_settings(REST_FRAMEWORK=…) ne
# le désactive pas — on gère l'isolement via le cache.
TEST_SETTINGS = dict(OTP_BACKEND="mock")


def _dernier_code():
    """Extrait le dernier code OTP en clair capté par le MockBackend."""
    msg = MockBackend.sent[-1]["message"]
    return CODE_RE.search(msg).group(1)


@override_settings(**TEST_SETTINGS)
class InscriptionOTPTests(APITestCase):
    def setUp(self):
        MockBackend.reset()
        cache.clear()
        self.payload = {
            "email": "usager@example.gw",
            "telephone": "+24570000001",
            "nom": "Koné",
            "prenom": "Fatoumata",
            "password": "MotDePasse123!",
            "password2": "MotDePasse123!",
        }

    def test_inscription_cree_compte_inactif_et_envoie_otp(self):
        resp = self.client.post(reverse("v1:accounts:register"), self.payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email="usager@example.gw")
        self.assertFalse(user.is_active)               # inactif tant que non vérifié
        self.assertEqual(user.role, "USAGER")
        self.assertEqual(len(MockBackend.sent), 1)     # un SMS envoyé
        self.assertEqual(MockBackend.sent[0]["canal"], "SMS")

    def test_mots_de_passe_differents_rejetes(self):
        payload = {**self.payload, "password2": "Autre123!"}
        resp = self.client.post(reverse("v1:accounts:register"), payload)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="usager@example.gw").exists())

    def test_verification_otp_active_le_compte(self):
        self.client.post(reverse("v1:accounts:register"), self.payload)
        code = _dernier_code()

        resp = self.client.post(reverse("v1:accounts:verify-otp"), {
            "email": "usager@example.gw", "code": code, "canal": "SMS",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        user = User.objects.get(email="usager@example.gw")
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_telephone_verifie)

    def test_code_incorrect_rejete(self):
        self.client.post(reverse("v1:accounts:register"), self.payload)
        resp = self.client.post(reverse("v1:accounts:verify-otp"), {
            "email": "usager@example.gw", "code": "000000", "canal": "SMS",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.get(email="usager@example.gw").is_active)

    def test_blocage_apres_max_tentatives(self):
        self.client.post(reverse("v1:accounts:register"), self.payload)
        for _ in range(OTPCode.MAX_TENTATIVES):
            self.client.post(reverse("v1:accounts:verify-otp"), {
                "email": "usager@example.gw", "code": "111111", "canal": "SMS",
            })
        # On isole ici le verrou applicatif (5 tentatives max en base) du
        # rate-limit réseau : on vide le cache de throttling avant l'appel final.
        cache.clear()
        # Même avec le bon code, le code actif est désormais bloqué.
        code = _dernier_code()
        resp = self.client.post(reverse("v1:accounts:verify-otp"), {
            "email": "usager@example.gw", "code": code, "canal": "SMS",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(**TEST_SETTINGS)
class ConnexionTests(APITestCase):
    def setUp(self):
        MockBackend.reset()
        cache.clear()
        self.password = "MotDePasse123!"
        self.user = User.objects.create_user(
            email="agent@snicv.gw", telephone="+24570000009",
            nom="Diarra", prenom="Awa", password=self.password,
            role="AGENT", is_active=True, is_email_verifie=True,
        )

    def test_connexion_retourne_tokens_et_role(self):
        resp = self.client.post(reverse("v1:accounts:login"), {
            "email": "agent@snicv.gw", "password": self.password,
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertEqual(resp.data["user"]["role"], "AGENT")

    def test_compte_inactif_ne_peut_pas_se_connecter(self):
        User.objects.create_user(
            email="inactif@example.gw", telephone="+24570000010",
            nom="X", prenom="Y", password=self.password, is_active=False,
        )
        resp = self.client.post(reverse("v1:accounts:login"), {
            "email": "inactif@example.gw", "password": self.password,
        })
        # Le backend d'auth Django refuse un compte is_active=False → 401.
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requiert_authentification(self):
        resp = self.client.get(reverse("v1:accounts:me"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_retourne_profil_connecte(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get(reverse("v1:accounts:me"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"], "agent@snicv.gw")
        self.assertEqual(resp.data["role"], "AGENT")

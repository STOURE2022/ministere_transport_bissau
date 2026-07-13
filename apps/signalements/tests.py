"""Tests des signalements de véhicules et de l'alerte au contrôle."""
import datetime
import shutil
import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.certificats import crypto
from apps.certificats.models import Certificat
from apps.dossiers.models import Document, Dossier, StatutDossier, TypeDocument, Vehicule
from apps.immatriculations.models import Immatriculation

from .models import Signalement, StatutSignalement

MEDIA_TMP = tempfile.mkdtemp()
KEYS_TMP = tempfile.mkdtemp()


def creer_user(email, role="USAGER", tel="+245955000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Té", prenom="Ana",
        password="pass1234", role=role, is_active=True,
    )


@override_settings(
    MEDIA_ROOT=MEDIA_TMP,
    SNICV_PRIVATE_KEY_PATH=f"{KEYS_TMP}/private.pem",
    SNICV_PUBLIC_KEY_PATH=f"{KEYS_TMP}/public.pem",
)
class SignalementBase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        shutil.rmtree(KEYS_TMP, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        crypto.generer_paire_cles()
        cache.clear()
        # Émission de certificat de test sans passer par le paiement de la taxe.
        from apps.paiements.models import ConfigurationPaiement
        cfg = ConfigurationPaiement.actuelle()
        cfg.paiement_requis = False
        cfg.save(update_fields=["paiement_requis"])
        self.usager = creer_user("u@ex.gw")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+245955000003")
        self.admin = creer_user("admin@snicv.gw", role="ADMIN", tel="+245955000004")
        self.force = creer_user("police@snicv.gw", role="FORCE_ORDRE", tel="+245955000005")

    def _vehicule_certifie(self):
        veh = Vehicule.objects.create(
            proprietaire=self.usager, vin="VF1RFB00X67891234", marque="Toyota",
            modele="Hilux", annee=2019, energie="DIESEL", type_vehicule="UTILITAIRE",
        )
        dossier = Dossier.objects.create(
            usager=self.usager, vehicule=veh, statut=StatutDossier.IMMATRICULE,
            numero_dossier=f"SNICV-2026-{Dossier.objects.count() + 1:06d}",
        )
        Immatriculation.objects.create(
            vehicule=veh, numero="AB 4821 BS", serie_plaque="AB",
            sequence=Immatriculation.objects.count() + 1,
        )
        futur = datetime.date.today() + datetime.timedelta(days=180)
        for t in (TypeDocument.ASSURANCE, TypeDocument.CONTROLE_TECHNIQUE):
            Document.objects.create(dossier=dossier, type_document=t,
                                    fichier=SimpleUploadedFile("p.pdf", b"%PDF-1.4"), date_fin=futur)
        self.client.force_authenticate(self.agent)
        cid = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id])).data["id"]
        self.client.force_authenticate(None)
        return veh, Certificat.objects.get(id=cid)


class DeclarationTests(SignalementBase):
    def test_agent_signale_par_plaque(self):
        self._vehicule_certifie()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:signalements:liste-creer"),
                                {"immatriculation": "AB 4821 BS", "type": "VOLE",
                                 "reference": "PV-2026-77", "motif": "Déclaré volé à Bissau"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["type"], "VOLE")
        self.assertTrue(Signalement.objects.filter(statut=StatutSignalement.ACTIF).exists())

    def test_agent_signale_par_vin(self):
        veh, _ = self._vehicule_certifie()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:signalements:liste-creer"),
                                {"vin": veh.vin, "type": "RECHERCHE"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_signaler_vehicule_inconnu(self):
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:signalements:liste-creer"),
                                {"immatriculation": "ZZ 9999 BS"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_doublon_actif_refuse(self):
        self._vehicule_certifie()
        self.client.force_authenticate(self.agent)
        url = reverse("v1:signalements:liste-creer")
        self.client.post(url, {"immatriculation": "AB 4821 BS", "type": "VOLE"})
        resp = self.client.post(url, {"immatriculation": "AB 4821 BS", "type": "VOLE"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_usager_signale_son_vehicule(self):
        # Le véhicule certifié appartient à self.usager (proprietaire).
        self._vehicule_certifie()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:signalements:liste-creer"),
                                {"immatriculation": "AB 4821 BS", "type": "VOLE",
                                 "reference": "PV-2026-9", "motif": "Volé cette nuit"})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_usager_ne_signale_pas_vehicule_autrui(self):
        self._vehicule_certifie()  # appartient à self.usager
        autre = creer_user("autre@ex.gw", tel="+245955000009")
        self.client.force_authenticate(autre)
        resp = self.client.post(reverse("v1:signalements:liste-creer"),
                                {"immatriculation": "AB 4821 BS"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_force_ordre_ne_declare_pas(self):
        # Les forces de l'ordre découvrent l'alerte au contrôle, mais ne déclarent pas.
        self._vehicule_certifie()
        self.client.force_authenticate(self.force)
        resp = self.client.post(reverse("v1:signalements:liste-creer"),
                                {"immatriculation": "AB 4821 BS"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class AlerteAuControleTests(SignalementBase):
    def _signaler(self, veh):
        Signalement.objects.create(vehicule=veh, type="VOLE", reference="PV-1",
                                   motif="volé", signale_par=self.force)

    def test_alerte_visible_verif_plaque(self):
        veh, _ = self._vehicule_certifie()
        self._signaler(veh)
        self.client.force_authenticate(self.force)
        resp = self.client.get(reverse("v1:certificats:verify-plaque"),
                               {"immatriculation": "AB 4821 BS"})
        self.assertEqual(resp.data["resultat"], "AUTHENTIQUE")
        self.assertIsNotNone(resp.data["alerte"])
        self.assertEqual(resp.data["alerte"]["type"], "VOLE")

    def test_pas_alerte_si_aucun_signalement(self):
        self._vehicule_certifie()
        self.client.force_authenticate(self.force)
        resp = self.client.get(reverse("v1:certificats:verify-plaque"),
                               {"immatriculation": "AB 4821 BS"})
        self.assertIsNone(resp.data["alerte"])

    def test_qr_public_ne_revele_pas_alerte(self):
        veh, cert = self._vehicule_certifie()
        self._signaler(veh)
        # Scan anonyme (public) : pas d'alerte divulguée.
        resp = self.client.get(reverse("v1:certificats:verify", args=[cert.id]))
        self.assertIsNone(resp.data["alerte"])

    def test_qr_staff_voit_alerte(self):
        veh, cert = self._vehicule_certifie()
        self._signaler(veh)
        self.client.force_authenticate(self.force)
        resp = self.client.get(reverse("v1:certificats:verify", args=[cert.id]))
        self.assertIsNotNone(resp.data["alerte"])


class LeveeTests(SignalementBase):
    def _sig(self, veh):
        return Signalement.objects.create(vehicule=veh, type="VOLE", signale_par=self.force)

    def test_levee_par_admin(self):
        veh, _ = self._vehicule_certifie()
        sig = self._sig(veh)
        self.client.force_authenticate(self.admin)
        resp = self.client.post(reverse("v1:signalements:lever", args=[sig.id]),
                                {"motif": "Véhicule retrouvé"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        sig.refresh_from_db()
        self.assertEqual(sig.statut, StatutSignalement.LEVE)

    def test_levee_refusee_agent(self):
        veh, _ = self._vehicule_certifie()
        sig = self._sig(veh)
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:signalements:lever", args=[sig.id]), {})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_liste_actifs_pour_staff(self):
        veh, _ = self._vehicule_certifie()
        self._sig(veh)
        self.client.force_authenticate(self.force)
        resp = self.client.get(reverse("v1:signalements:liste-creer"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(resp.data), 1)

"""Tests paiements : montant, règlement (mock), reçu, liste, configuration, gate certificat."""
import shutil
import tempfile

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.dossiers.models import Dossier, StatutDossier, Vehicule
from apps.immatriculations.models import Immatriculation

from .models import ConfigurationPaiement, OperateurPaiement, Paiement, StatutPaiement
from .services import payer

MEDIA_TMP = tempfile.mkdtemp()


def creer_user(email, role="USAGER", tel="+24570000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Nom", prenom="Prenom",
        password="pass1234", role=role, is_active=True,
    )


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class PaiementBase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.usager = creer_user("usager@ex.gw")
        self.autre = creer_user("autre@ex.gw", tel="+24570000002")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+24570000003")
        self.admin = creer_user("admin@snicv.gw", role="ADMIN", tel="+24570000004")

    def _dossier(self, usager=None, statut=StatutDossier.IMMATRICULE, vin="VF1RFB00X67891234", immat=True):
        usager = usager or self.usager
        veh = Vehicule.objects.create(
            proprietaire=usager, vin=vin, marque="Toyota", modele="Corolla",
            annee=2019, energie="ESSENCE", type_vehicule="VP",
        )
        dossier = Dossier.objects.create(
            usager=usager, vehicule=veh, statut=statut,
            numero_dossier=f"SNICV-2026-{Dossier.objects.count() + 1:06d}",
        )
        if immat:
            Immatriculation.objects.create(
                vehicule=veh, numero=f"AA {Dossier.objects.count():04d} BS",
                serie_plaque="AA", sequence=Dossier.objects.count())
        return dossier


class OperateursConfigTests(PaiementBase):
    def test_operateurs_par_defaut_crees(self):
        self.assertEqual(OperateurPaiement.objects.filter(actif=True).count(), 2)

    def test_montant_depuis_config(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:paiements:montant", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total"], 17500)  # 15000 + 2000 + 500 par défaut
        self.assertEqual(len(resp.data["operateurs"]), 2)
        self.assertFalse(resp.data["deja_paye"])

    def test_config_put_admin_seulement(self):
        self.client.force_authenticate(self.usager)
        self.assertEqual(
            self.client.put(reverse("v1:paiements:configuration"),
                            {"montant_taxe": 20000}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(self.admin)
        resp = self.client.put(reverse("v1:paiements:configuration"),
                               {"montant_taxe": 20000, "paiement_requis": True}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total"], 22500)
        cfg = ConfigurationPaiement.actuelle()
        self.assertEqual(cfg.montant_taxe, 20000)
        self.assertTrue(cfg.paiement_requis)

    def test_creer_operateur_admin_seulement(self):
        self.client.force_authenticate(self.usager)
        self.assertEqual(
            self.client.post(reverse("v1:paiements:operateurs"),
                             {"nom": "Wave", "code": "WAVE"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(self.admin)
        resp = self.client.post(reverse("v1:paiements:operateurs"),
                                {"nom": "Wave", "code": "WAVE", "couleur": "#1dc8ff"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)


class PaiementFlowTests(PaiementBase):
    def test_payer_confirme_et_genere_recu(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:paiements:dossier-paiement", args=[dossier.id]),
                                {"operateur": "ORANGE", "numero": "95 500 01 03"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["statut"], "PAYE")
        self.assertTrue(resp.data["reference"].startswith("PAY-"))
        self.assertTrue(resp.data["a_recu"])
        p = Paiement.objects.get(dossier=dossier)
        self.assertEqual(p.statut, StatutPaiement.PAYE)
        self.assertTrue(p.reference_transaction)

    def test_double_paiement_refuse(self):
        dossier = self._dossier()
        payer(dossier, operateur_code="ORANGE", numero="123", user=self.usager)
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:paiements:dossier-paiement", args=[dossier.id]),
                                {"operateur": "ORANGE", "numero": "123"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recu_pdf(self):
        dossier = self._dossier()
        _, _, p = payer(dossier, operateur_code="ORANGE", numero="123", user=self.usager)
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:paiements:recu", args=[p.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")

    def test_liste_staff_voit_tout_usager_voit_le_sien(self):
        d1 = self._dossier(self.usager)
        d2 = self._dossier(self.autre, vin="ZFA31200000123456")
        payer(d1, operateur_code="ORANGE", numero="1", user=self.usager)
        payer(d2, operateur_code="MTN", numero="2", user=self.autre)
        # Usager : seulement le sien
        self.client.force_authenticate(self.usager)
        self.assertEqual(self.client.get(reverse("v1:paiements:liste")).data["count"], 1)
        # Agent : tous
        self.client.force_authenticate(self.agent)
        self.assertEqual(self.client.get(reverse("v1:paiements:liste")).data["count"], 2)

    def test_operateur_invalide_refuse(self):
        dossier = self._dossier()
        ok, _, _ = payer(dossier, operateur_code="INEXISTANT", numero="1", user=self.usager)
        self.assertFalse(ok)

    def test_paiement_delivre_le_certificat(self):
        """Régler la taxe d'un dossier immatriculé émet aussitôt le certificat."""
        from apps.certificats.models import Certificat
        dossier = self._dossier(statut=StatutDossier.IMMATRICULE)
        payer(dossier, operateur_code="ORANGE", numero="1", user=self.usager)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.CERTIFIE)
        self.assertTrue(Certificat.objects.filter(dossier=dossier).exists())


class GateCertificatTests(PaiementBase):
    def test_paiement_requis_bloque_puis_delivre_le_certificat(self):
        from apps.certificats.models import Certificat
        from apps.certificats.services import emettre_certificat
        cfg = ConfigurationPaiement.actuelle()
        cfg.paiement_requis = True
        cfg.save()

        dossier = self._dossier(statut=StatutDossier.IMMATRICULE)
        # Tant que la taxe n'est pas réglée, l'agent est bloqué.
        ok, message, _ = emettre_certificat(dossier, self.agent)
        self.assertFalse(ok)
        self.assertIn("taxe", message.lower())

        # Le paiement débloque ET délivre automatiquement le certificat.
        payer(dossier, operateur_code="ORANGE", numero="1", user=self.usager)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.CERTIFIE)
        self.assertTrue(Certificat.objects.filter(dossier=dossier).exists())

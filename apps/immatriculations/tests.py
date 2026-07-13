"""Tests de l'étape 5 : attribution d'immatriculation, format, séquence, permissions."""
import re

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.dossiers.models import Dossier, StatutDossier, Vehicule

from .models import CategoriePlaque, Immatriculation
from .services import _composer_numero

PLAQUE_RE = re.compile(r"^[A-Z]{2} \d{4} [A-Z]{2}$")
PLAQUE_MOTO_RE = re.compile(r"^M[A-Z]? \d{4} SB$")


def creer_user(email, role="USAGER", tel="+24570000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Nom", prenom="Prenom",
        password="pass1234", role=role, is_active=True,
    )


class ImmatriculationBase(APITestCase):
    def setUp(self):
        self.usager = creer_user("usager@ex.gw")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+24570000003")

    def _dossier(self, statut=StatutDossier.VALIDE, vin="VF1RFB00X67891234", type_vehicule="VP"):
        veh = Vehicule.objects.create(
            proprietaire=self.usager, vin=vin, marque="Toyota", modele="Corolla",
            annee=2019, energie="ESSENCE", type_vehicule=type_vehicule,
        )
        return Dossier.objects.create(
            usager=self.usager, vehicule=veh, statut=statut,
            numero_dossier=f"SNICV-2026-{Dossier.objects.count() + 1:06d}",
        )


class AttributionTests(ImmatriculationBase):
    def test_composer_numero_unitaire(self):
        std = CategoriePlaque.STANDARD
        self.assertEqual(_composer_numero(1, std)[0].split()[0], "AA")
        self.assertTrue(_composer_numero(1, std)[0].startswith("AA 0001"))
        self.assertTrue(_composer_numero(9999, std)[0].startswith("AA 9999"))
        self.assertTrue(_composer_numero(10000, std)[0].startswith("AB 0001"))  # rollover de série

    def test_composer_numero_moto(self):
        moto = CategoriePlaque.MOTO
        self.assertEqual(_composer_numero(1, moto)[0], "M 0001 SB")
        self.assertEqual(_composer_numero(9999, moto)[0], "M 9999 SB")
        self.assertEqual(_composer_numero(10000, moto)[0], "MA 0001 SB")  # rollover de série moto

    def test_moto_numerotation_independante_des_voitures(self):
        """Une moto obtient M 0001 SB même si des voitures ont déjà été immatriculées."""
        self.client.force_authenticate(self.agent)
        voiture = self._dossier(vin="VF1RFB00X67891111")
        self.client.post(reverse("v1:immatriculations:immatriculer", args=[voiture.id]))
        moto = self._dossier(vin="ZDM00000000000001", type_vehicule="MOTO")
        resp = self.client.post(reverse("v1:immatriculations:immatriculer", args=[moto.id]))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertRegex(resp.data["numero"], PLAQUE_MOTO_RE)
        self.assertEqual(resp.data["numero"], "M 0001 SB")
        self.assertEqual(resp.data["categorie"], CategoriePlaque.MOTO)
        self.assertTrue(resp.data["est_moto"])

    def test_agent_immatricule_dossier_valide(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:immatriculations:immatriculer", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertRegex(resp.data["numero"], PLAQUE_RE)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.IMMATRICULE)
        self.assertTrue(Immatriculation.objects.filter(vehicule=dossier.vehicule).exists())

    def test_immatriculation_refusee_si_non_valide(self):
        dossier = self._dossier(statut=StatutDossier.EN_VALIDATION)
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:immatriculations:immatriculer", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_double_immatriculation_refusee(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.agent)
        self.client.post(reverse("v1:immatriculations:immatriculer", args=[dossier.id]))
        # Deuxième tentative — mais le statut est déjà IMMATRICULE.
        resp = self.client.post(reverse("v1:immatriculations:immatriculer", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_numeros_sequentiels_uniques(self):
        d1 = self._dossier()
        d2 = self._dossier(vin="ZFA31200000123456")
        self.client.force_authenticate(self.agent)
        n1 = self.client.post(reverse("v1:immatriculations:immatriculer", args=[d1.id])).data["numero"]
        n2 = self.client.post(reverse("v1:immatriculations:immatriculer", args=[d2.id])).data["numero"]
        self.assertNotEqual(n1, n2)
        self.assertTrue(n1.startswith("AA 0001"))
        self.assertTrue(n2.startswith("AA 0002"))

    def test_usager_ne_peut_pas_immatriculer(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:immatriculations:immatriculer", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class ConsultationTests(ImmatriculationBase):
    def _immatriculer(self, dossier):
        self.client.force_authenticate(self.agent)
        self.client.post(reverse("v1:immatriculations:immatriculer", args=[dossier.id]))

    def test_proprietaire_consulte_son_immatriculation(self):
        dossier = self._dossier()
        self._immatriculer(dossier)
        self.client.force_authenticate(self.usager)
        resp = self.client.get(
            reverse("v1:immatriculations:immatriculation-detail", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertRegex(resp.data["numero"], PLAQUE_RE)

    def test_autre_usager_refuse(self):
        dossier = self._dossier()
        self._immatriculer(dossier)
        intrus = creer_user("intrus@ex.gw", tel="+24570000009")
        self.client.force_authenticate(intrus)
        resp = self.client.get(
            reverse("v1:immatriculations:immatriculation-detail", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

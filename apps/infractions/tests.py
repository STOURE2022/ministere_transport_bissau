"""Tests infractions : barème, verbalisation, règlement (mock), contestation, quittance, stats."""
import shutil
import tempfile

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.dossiers.models import Vehicule
from apps.immatriculations.models import Immatriculation

from .models import Infraction, StatutInfraction, TypeInfraction
from .services import dresser_infraction

MEDIA_TMP = tempfile.mkdtemp()


def creer_user(email, role="USAGER", tel="+24570000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Nom", prenom="Prenom",
        password="pass1234", role=role, is_active=True,
    )


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class InfractionBase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.usager = creer_user("usager@ex.gw")
        self.autre = creer_user("autre@ex.gw", tel="+24570000002")
        self.police = creer_user("police@snicv.gw", role="FORCE_ORDRE", tel="+24570000003")
        self.admin = creer_user("admin@snicv.gw", role="ADMIN", tel="+24570000004")

    def _vehicule(self, usager=None, vin="VF1RFB00X67891234", plaque="AA 1024 BS"):
        usager = usager or self.usager
        veh = Vehicule.objects.create(
            proprietaire=usager, vin=vin, marque="Toyota", modele="Corolla",
            annee=2019, energie="ESSENCE", type_vehicule="VP",
        )
        Immatriculation.objects.create(
            vehicule=veh, numero=plaque, serie_plaque="AA",
            sequence=Immatriculation.objects.count() + 1)
        return veh

    def _pv(self, veh=None, type_code="EXCES_VITESSE"):
        veh = veh or self._vehicule()
        _, _, inf = dresser_infraction(veh, type_code=type_code, lieu="Bissau", agent=self.police)
        return inf


class BaremeTests(InfractionBase):
    def test_bareme_par_defaut_cree(self):
        self.assertEqual(TypeInfraction.objects.filter(actif=True).count(), 5)

    def test_creer_type_admin_seulement(self):
        self.client.force_authenticate(self.usager)
        self.assertEqual(
            self.client.post(reverse("v1:infractions:types"),
                             {"libelle": "Feu rouge", "code": "FEU_ROUGE", "montant": 20000},
                             format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(self.admin)
        resp = self.client.post(reverse("v1:infractions:types"),
                                {"libelle": "Feu rouge", "code": "FEU_ROUGE", "montant": 20000},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)


class VerbalisationTests(InfractionBase):
    def test_dresser_pv_staff(self):
        veh = self._vehicule()
        self.client.force_authenticate(self.police)
        resp = self.client.post(reverse("v1:infractions:liste"),
                                {"immatriculation": "AA 1024 BS", "type": "EXCES_VITESSE",
                                 "lieu": "Bissau"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["montant"], 25000)
        self.assertEqual(resp.data["statut"], "A_REGLER")
        self.assertTrue(resp.data["reference"].startswith("PV-"))
        self.assertEqual(Infraction.objects.filter(vehicule=veh).count(), 1)

    def test_usager_ne_peut_pas_dresser(self):
        self._vehicule()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:infractions:liste"),
                                {"immatriculation": "AA 1024 BS", "type": "EXCES_VITESSE"},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_plaque_inconnue_refuse(self):
        self.client.force_authenticate(self.police)
        resp = self.client.post(reverse("v1:infractions:liste"),
                                {"immatriculation": "ZZ 9999 BS", "type": "EXCES_VITESSE"},
                                format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_liste_staff_voit_tout_usager_voit_le_sien(self):
        self._pv(self._vehicule(self.usager, vin="VF1RFB00X67891234", plaque="AA 0001 BS"))
        self._pv(self._vehicule(self.autre, vin="ZFA31200000123456", plaque="AA 0002 BS"))
        self.client.force_authenticate(self.usager)
        self.assertEqual(self.client.get(reverse("v1:infractions:liste")).data["count"], 1)
        self.client.force_authenticate(self.police)
        self.assertEqual(self.client.get(reverse("v1:infractions:liste")).data["count"], 2)


class ReglementTests(InfractionBase):
    def test_payer_amende_proprietaire_genere_quittance(self):
        inf = self._pv()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:infractions:payer", args=[inf.id]),
                                {"operateur": "ORANGE", "numero": "95 500 01 03"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["statut"], "PAYEE")
        self.assertTrue(resp.data["quittance_reference"].startswith("QIT-"))
        self.assertTrue(resp.data["a_quittance"])
        inf.refresh_from_db()
        self.assertEqual(inf.statut, StatutInfraction.PAYEE)
        self.assertTrue(inf.reference_transaction)

    def test_non_proprietaire_ne_paie_pas(self):
        inf = self._pv()
        self.client.force_authenticate(self.autre)
        resp = self.client.post(reverse("v1:infractions:payer", args=[inf.id]),
                                {"operateur": "ORANGE", "numero": "1"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_double_paiement_refuse(self):
        inf = self._pv()
        self.client.force_authenticate(self.usager)
        self.client.post(reverse("v1:infractions:payer", args=[inf.id]),
                         {"operateur": "ORANGE", "numero": "1"}, format="json")
        resp = self.client.post(reverse("v1:infractions:payer", args=[inf.id]),
                                {"operateur": "ORANGE", "numero": "1"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quittance_pdf(self):
        inf = self._pv()
        self.client.force_authenticate(self.usager)
        self.client.post(reverse("v1:infractions:payer", args=[inf.id]),
                         {"operateur": "ORANGE", "numero": "1"}, format="json")
        resp = self.client.get(reverse("v1:infractions:quittance", args=[inf.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")


class ContestationTests(InfractionBase):
    def test_contester_puis_rejeter(self):
        inf = self._pv()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:infractions:contester", args=[inf.id]),
                                {"motif": "Je n'étais pas là."}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["statut"], "CONTESTEE")

        self.client.force_authenticate(self.admin)
        resp = self.client.post(reverse("v1:infractions:rejeter-contestation", args=[inf.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["statut"], "A_REGLER")

    def test_annuler_amende_admin(self):
        inf = self._pv()
        self.client.force_authenticate(self.admin)
        resp = self.client.post(reverse("v1:infractions:annuler", args=[inf.id]),
                                {"motif": "Erreur de plaque."}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["statut"], "ANNULEE")

    def test_stats_staff(self):
        inf = self._pv()
        self.client.force_authenticate(self.usager)
        self.client.post(reverse("v1:infractions:payer", args=[inf.id]),
                         {"operateur": "ORANGE", "numero": "1"}, format="json")
        self.client.force_authenticate(self.admin)
        resp = self.client.get(reverse("v1:infractions:stats"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["payees"], 1)
        self.assertEqual(resp.data["recettes"], 25000)

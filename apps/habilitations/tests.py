"""Tests des habilitations : inscription contrôle, file de validation, gating d'accès."""
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import CorpsControle, DemandeHabilitation, StatutHabilitation
from .services import creer_demande_habilitation, valider_habilitation

MEDIA_TMP = tempfile.mkdtemp()


def creer_user(email, role="USAGER", tel="+245955000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Nom", prenom="Prenom",
        password="pass1234", role=role, is_active=True,
    )


def _justif(nom="carte.pdf"):
    return SimpleUploadedFile(nom, b"%PDF-1.4 justificatif", content_type="application/pdf")


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class HabilitationBase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.usager = creer_user("usager@ex.gw")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+245955000003")
        self.admin = creer_user("admin@snicv.gw", role="ADMIN", tel="+245955000004")
        self.corps = CorpsControle.objects.get(code="CIRCULATION")

    def _demande(self, email="police@ex.gw", tel="+245955000009", statut=StatutHabilitation.EN_ATTENTE):
        user = User.objects.create_user(
            email=email, telephone=tel, nom="Sané", prenom="Bacar",
            password="pass1234", role="FORCE_ORDRE", is_active=True,
        )
        dem = creer_demande_habilitation(user, self.corps, matricule="POP-1",
                                         justificatif=_justif())
        dem.statut = statut
        dem.save(update_fields=["statut"])
        return user, dem


class CorpsTests(HabilitationBase):
    def test_six_corps_par_defaut(self):
        self.assertEqual(CorpsControle.objects.filter(actif=True).count(), 6)

    def test_corps_publics_accessibles_sans_auth(self):
        resp = self.client.get(reverse("v1:habilitations:corps-actifs"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 6)

    def test_creation_corps_admin_seulement(self):
        url = reverse("v1:habilitations:corps-admin")
        self.client.force_authenticate(self.agent)
        self.assertEqual(
            self.client.post(url, {"nom": "Marine", "code": "MARINE", "sigle": "MA"},
                             format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(self.admin)
        resp = self.client.post(url, {"nom": "Marine", "code": "MARINE", "sigle": "MA"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_desactiver_corps_le_retire_de_la_liste_publique(self):
        self.client.force_authenticate(self.admin)
        self.client.patch(reverse("v1:habilitations:corps-admin-detail", args=[self.corps.id]),
                          {"actif": False}, format="json")
        self.client.force_authenticate(None)
        resp = self.client.get(reverse("v1:habilitations:corps-actifs"))
        self.assertEqual(len(resp.data), 5)


class InscriptionControleTests(HabilitationBase):
    def _payload(self, **over):
        data = {
            "prenom": "Bacar", "nom": "Sané", "email": "b.sane@controle.gw",
            "telephone": "+245955001234", "password": "MotDePasse#9",
            "password2": "MotDePasse#9", "corps": "CIRCULATION",
            "matricule": "POP-4821", "grade": "Sous-officier",
            "unite": "Brigade Bissau", "region": "Bissau",
            "justificatif": _justif(),
        }
        data.update(over)
        return data

    def test_inscription_cree_compte_inactif_et_demande_en_attente(self):
        resp = self.client.post(reverse("v1:habilitations:inscription-controle"),
                                self._payload(), format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="b.sane@controle.gw")
        self.assertEqual(user.role, "FORCE_ORDRE")
        self.assertFalse(user.is_active)  # activé après OTP
        self.assertEqual(user.habilitation.statut, StatutHabilitation.EN_ATTENTE)
        self.assertTrue(user.habilitation.reference.startswith("HAB-"))

    def test_mots_de_passe_differents_refuses(self):
        resp = self.client.post(reverse("v1:habilitations:inscription-controle"),
                                self._payload(password2="Autre#1234"), format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_justificatif_obligatoire(self):
        payload = self._payload()
        payload.pop("justificatif")
        resp = self.client.post(reverse("v1:habilitations:inscription-controle"),
                                payload, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_email_existant_refuse(self):
        creer_user("b.sane@controle.gw", tel="+245955009999")
        resp = self.client.post(reverse("v1:habilitations:inscription-controle"),
                                self._payload(), format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class FileValidationTests(HabilitationBase):
    def test_liste_reservee_au_staff(self):
        self._demande()
        url = reverse("v1:habilitations:liste")
        self.client.force_authenticate(self.usager)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.agent)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

    def test_agent_valide_la_demande(self):
        user, dem = self._demande()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:habilitations:valider", args=[dem.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        dem.refresh_from_db()
        self.assertEqual(dem.statut, StatutHabilitation.VALIDE)
        self.assertEqual(dem.decide_par, self.agent)

    def test_rejet_exige_un_motif(self):
        _, dem = self._demande()
        self.client.force_authenticate(self.agent)
        self.assertEqual(
            self.client.post(reverse("v1:habilitations:rejeter", args=[dem.id]),
                             {"motif": ""}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        resp = self.client.post(reverse("v1:habilitations:rejeter", args=[dem.id]),
                                {"motif": "Pièce illisible"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        dem.refresh_from_db()
        self.assertEqual(dem.statut, StatutHabilitation.REJETE)
        self.assertEqual(dem.motif_decision, "Pièce illisible")

    def test_justificatif_consultable_par_le_staff(self):
        _, dem = self._demande()
        url = reverse("v1:habilitations:justificatif", args=[dem.id])
        self.client.force_authenticate(self.usager)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.agent)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

    def test_stats(self):
        self._demande()
        self._demande(email="p2@ex.gw", tel="+245955000010", statut=StatutHabilitation.VALIDE)
        self.client.force_authenticate(self.admin)
        resp = self.client.get(reverse("v1:habilitations:stats"))
        self.assertEqual(resp.data["en_attente"], 1)
        self.assertEqual(resp.data["validees"], 1)


class ResoumissionTests(HabilitationBase):
    def _payload(self):
        return {"corps": "GARDE_NATIONALE", "matricule": "GN-99", "justificatif": _justif()}

    def test_resoumission_apres_refus_repasse_en_attente(self):
        user, dem = self._demande(statut=StatutHabilitation.REJETE)
        self.client.force_authenticate(user)
        resp = self.client.post(reverse("v1:habilitations:resoumettre"), self._payload(), format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["user"]["habilitation"]["statut"], "EN_ATTENTE")
        user.refresh_from_db()
        self.assertEqual(user.habilitation.statut, StatutHabilitation.EN_ATTENTE)
        self.assertEqual(user.habilitation.corps.code, "GARDE_NATIONALE")

    def test_resoumission_refusee_si_demande_non_rejetee(self):
        user, _ = self._demande(statut=StatutHabilitation.EN_ATTENTE)
        self.client.force_authenticate(user)
        resp = self.client.post(reverse("v1:habilitations:resoumettre"), self._payload(), format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resoumission_reservee_aux_forces_de_l_ordre(self):
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:habilitations:resoumettre"), self._payload(), format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class GatingAccesTests(HabilitationBase):
    """Un agent de contrôle non validé ne peut pas utiliser les fonctions de contrôle."""

    def _url_staff(self):
        return reverse("v1:certificats:scans-global")  # protégé par IsStaffRole

    def test_force_ordre_en_attente_bloque(self):
        user, _ = self._demande(statut=StatutHabilitation.EN_ATTENTE)
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get(self._url_staff()).status_code, status.HTTP_403_FORBIDDEN)

    def test_force_ordre_valide_autorise(self):
        user, dem = self._demande(statut=StatutHabilitation.EN_ATTENTE)
        valider_habilitation(dem, self.agent)
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get(self._url_staff()).status_code, status.HTTP_200_OK)

    def test_force_ordre_sans_demande_reste_autorise(self):
        """Compte force de l'ordre créé par l'admin / le seed (sans demande) : aucune régression."""
        legacy = creer_user("legacy@snicv.gw", role="FORCE_ORDRE", tel="+245955000077")
        self.client.force_authenticate(legacy)
        self.assertEqual(self.client.get(self._url_staff()).status_code, status.HTTP_200_OK)

    def test_habilitation_exposee_dans_me(self):
        user, _ = self._demande(statut=StatutHabilitation.EN_ATTENTE)
        self.client.force_authenticate(user)
        resp = self.client.get(reverse("v1:accounts:me"))
        self.assertEqual(resp.data["habilitation"]["statut"], "EN_ATTENTE")
        self.assertEqual(resp.data["habilitation"]["corps"], "Police de la circulation")

"""Tests de l'étape 3 : moteur de vérification, doublons, score, endpoints."""
import datetime
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.dossiers.models import Document, Dossier, StatutDossier, TypeDocument, Vehicule

from .models import NiveauRisque, VerificationAuto
from .services import detecter_doublon, lancer_verification, valider_vin

MEDIA_TMP = tempfile.mkdtemp()
VIN_OK = "VF1RFB00X67891234"
VIN_KO = "IOQRFB00X67891234"  # contient I, O, Q → invalide


def creer_user(email, role="USAGER", tel="+24570000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Test", prenom="User",
        password="pass1234", role=role, is_active=True,
    )


# Hasher rapide : accélère nettement la création d'utilisateurs en test.
@override_settings(
    MEDIA_ROOT=MEDIA_TMP,
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
)
class VerificationBase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.usager = creer_user("usager@ex.gw")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+24570000003")

    def _dossier_complet(self, usager=None, vin=VIN_OK):
        """Dossier au stade brouillon avec les 3 pièces obligatoires valides."""
        usager = usager or self.usager
        veh = Vehicule.objects.create(
            proprietaire=usager, vin=vin, marque="Toyota", modele="Corolla",
            annee=2019, energie="ESSENCE", type_vehicule="VP",
        )
        dossier = Dossier.objects.create(
            usager=usager, vehicule=veh,
            numero_dossier=f"SNICV-2026-{Dossier.objects.count() + 1:06d}",
        )
        aujourdhui = datetime.date.today()
        futur = aujourdhui + datetime.timedelta(days=180)
        passe = aujourdhui - datetime.timedelta(days=30)
        for type_doc, d_fin in (
            (TypeDocument.ASSURANCE, futur),
            (TypeDocument.CONTROLE_TECHNIQUE, futur),
            (TypeDocument.FACTURE, None),
        ):
            Document.objects.create(
                dossier=dossier, type_document=type_doc,
                fichier=SimpleUploadedFile("p.pdf", b"%PDF-1.4", content_type="application/pdf"),
                date_debut=passe, date_fin=d_fin,
            )
        return dossier


class MoteurVerificationTests(VerificationBase):
    def test_valider_vin_unitaire(self):
        self.assertTrue(valider_vin(VIN_OK)[0])
        self.assertFalse(valider_vin(VIN_KO)[0])          # I/O/Q interdits
        self.assertFalse(valider_vin("TROPCOURT")[0])     # longueur

    def test_verification_tout_conforme(self):
        dossier = self._dossier_complet()
        verif = lancer_verification(dossier)
        self.assertTrue(verif.tout_conforme)
        self.assertEqual(verif.score_fraude, 0)
        self.assertEqual(verif.niveau_risque, NiveauRisque.FAIBLE)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.EN_VALIDATION)

    def test_doublon_detecte(self):
        premier = self._dossier_complet()
        lancer_verification(premier)                       # devient actif, sans doublon
        second = self._dossier_complet(vin=VIN_OK)         # même VIN
        verif = lancer_verification(second)
        self.assertTrue(verif.doublon_detecte)
        self.assertEqual(verif.dossier_doublon, premier)
        self.assertEqual(verif.score_fraude, 50)
        self.assertEqual(verif.niveau_risque, NiveauRisque.MOYEN)

    def test_vin_invalide_augmente_le_score(self):
        dossier = self._dossier_complet(vin=VIN_KO)
        verif = lancer_verification(dossier)
        self.assertFalse(verif.vin_valide)
        self.assertEqual(verif.score_fraude, 25)

    def test_doublon_ignore_les_dossiers_rejetes(self):
        rejete = self._dossier_complet()
        rejete.statut = StatutDossier.REJETE
        rejete.save()
        actif = self._dossier_complet(vin=VIN_OK)
        self.assertIsNone(detecter_doublon(actif))         # le rejeté n'est pas un doublon


class VerificationEndpointsTests(VerificationBase):
    def test_get_verification_par_proprietaire(self):
        dossier = self._dossier_complet()
        lancer_verification(dossier)
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:verifications:verification-detail", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["score_fraude"], 0)

    def test_get_verification_autre_usager_refuse(self):
        dossier = self._dossier_complet()
        lancer_verification(dossier)
        intrus = creer_user("intrus@ex.gw", tel="+24570000009")
        self.client.force_authenticate(intrus)
        resp = self.client.get(reverse("v1:verifications:verification-detail", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_relancer_par_agent(self):
        dossier = self._dossier_complet()
        lancer_verification(dossier)
        self.client.force_authenticate(self.agent)
        resp = self.client.post(
            reverse("v1:verifications:verification-relancer", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(VerificationAuto.objects.filter(dossier=dossier).count(), 1)

    def test_relancer_par_usager_interdit(self):
        dossier = self._dossier_complet()
        lancer_verification(dossier)
        self.client.force_authenticate(self.usager)
        resp = self.client.post(
            reverse("v1:verifications:verification-relancer", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

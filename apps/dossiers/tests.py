"""Tests de l'app dossiers : création, upload de pièces, cohérence des dates, permissions."""
import datetime
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import Document, Dossier, StatutDossier, TypeDocument, Vehicule

MEDIA_TMP = tempfile.mkdtemp()

VEHICULE_PAYLOAD = {
    "vin": "VF1RFB00X67891234",
    "marque": "Toyota",
    "modele": "Corolla",
    "annee": 2019,
    "energie": "ESSENCE",
    "type_vehicule": "VP",
}


def pdf(nom="piece.pdf"):
    return SimpleUploadedFile(nom, b"%PDF-1.4 contenu de test", content_type="application/pdf")


def creer_user(email, role="USAGER", tel="+24570000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Test", prenom="User",
        password="MotDePasse123!", role=role, is_active=True,
    )


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class DossierBase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.usager = creer_user("usager@ex.gw")
        self.autre = creer_user("autre@ex.gw", tel="+24570000002")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+24570000003")

    def _creer_dossier(self, usager=None):
        usager = usager or self.usager
        veh = Vehicule.objects.create(proprietaire=usager, **VEHICULE_PAYLOAD)
        return Dossier.objects.create(
            usager=usager, vehicule=veh, numero_dossier=f"SNICV-2026-{Dossier.objects.count()+1:06d}",
        )

    def _ajouter_doc(self, dossier, type_doc, date_debut=None, date_fin=None):
        return Document.objects.create(
            dossier=dossier, type_document=type_doc, fichier=pdf(),
            date_debut=date_debut, date_fin=date_fin,
        )


class DocumentFichierTests(DossierBase):
    """Consultation du fichier d'une pièce : agent et propriétaire OK, tiers refusé."""

    def _url(self, dossier):
        doc = self._ajouter_doc(dossier, "ASSURANCE")
        return reverse("v1:dossiers:document-fichier", args=[doc.id])

    def test_agent_peut_consulter_la_piece(self):
        url = self._url(self._creer_dossier(self.usager))
        self.client.force_authenticate(self.agent)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")

    def test_proprietaire_peut_consulter_sa_piece(self):
        url = self._url(self._creer_dossier(self.usager))
        self.client.force_authenticate(self.usager)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_tiers_ne_peut_pas_consulter(self):
        url = self._url(self._creer_dossier(self.usager))
        self.client.force_authenticate(self.autre)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonyme_refuse(self):
        url = self._url(self._creer_dossier(self.usager))
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class CreationDossierTests(DossierBase):
    def test_usager_cree_dossier_avec_vehicule(self):
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:dossiers:dossier-list"),
                                {"vehicule": VEHICULE_PAYLOAD}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data["numero_dossier"].startswith("SNICV-"))
        self.assertEqual(resp.data["statut"], "BROUILLON")
        dossier = Dossier.objects.get(id=resp.data["id"])
        self.assertEqual(dossier.usager, self.usager)
        self.assertEqual(dossier.vehicule.proprietaire, self.usager)

    def test_vin_invalide_rejete(self):
        self.client.force_authenticate(self.usager)
        payload = {"vehicule": {**VEHICULE_PAYLOAD, "vin": "TROPCOURT"}}
        resp = self.client.post(reverse("v1:dossiers:dossier-list"), payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_agent_ne_peut_pas_creer_dossier(self):
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:dossiers:dossier-list"),
                                {"vehicule": VEHICULE_PAYLOAD}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_usager_ne_voit_que_ses_dossiers(self):
        self._creer_dossier(self.usager)
        self._creer_dossier(self.autre)
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:dossiers:dossier-list"))
        self.assertEqual(resp.data["count"], 1)

    def test_agent_voit_tous_les_dossiers(self):
        self._creer_dossier(self.usager)
        self._creer_dossier(self.autre)
        self.client.force_authenticate(self.agent)
        resp = self.client.get(reverse("v1:dossiers:dossier-list"))
        self.assertEqual(resp.data["count"], 2)

    def test_autre_usager_ne_peut_pas_ouvrir_le_dossier(self):
        dossier = self._creer_dossier(self.usager)
        self.client.force_authenticate(self.autre)
        resp = self.client.get(reverse("v1:dossiers:dossier-detail", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class DocumentUploadTests(DossierBase):
    def test_upload_pdf_calcule_le_hash(self):
        dossier = self._creer_dossier()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(
            reverse("v1:dossiers:dossier-documents", args=[dossier.id]),
            {"type_document": "ASSURANCE", "fichier": pdf("assurance.pdf")},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(resp.data["hash_fichier"]), 64)  # SHA-256 hex
        self.assertEqual(resp.data["format"], "pdf")

    def test_format_non_autorise_rejete(self):
        dossier = self._creer_dossier()
        self.client.force_authenticate(self.usager)
        mauvais = SimpleUploadedFile("virus.exe", b"MZ", content_type="application/octet-stream")
        resp = self.client.post(
            reverse("v1:dossiers:dossier-documents", args=[dossier.id]),
            {"type_document": "AUTRE", "fichier": mauvais}, format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(MEDIA_ROOT=MEDIA_TMP, DOCUMENT_MAX_SIZE_MB=1)
    def test_fichier_trop_volumineux_rejete(self):
        dossier = self._creer_dossier()
        self.client.force_authenticate(self.usager)
        gros = SimpleUploadedFile("gros.pdf", b"%PDF-" + b"x" * (1024 * 1024 + 10),
                                  content_type="application/pdf")
        resp = self.client.post(
            reverse("v1:dossiers:dossier-documents", args=[dossier.id]),
            {"type_document": "FACTURE", "fichier": gros}, format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_interdit_apres_soumission(self):
        dossier = self._creer_dossier()
        dossier.statut = StatutDossier.SOUMIS
        dossier.save()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(
            reverse("v1:dossiers:dossier-documents", args=[dossier.id]),
            {"type_document": "ASSURANCE", "fichier": pdf()}, format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class SoumissionTests(DossierBase):
    def _doter_pieces_valides(self, dossier):
        aujourdhui = datetime.date.today()
        futur = aujourdhui + datetime.timedelta(days=180)
        passe = aujourdhui - datetime.timedelta(days=30)
        self._ajouter_doc(dossier, TypeDocument.ASSURANCE, date_debut=passe, date_fin=futur)
        self._ajouter_doc(dossier, TypeDocument.FACTURE, date_debut=passe)
        self._ajouter_doc(dossier, TypeDocument.CONTROLE_TECHNIQUE, date_debut=aujourdhui, date_fin=futur)

    def test_soumission_bloquee_si_pieces_manquantes(self):
        dossier = self._creer_dossier()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:dossiers:dossier-soumettre", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("problemes", resp.data)

    def test_soumission_reussie(self):
        dossier = self._creer_dossier()
        self._doter_pieces_valides(dossier)
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:dossiers:dossier-soumettre", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # La soumission déclenche la vérification auto (étape 3) → file de validation.
        self.assertEqual(resp.data["statut"], "EN_VALIDATION")
        self.assertIn("verification", resp.data)
        dossier.refresh_from_db()
        self.assertIsNotNone(dossier.date_soumission)

    def test_soumission_bloquee_si_dates_incoherentes(self):
        dossier = self._creer_dossier()
        aujourdhui = datetime.date.today()
        # Assurance : début APRÈS la fin → incohérent.
        self._ajouter_doc(dossier, TypeDocument.ASSURANCE,
                          date_debut=aujourdhui, date_fin=aujourdhui - datetime.timedelta(days=10))
        self._ajouter_doc(dossier, TypeDocument.FACTURE, date_debut=aujourdhui)
        self._ajouter_doc(dossier, TypeDocument.CONTROLE_TECHNIQUE,
                          date_debut=aujourdhui, date_fin=aujourdhui + datetime.timedelta(days=180))
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:dossiers:dossier-soumettre", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(any("postérieure" in p for p in resp.data["problemes"]))

    def test_soumission_bloquee_si_assurance_expiree(self):
        dossier = self._creer_dossier()
        aujourdhui = datetime.date.today()
        self._ajouter_doc(dossier, TypeDocument.ASSURANCE,
                          date_debut=aujourdhui - datetime.timedelta(days=400),
                          date_fin=aujourdhui - datetime.timedelta(days=1))  # expirée
        self._ajouter_doc(dossier, TypeDocument.FACTURE, date_debut=aujourdhui)
        self._ajouter_doc(dossier, TypeDocument.CONTROLE_TECHNIQUE,
                          date_debut=aujourdhui, date_fin=aujourdhui + datetime.timedelta(days=180))
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:dossiers:dossier-soumettre", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(any("expiré" in p for p in resp.data["problemes"]))

    def test_modification_interdite_apres_soumission(self):
        dossier = self._creer_dossier()
        self._doter_pieces_valides(dossier)
        self.client.force_authenticate(self.usager)
        self.client.post(reverse("v1:dossiers:dossier-soumettre", args=[dossier.id]))
        # Tentative de PATCH après soumission
        resp = self.client.patch(reverse("v1:dossiers:dossier-detail", args=[dossier.id]),
                                 {"vehicule": {"couleur": "Rouge"}}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

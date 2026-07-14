"""Tests de l'étape 4 : validation, rejet, demande de complément, historique."""
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.dossiers.models import (
    Document,
    Dossier,
    StatutDossier,
    StatutVerifDocument,
    TypeDocument,
    Vehicule,
)

from .models import ActionValidation, ValidationAgent

MEDIA_TMP = tempfile.mkdtemp()


def creer_user(email, role="USAGER", tel="+24570000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Nom", prenom="Prenom",
        password="pass1234", role=role, is_active=True,
    )


class ValidationBase(APITestCase):
    def setUp(self):
        self.usager = creer_user("usager@ex.gw")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+24570000003")

    def _dossier(self, statut=StatutDossier.EN_VALIDATION):
        veh = Vehicule.objects.create(
            proprietaire=self.usager, vin="VF1RFB00X67891234", marque="Toyota",
            modele="Corolla", annee=2019, energie="ESSENCE", type_vehicule="VP",
        )
        return Dossier.objects.create(
            usager=self.usager, vehicule=veh, statut=statut,
            numero_dossier=f"SNICV-2026-{Dossier.objects.count() + 1:06d}",
        )


class DecisionTests(ValidationBase):
    def test_agent_valide_le_dossier(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:validations:valider", args=[dossier.id]),
                                {"commentaire": "Pièces conformes"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["statut"], "VALIDE")
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.VALIDE)
        self.assertEqual(dossier.agent_assigne, self.agent)
        self.assertEqual(dossier.validations.first().action, ActionValidation.VALIDE)

    def test_agent_rejette_avec_motif(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:validations:rejeter", args=[dossier.id]),
                                {"motif": "Assurance non conforme"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.REJETE)
        self.assertEqual(dossier.motif_rejet, "Assurance non conforme")

    def test_rejet_sans_motif_refuse(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:validations:rejeter", args=[dossier.id]), {"motif": ""})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.EN_VALIDATION)

    def test_demande_de_complement_repasse_en_brouillon(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:validations:demander-complement", args=[dossier.id]),
                                {"commentaire": "Merci de fournir la carte grise recto-verso"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.BROUILLON)
        self.assertTrue(dossier.est_modifiable)
        self.assertEqual(dossier.validations.first().action, ActionValidation.DEMANDE_COMPLEMENT)

    def test_action_sur_mauvais_statut_refusee(self):
        dossier = self._dossier(statut=StatutDossier.BROUILLON)
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:validations:valider", args=[dossier.id]), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class PieceRefuseeTests(ValidationBase):
    """Un dossier dont une pièce a été refusée ne peut pas être validé."""

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def _piece(self, dossier, statut_verif):
        return Document.objects.create(
            dossier=dossier, type_document=TypeDocument.ASSURANCE,
            fichier=SimpleUploadedFile("p.pdf", b"%PDF-1.4"),
            statut_verif=statut_verif,
            motif_verif="Illisible" if statut_verif == StatutVerifDocument.NON_CONFORME else "",
        )

    def test_validation_bloquee_si_une_piece_refusee(self):
        dossier = self._dossier()
        self._piece(dossier, StatutVerifDocument.NON_CONFORME)
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:validations:valider", args=[dossier.id]), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.EN_VALIDATION)

    def test_validation_ok_si_pieces_conformes(self):
        dossier = self._dossier()
        self._piece(dossier, StatutVerifDocument.CONFORME)
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:validations:valider", args=[dossier.id]), {})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.VALIDE)

    def test_usager_corrige_le_dossier_rejete(self):
        """Un dossier rejeté redevient BROUILLON ; l'info de refus des pièces est conservée."""
        dossier = self._dossier(statut=StatutDossier.REJETE)
        dossier.motif_rejet = "Assurance illisible"
        dossier.save(update_fields=["motif_rejet"])
        piece = self._piece(dossier, StatutVerifDocument.NON_CONFORME)
        # L'agent ne peut pas rouvrir : réservé au propriétaire.
        self.client.force_authenticate(self.agent)
        self.assertEqual(
            self.client.post(reverse("v1:dossiers:dossier-rouvrir", args=[dossier.id])).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        # L'usager corrige son dossier.
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:dossiers:dossier-rouvrir", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        dossier.refresh_from_db()
        piece.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.BROUILLON)
        self.assertTrue(dossier.est_modifiable)
        # Motif et refus de pièce conservés : l'usager voit quoi corriger.
        self.assertEqual(dossier.motif_rejet, "Assurance illisible")
        self.assertEqual(piece.statut_verif, StatutVerifDocument.NON_CONFORME)

    def test_rouvrir_refuse_si_non_rejete(self):
        dossier = self._dossier(statut=StatutDossier.EN_VALIDATION)
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:dossiers:dossier-rouvrir", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deposer_remplace_une_piece_du_meme_type(self):
        """En brouillon, redéposer une pièce du même type remplace l'ancienne (refusée)."""
        dossier = self._dossier(statut=StatutDossier.BROUILLON)
        ancienne = self._piece(dossier, StatutVerifDocument.NON_CONFORME)
        self.client.force_authenticate(self.usager)
        resp = self.client.post(
            reverse("v1:dossiers:dossier-documents", args=[dossier.id]),
            {"type_document": TypeDocument.ASSURANCE,
             "fichier": SimpleUploadedFile("neuve.pdf", b"%PDF-1.4", content_type="application/pdf")},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        assurances = dossier.documents.filter(type_document=TypeDocument.ASSURANCE)
        self.assertEqual(assurances.count(), 1)
        self.assertEqual(assurances.first().statut_verif, StatutVerifDocument.EN_ATTENTE)
        self.assertFalse(dossier.documents.filter(id=ancienne.id).exists())


class PermissionsValidationTests(ValidationBase):
    def test_usager_ne_peut_pas_valider(self):
        dossier = self._dossier()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:validations:valider", args=[dossier.id]), {})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_force_ordre_ne_peut_pas_valider(self):
        dossier = self._dossier()
        force = creer_user("police@snicv.gw", role="FORCE_ORDRE", tel="+24570000007")
        self.client.force_authenticate(force)
        resp = self.client.post(reverse("v1:validations:valider", args=[dossier.id]), {})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class HistoriqueTests(ValidationBase):
    def test_proprietaire_voit_l_historique(self):
        dossier = self._dossier()
        ValidationAgent.objects.create(dossier=dossier, agent=self.agent,
                                       action=ActionValidation.REJETE, commentaire="Motif X")
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:validations:historique", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["commentaire"], "Motif X")

    def test_autre_usager_ne_voit_pas_l_historique(self):
        dossier = self._dossier()
        intrus = creer_user("intrus@ex.gw", tel="+24570000009")
        self.client.force_authenticate(intrus)
        resp = self.client.get(reverse("v1:validations:historique", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

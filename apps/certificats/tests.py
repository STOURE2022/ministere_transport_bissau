"""Tests de l'étape 6 : émission du certificat QR, signature RSA, PDF, révocation."""
import datetime
import shutil
import tempfile
import uuid as uuidlib

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.dossiers.models import Document, Dossier, StatutDossier, TypeDocument, Vehicule
from apps.immatriculations.models import Immatriculation

from . import crypto
from .models import Certificat, ScanLog, StatutCertificat

MEDIA_TMP = tempfile.mkdtemp()
KEYS_TMP = tempfile.mkdtemp()


def creer_user(email, role="USAGER", tel="+245955000001"):
    return User.objects.create_user(
        email=email, telephone=tel, nom="Koné", prenom="Fatoumata",
        password="pass1234", role=role, is_active=True,
    )


@override_settings(
    MEDIA_ROOT=MEDIA_TMP,
    SNICV_PRIVATE_KEY_PATH=f"{KEYS_TMP}/private.pem",
    SNICV_PUBLIC_KEY_PATH=f"{KEYS_TMP}/public.pem",
)
class CertificatBase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        shutil.rmtree(KEYS_TMP, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        crypto.generer_paire_cles()  # paire de clés éphémère (générée une fois, réutilisée)
        self.usager = creer_user("usager@ex.gw")
        self.agent = creer_user("agent@snicv.gw", role="AGENT", tel="+245955000003")
        self.admin = creer_user("admin@snicv.gw", role="ADMIN", tel="+245955000004")

    def _dossier_immatricule(self):
        veh = Vehicule.objects.create(
            proprietaire=self.usager, vin="VF1RFB00X67891234", marque="Toyota",
            modele="Corolla", annee=2019, energie="ESSENCE", type_vehicule="VP",
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
        for type_doc in (TypeDocument.ASSURANCE, TypeDocument.CONTROLE_TECHNIQUE):
            Document.objects.create(
                dossier=dossier, type_document=type_doc,
                fichier=SimpleUploadedFile("p.pdf", b"%PDF-1.4", content_type="application/pdf"),
                date_fin=futur,
            )
        return dossier


class CryptoTests(CertificatBase):
    def test_signature_roundtrip(self):
        data = b'{"a":1,"b":2}'
        signature = crypto.signer(data)
        self.assertTrue(crypto.verifier(data, signature))

    def test_alteration_detectee(self):
        signature = crypto.signer(b"donnees originales")
        self.assertFalse(crypto.verifier(b"donnees falsifiees", signature))


class EmissionTests(CertificatBase):
    def test_emission_reussie(self):
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(resp.data["hash_sha256"]), 64)
        self.assertTrue(resp.data["signature_rsa"])
        self.assertIn("/verify/", resp.data["qr_payload"])
        self.assertIn(resp.data["hash_sha256"], resp.data["qr_payload"])
        dossier.refresh_from_db()
        self.assertEqual(dossier.statut, StatutDossier.CERTIFIE)

    def test_signature_valide_sur_le_snapshot(self):
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.agent)
        self.client.post(reverse("v1:certificats:emettre", args=[dossier.id]))
        cert = Certificat.objects.get(dossier=dossier)
        canonical = crypto.canonicaliser(cert.donnees_snapshot)
        self.assertEqual(crypto.hash_sha256(canonical), cert.hash_sha256)
        self.assertTrue(crypto.verifier(canonical, cert.signature_rsa))
        # Falsification d'un champ → la signature ne concorde plus.
        falsifie = {**cert.donnees_snapshot, "proprietaire": "Fraudeur"}
        self.assertFalse(crypto.verifier(crypto.canonicaliser(falsifie), cert.signature_rsa))

    def test_pdf_genere(self):
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.agent)
        self.client.post(reverse("v1:certificats:emettre", args=[dossier.id]))
        cert = Certificat.objects.get(dossier=dossier)
        self.assertTrue(cert.pdf_fichier.name.endswith(".pdf"))
        self.assertGreater(cert.pdf_fichier.size, 0)

    def test_emission_refusee_si_non_immatricule(self):
        dossier = self._dossier_immatricule()
        dossier.statut = StatutDossier.VALIDE
        dossier.save()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_double_emission_refusee(self):
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.agent)
        self.client.post(reverse("v1:certificats:emettre", args=[dossier.id]))
        resp = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_usager_ne_peut_pas_emettre(self):
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.usager)
        resp = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class ConsultationRevocationTests(CertificatBase):
    def _emettre(self):
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id]))
        return resp.data["id"]

    def test_detail_par_proprietaire(self):
        cert_id = self._emettre()
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:certificats:detail", args=[cert_id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["statut"], "ACTIF")

    def test_detail_autre_usager_refuse(self):
        cert_id = self._emettre()
        intrus = creer_user("intrus@ex.gw", tel="+245955000009")
        self.client.force_authenticate(intrus)
        resp = self.client.get(reverse("v1:certificats:detail", args=[cert_id]))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_pdf_telechargeable(self):
        cert_id = self._emettre()
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:certificats:pdf", args=[cert_id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        debut = b"".join(resp.streaming_content)[:4]
        self.assertEqual(debut, b"%PDF")

    def test_revocation_par_admin(self):
        cert_id = self._emettre()
        self.client.force_authenticate(self.admin)
        resp = self.client.post(reverse("v1:certificats:revoquer", args=[cert_id]),
                                {"motif": "Fraude avérée"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(Certificat.objects.get(id=cert_id).statut, StatutCertificat.REVOQUE)

    def test_revocation_par_agent_interdite(self):
        cert_id = self._emettre()
        self.client.force_authenticate(self.agent)
        resp = self.client.post(reverse("v1:certificats:revoquer", args=[cert_id]), {})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class VerificationQRTests(CertificatBase):
    def setUp(self):
        super().setUp()
        cache.clear()  # isole le throttle "verify" entre les tests

    def _cert(self) -> Certificat:
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.agent)
        cid = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id])).data["id"]
        self.client.force_authenticate(None)  # la vérification est publique
        return Certificat.objects.get(id=cid)

    def test_verify_authentique(self):
        cert = self._cert()
        resp = self.client.get(reverse("v1:certificats:verify", args=[cert.id]),
                               {"h": cert.hash_sha256})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["resultat"], "AUTHENTIQUE")
        self.assertEqual(resp.data["certificat"]["immatriculation"], "AB 4821 BS")
        self.assertTrue(ScanLog.objects.filter(certificat=cert, resultat="AUTHENTIQUE").exists())

    def test_verify_hash_du_qr_falsifie(self):
        cert = self._cert()
        resp = self.client.get(reverse("v1:certificats:verify", args=[cert.id]), {"h": "0" * 64})
        self.assertEqual(resp.data["resultat"], "FALSIFIE")
        self.assertIsNone(resp.data["certificat"])

    def test_verify_snapshot_altere_en_base(self):
        cert = self._cert()
        cert.donnees_snapshot["proprietaire"] = "Fraudeur"
        cert.save(update_fields=["donnees_snapshot"])
        resp = self.client.get(reverse("v1:certificats:verify", args=[cert.id]))
        self.assertEqual(resp.data["resultat"], "FALSIFIE")

    def test_verify_revoque(self):
        cert = self._cert()
        cert.statut = StatutCertificat.REVOQUE
        cert.save(update_fields=["statut"])
        resp = self.client.get(reverse("v1:certificats:verify", args=[cert.id]))
        self.assertEqual(resp.data["resultat"], "REVOQUE")

    def test_verify_expire_bascule_le_statut(self):
        cert = self._cert()
        cert.date_expiration = timezone.now() - datetime.timedelta(days=1)
        cert.save(update_fields=["date_expiration"])
        resp = self.client.get(reverse("v1:certificats:verify", args=[cert.id]))
        self.assertEqual(resp.data["resultat"], "EXPIRE")
        cert.refresh_from_db()
        self.assertEqual(cert.statut, StatutCertificat.EXPIRE)

    def test_verify_introuvable(self):
        resp = self.client.get(reverse("v1:certificats:verify", args=[uuidlib.uuid4()]))
        self.assertEqual(resp.data["resultat"], "INTROUVABLE")
        self.assertIsNone(resp.data["certificat"])

    def test_verify_accessible_sans_authentification(self):
        cert = self._cert()
        resp = self.client.get(reverse("v1:certificats:verify", args=[cert.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class ScansHistoriqueTests(CertificatBase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def _cert_scanne(self) -> str:
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.agent)
        cid = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id])).data["id"]
        self.client.force_authenticate(None)
        self.client.get(reverse("v1:certificats:verify", args=[cid]))  # génère un scan
        return cid

    def test_historique_scans_pour_force_ordre(self):
        cid = self._cert_scanne()
        force = creer_user("police@snicv.gw", role="FORCE_ORDRE", tel="+245955000008")
        self.client.force_authenticate(force)
        resp = self.client.get(reverse("v1:certificats:scans", args=[cid]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["count"], 1)

    def test_historique_scans_refuse_a_l_usager(self):
        cid = self._cert_scanne()
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:certificats:scans", args=[cid]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class VerificationPlaqueTests(CertificatBase):
    def setUp(self):
        super().setUp()
        cache.clear()  # isole le throttle "verify"
        self.force = creer_user("police@snicv.gw", role="FORCE_ORDRE", tel="+245955000008")

    def _cert(self) -> Certificat:
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.agent)
        cid = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id])).data["id"]
        return Certificat.objects.get(id=cid)

    def _get(self, plaque):
        return self.client.get(reverse("v1:certificats:verify-plaque"),
                               {"immatriculation": plaque})

    def test_plaque_authentique(self):
        self._cert()
        self.client.force_authenticate(self.force)
        resp = self._get("AB 4821 BS")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["resultat"], "AUTHENTIQUE")
        self.assertEqual(resp.data["methode"], "PLAQUE")
        self.assertEqual(resp.data["certificat"]["immatriculation"], "AB 4821 BS")

    def test_plaque_insensible_casse_et_espaces(self):
        self._cert()
        self.client.force_authenticate(self.force)
        resp = self._get("  ab 4821   bs ")
        self.assertEqual(resp.data["resultat"], "AUTHENTIQUE")

    def test_plaque_revoquee(self):
        cert = self._cert()
        cert.statut = StatutCertificat.REVOQUE
        cert.save(update_fields=["statut"])
        self.client.force_authenticate(self.force)
        resp = self._get("AB 4821 BS")
        self.assertEqual(resp.data["resultat"], "REVOQUE")

    def test_plaque_expiree_bascule_statut(self):
        cert = self._cert()
        cert.date_expiration = timezone.now() - datetime.timedelta(days=1)
        cert.save(update_fields=["date_expiration"])
        self.client.force_authenticate(self.force)
        resp = self._get("AB 4821 BS")
        self.assertEqual(resp.data["resultat"], "EXPIRE")
        cert.refresh_from_db()
        self.assertEqual(cert.statut, StatutCertificat.EXPIRE)

    def test_plaque_introuvable(self):
        self.client.force_authenticate(self.force)
        resp = self._get("ZZ 9999 BS")
        self.assertEqual(resp.data["resultat"], "INTROUVABLE")
        self.assertIsNone(resp.data["certificat"])

    def test_plaque_journalise_le_controle(self):
        self._cert()
        self.client.force_authenticate(self.force)
        self._get("AB 4821 BS")
        self.assertTrue(
            ScanLog.objects.filter(methode="PLAQUE", resultat="AUTHENTIQUE",
                                   scanne_par=self.force).exists()
        )

    def test_plaque_refusee_sans_authentification(self):
        self._cert()
        self.client.force_authenticate(None)
        resp = self._get("AB 4821 BS")
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_plaque_refusee_a_l_usager(self):
        self._cert()
        self.client.force_authenticate(self.usager)
        resp = self._get("AB 4821 BS")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_parametre_manquant(self):
        self.client.force_authenticate(self.force)
        resp = self.client.get(reverse("v1:certificats:verify-plaque"))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class ScansGlobalTests(CertificatBase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def test_historique_global_pour_force_ordre(self):
        dossier = self._dossier_immatricule()
        self.client.force_authenticate(self.agent)
        cid = self.client.post(reverse("v1:certificats:emettre", args=[dossier.id])).data["id"]
        self.client.force_authenticate(None)
        self.client.get(reverse("v1:certificats:verify", args=[cid]))  # un scan
        force = creer_user("police2@snicv.gw", role="FORCE_ORDRE", tel="+245955000010")
        self.client.force_authenticate(force)
        resp = self.client.get(reverse("v1:certificats:scans-global"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["count"], 1)
        self.assertIn("methode", resp.data["results"][0])

    def test_historique_global_refuse_a_l_usager(self):
        self.client.force_authenticate(self.usager)
        resp = self.client.get(reverse("v1:certificats:scans-global"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

"""Serializers de l'app certificats."""
import base64
import json

from rest_framework import serializers

from . import crypto
from .models import Certificat, ScanLog


def construire_jeton_hors_ligne(certificat) -> str:
    """
    Jeton auto-porteur pour vérification HORS-LIGNE : contient la sérialisation
    canonique signée (`c`) et la signature (`s`), plus des champs d'affichage.
    Un vérificateur muni de la clé publique valide la signature sur `c` sans réseau.
    """
    canonique = crypto.canonicaliser(certificat.donnees_snapshot).decode("utf-8")
    payload = {
        "v": 1,
        "c": canonique,
        "s": certificat.signature_rsa,
        "id": str(certificat.id),
        "exp": certificat.date_expiration.isoformat(),
    }
    brut = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(brut).decode("ascii")


class CertificatSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    est_valide = serializers.BooleanField(read_only=True)
    pdf_url = serializers.SerializerMethodField()
    jeton_hors_ligne = serializers.SerializerMethodField()

    class Meta:
        model = Certificat
        fields = (
            "id", "dossier", "statut", "statut_libelle", "est_valide",
            "donnees_snapshot", "hash_sha256", "signature_rsa", "qr_payload",
            "pdf_url", "jeton_hors_ligne", "date_emission", "date_expiration", "motif_revocation",
        )
        read_only_fields = fields

    def get_pdf_url(self, obj) -> str | None:
        if not obj.pdf_fichier:
            return None
        request = self.context.get("request")
        url = obj.pdf_fichier.url
        return request.build_absolute_uri(url) if request else url

    def get_jeton_hors_ligne(self, obj) -> str:
        return construire_jeton_hors_ligne(obj)


class RevocationSerializer(serializers.Serializer):
    motif = serializers.CharField(required=False, allow_blank=True, default="")


class CertificatPublicSerializer(serializers.Serializer):
    """Données non sensibles renvoyées lors d'une vérification QR."""

    immatriculation = serializers.CharField(allow_null=True)
    proprietaire = serializers.CharField(allow_null=True)
    marque_modele = serializers.CharField(allow_null=True)
    annee = serializers.IntegerField(allow_null=True)
    statut = serializers.CharField()
    assurance_echeance = serializers.CharField(allow_null=True)
    ct_echeance = serializers.CharField(allow_null=True)
    date_emission = serializers.DateTimeField()
    date_expiration = serializers.DateTimeField()


class VerificationResultSerializer(serializers.Serializer):
    """Réponse de l'endpoint public de vérification."""

    resultat = serializers.CharField()
    message = serializers.CharField()
    verifie_le = serializers.DateTimeField()
    certificat = CertificatPublicSerializer(allow_null=True)


class ScanLogSerializer(serializers.ModelSerializer):
    resultat_libelle = serializers.CharField(source="get_resultat_display", read_only=True)
    methode_libelle = serializers.CharField(source="get_methode_display", read_only=True)
    scanne_par_nom = serializers.SerializerMethodField()
    immatriculation = serializers.SerializerMethodField()

    class Meta:
        model = ScanLog
        fields = ("id", "resultat", "resultat_libelle", "methode", "methode_libelle",
                  "immatriculation", "scanne_par", "scanne_par_nom",
                  "ip", "localisation", "date_scan")
        read_only_fields = fields

    def get_scanne_par_nom(self, obj) -> str | None:
        if obj.scanne_par is None:
            return None
        return f"{obj.scanne_par.prenom} {obj.scanne_par.nom}"

    def get_immatriculation(self, obj) -> str | None:
        if obj.certificat is None:
            return None
        return (obj.certificat.donnees_snapshot or {}).get("immatriculation")

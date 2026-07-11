"""Serializers de l'app certificats."""
from rest_framework import serializers

from .models import Certificat, ScanLog


class CertificatSerializer(serializers.ModelSerializer):
    statut_libelle = serializers.CharField(source="get_statut_display", read_only=True)
    est_valide = serializers.BooleanField(read_only=True)
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificat
        fields = (
            "id", "dossier", "statut", "statut_libelle", "est_valide",
            "donnees_snapshot", "hash_sha256", "signature_rsa", "qr_payload",
            "pdf_url", "date_emission", "date_expiration", "motif_revocation",
        )
        read_only_fields = fields

    def get_pdf_url(self, obj) -> str | None:
        if not obj.pdf_fichier:
            return None
        request = self.context.get("request")
        url = obj.pdf_fichier.url
        return request.build_absolute_uri(url) if request else url


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
    scanne_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = ScanLog
        fields = ("id", "resultat", "resultat_libelle", "scanne_par", "scanne_par_nom",
                  "ip", "localisation", "date_scan")
        read_only_fields = fields

    def get_scanne_par_nom(self, obj) -> str | None:
        if obj.scanne_par is None:
            return None
        return f"{obj.scanne_par.prenom} {obj.scanne_par.nom}"

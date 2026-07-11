from django.contrib import admin

from .models import Certificat, ScanLog


@admin.register(Certificat)
class CertificatAdmin(admin.ModelAdmin):
    list_display = ("id", "dossier", "statut", "date_emission", "date_expiration")
    list_filter = ("statut",)
    search_fields = ("id", "dossier__numero_dossier", "hash_sha256")
    readonly_fields = ("id", "dossier", "vehicule", "donnees_snapshot", "hash_sha256",
                       "signature_rsa", "qr_payload", "pdf_fichier", "date_emission",
                       "date_expiration", "date_creation", "date_maj")

    def has_add_permission(self, request):
        return False  # émis via l'endpoint dédié (signature RSA)


@admin.register(ScanLog)
class ScanLogAdmin(admin.ModelAdmin):
    list_display = ("uuid_scanne", "resultat", "scanne_par", "ip", "date_scan")
    list_filter = ("resultat", "date_scan")
    search_fields = ("uuid_scanne", "certificat__id")
    readonly_fields = ("id", "certificat", "uuid_scanne", "resultat", "scanne_par",
                       "ip", "localisation", "date_scan")

    def has_add_permission(self, request):
        return False

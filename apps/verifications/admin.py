from django.contrib import admin

from .models import VerificationAuto


@admin.register(VerificationAuto)
class VerificationAutoAdmin(admin.ModelAdmin):
    list_display = ("dossier", "niveau_risque", "score_fraude", "doublon_detecte",
                    "vin_valide", "assurance_valide", "ct_valide", "date_maj")
    list_filter = ("niveau_risque", "doublon_detecte", "vin_valide")
    search_fields = ("dossier__numero_dossier",)
    readonly_fields = ("id", "dossier", "vin_valide", "assurance_valide", "ct_valide",
                       "doublon_detecte", "dossier_doublon", "score_fraude",
                       "niveau_risque", "details", "date_creation", "date_maj")

    def has_add_permission(self, request):
        return False  # généré par le moteur de vérification

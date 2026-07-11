from django.contrib import admin

from .models import ValidationAgent


@admin.register(ValidationAgent)
class ValidationAgentAdmin(admin.ModelAdmin):
    list_display = ("dossier", "action", "agent", "date_creation")
    list_filter = ("action", "date_creation")
    search_fields = ("dossier__numero_dossier", "agent__email")
    readonly_fields = ("id", "dossier", "agent", "action", "commentaire",
                       "date_creation", "date_maj")

    def has_add_permission(self, request):
        return False  # créé via les endpoints de validation

    def has_change_permission(self, request, obj=None):
        return False  # historique en lecture seule

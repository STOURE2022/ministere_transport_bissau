from django.contrib import admin

from .models import Signalement


@admin.register(Signalement)
class SignalementAdmin(admin.ModelAdmin):
    list_display = ("type", "statut", "vehicule", "reference", "date_signalement")
    list_filter = ("type", "statut")
    search_fields = ("vehicule__vin", "reference")
    autocomplete_fields = ()

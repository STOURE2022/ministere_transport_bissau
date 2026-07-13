from django.contrib import admin

from .models import Infraction, TypeInfraction


@admin.register(TypeInfraction)
class TypeInfractionAdmin(admin.ModelAdmin):
    list_display = ("libelle", "code", "montant", "actif", "ordre")
    list_editable = ("montant", "actif", "ordre")
    search_fields = ("libelle", "code")


@admin.register(Infraction)
class InfractionAdmin(admin.ModelAdmin):
    list_display = ("reference", "libelle", "montant", "statut", "date_infraction")
    list_filter = ("statut", "type_infraction")
    search_fields = ("reference", "quittance_reference", "vehicule__vin")
    readonly_fields = ("reference", "quittance_reference", "reference_transaction", "paye_le")

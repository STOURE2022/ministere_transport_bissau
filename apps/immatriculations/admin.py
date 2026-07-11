from django.contrib import admin

from .models import Immatriculation


@admin.register(Immatriculation)
class ImmatriculationAdmin(admin.ModelAdmin):
    list_display = ("numero", "serie_plaque", "vehicule", "agent", "date_attribution")
    list_filter = ("serie_plaque",)
    search_fields = ("numero", "vehicule__vin")
    readonly_fields = ("id", "vehicule", "numero", "serie_plaque", "sequence",
                       "agent", "date_attribution", "date_creation", "date_maj")

    def has_add_permission(self, request):
        return False  # attribuée via l'endpoint dédié

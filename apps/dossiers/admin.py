from django.contrib import admin

from .models import Document, Dossier, Vehicule


class DocumentInline(admin.TabularInline):
    model = Document
    extra = 0
    readonly_fields = ("format", "taille", "hash_fichier", "statut_verif", "date_creation")
    fields = ("type_document", "fichier", "date_debut", "date_fin",
              "statut_verif", "hash_fichier")


@admin.register(Vehicule)
class VehiculeAdmin(admin.ModelAdmin):
    list_display = ("vin", "marque", "modele", "annee", "type_vehicule", "proprietaire")
    list_filter = ("type_vehicule", "energie")
    search_fields = ("vin", "marque", "modele", "proprietaire__email")
    readonly_fields = ("id", "date_creation", "date_maj")


@admin.register(Dossier)
class DossierAdmin(admin.ModelAdmin):
    list_display = ("numero_dossier", "usager", "statut", "agent_assigne",
                    "date_creation", "date_soumission")
    list_filter = ("statut",)
    search_fields = ("numero_dossier", "usager__email", "vehicule__vin")
    readonly_fields = ("id", "numero_dossier", "date_creation", "date_maj", "date_soumission")
    inlines = [DocumentInline]
    autocomplete_fields = ("usager", "vehicule", "agent_assigne")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("type_document", "dossier", "format", "statut_verif", "date_creation")
    list_filter = ("type_document", "statut_verif", "format")
    search_fields = ("dossier__numero_dossier",)
    readonly_fields = ("id", "format", "taille", "hash_fichier", "date_creation", "date_maj")

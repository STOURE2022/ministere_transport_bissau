from django.contrib import admin

from .models import CorpsControle, DemandeHabilitation


@admin.register(CorpsControle)
class CorpsControleAdmin(admin.ModelAdmin):
    list_display = ("nom", "code", "sigle", "couleur", "actif", "ordre")
    list_filter = ("actif",)
    search_fields = ("nom", "code", "sigle")
    ordering = ("ordre", "nom")


@admin.register(DemandeHabilitation)
class DemandeHabilitationAdmin(admin.ModelAdmin):
    list_display = ("reference", "user", "corps", "matricule", "statut", "decide_par", "date_creation")
    list_filter = ("statut", "corps")
    search_fields = ("reference", "matricule", "user__email", "user__nom", "user__prenom")
    readonly_fields = ("id", "reference", "date_creation", "date_maj")
    autocomplete_fields = ("user", "corps", "decide_par")

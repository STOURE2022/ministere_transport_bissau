from django.contrib import admin

from .models import ConfigurationPaiement, OperateurPaiement, Paiement


@admin.register(ConfigurationPaiement)
class ConfigurationPaiementAdmin(admin.ModelAdmin):
    list_display = ("devise", "montant_taxe", "montant_timbre", "frais_service", "paiement_requis")


@admin.register(OperateurPaiement)
class OperateurPaiementAdmin(admin.ModelAdmin):
    list_display = ("nom", "code", "code_ussd", "actif", "ordre")
    list_editable = ("actif", "ordre")


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ("reference", "dossier", "montant_total", "devise", "operateur", "statut", "paye_le")
    list_filter = ("statut", "operateur", "devise")
    search_fields = ("reference", "dossier__numero_dossier", "reference_transaction")

"""Routes de l'app paiements (préfixe /api/v1/)."""
from django.urls import path

from .views import (
    ConfigurationView,
    DossierPaiementView,
    MontantView,
    OperateurDetailView,
    OperateurListCreateView,
    PaiementListView,
    PaiementStatsView,
    RecuPdfView,
)

app_name = "paiements"

urlpatterns = [
    path("dossiers/<uuid:dossier_id>/paiement/montant/", MontantView.as_view(), name="montant"),
    path("dossiers/<uuid:dossier_id>/paiement/", DossierPaiementView.as_view(), name="dossier-paiement"),
    path("paiements/", PaiementListView.as_view(), name="liste"),
    path("paiements/stats/", PaiementStatsView.as_view(), name="stats"),
    path("paiements/configuration/", ConfigurationView.as_view(), name="configuration"),
    path("paiements/operateurs/", OperateurListCreateView.as_view(), name="operateurs"),
    path("paiements/operateurs/<uuid:pk>/", OperateurDetailView.as_view(), name="operateur-detail"),
    path("paiements/<uuid:pk>/recu/", RecuPdfView.as_view(), name="recu"),
]

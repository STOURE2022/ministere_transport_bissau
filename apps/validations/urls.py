"""Routes de l'app validations (préfixe /api/v1/)."""
from django.urls import path

from .views import (
    DemanderComplementView,
    HistoriqueView,
    RejeterView,
    ValiderView,
)

app_name = "validations"

urlpatterns = [
    path("dossiers/<uuid:dossier_id>/valider/", ValiderView.as_view(), name="valider"),
    path("dossiers/<uuid:dossier_id>/rejeter/", RejeterView.as_view(), name="rejeter"),
    path("dossiers/<uuid:dossier_id>/demander-complement/",
         DemanderComplementView.as_view(), name="demander-complement"),
    path("dossiers/<uuid:dossier_id>/historique/", HistoriqueView.as_view(), name="historique"),
]

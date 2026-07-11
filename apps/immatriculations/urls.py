"""Routes de l'app immatriculations (préfixe /api/v1/)."""
from django.urls import path

from .views import ImmatriculationDetailView, ImmatriculerView

app_name = "immatriculations"

urlpatterns = [
    path("dossiers/<uuid:dossier_id>/immatriculer/",
         ImmatriculerView.as_view(), name="immatriculer"),
    path("dossiers/<uuid:dossier_id>/immatriculation/",
         ImmatriculationDetailView.as_view(), name="immatriculation-detail"),
]

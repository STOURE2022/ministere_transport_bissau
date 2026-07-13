"""Routes des habilitations (préfixe /api/v1/)."""
from django.urls import path

from .views import (
    CorpsActifsView,
    CorpsAdminDetailView,
    CorpsAdminListView,
    HabilitationDetailView,
    HabilitationJustificatifView,
    HabilitationListView,
    HabilitationRejeterView,
    HabilitationStatsView,
    HabilitationValiderView,
    InscriptionControleView,
    ResoumettreHabilitationView,
)

app_name = "habilitations"

urlpatterns = [
    # Public
    path("corps/", CorpsActifsView.as_view(), name="corps-actifs"),
    path("inscription-controle/", InscriptionControleView.as_view(), name="inscription-controle"),
    path("habilitations/resoumettre/", ResoumettreHabilitationView.as_view(), name="resoumettre"),
    # File de validation (staff)
    path("habilitations/", HabilitationListView.as_view(), name="liste"),
    path("habilitations/stats/", HabilitationStatsView.as_view(), name="stats"),
    # Gestion des corps (admin) — avant le motif <uuid:pk> générique
    path("habilitations/corps/", CorpsAdminListView.as_view(), name="corps-admin"),
    path("habilitations/corps/<uuid:pk>/", CorpsAdminDetailView.as_view(), name="corps-admin-detail"),
    path("habilitations/<uuid:pk>/", HabilitationDetailView.as_view(), name="detail"),
    path("habilitations/<uuid:pk>/justificatif/", HabilitationJustificatifView.as_view(), name="justificatif"),
    path("habilitations/<uuid:pk>/valider/", HabilitationValiderView.as_view(), name="valider"),
    path("habilitations/<uuid:pk>/rejeter/", HabilitationRejeterView.as_view(), name="rejeter"),
]

"""Routes de l'app infractions (préfixe /api/v1/)."""
from django.urls import path

from .views import (
    AnnulerView,
    CibleView,
    ContesterView,
    InfractionDetailView,
    InfractionListCreateView,
    InfractionStatsView,
    PayerAmendeView,
    QuittancePdfView,
    RejeterContestationView,
    TypeInfractionDetailView,
    TypeInfractionListCreateView,
)

app_name = "infractions"

urlpatterns = [
    path("infractions/types/", TypeInfractionListCreateView.as_view(), name="types"),
    path("infractions/types/<uuid:pk>/", TypeInfractionDetailView.as_view(), name="type-detail"),
    path("infractions/cible/", CibleView.as_view(), name="cible"),
    path("infractions/stats/", InfractionStatsView.as_view(), name="stats"),
    path("infractions/", InfractionListCreateView.as_view(), name="liste"),
    path("infractions/<uuid:pk>/", InfractionDetailView.as_view(), name="detail"),
    path("infractions/<uuid:pk>/payer/", PayerAmendeView.as_view(), name="payer"),
    path("infractions/<uuid:pk>/contester/", ContesterView.as_view(), name="contester"),
    path("infractions/<uuid:pk>/annuler/", AnnulerView.as_view(), name="annuler"),
    path("infractions/<uuid:pk>/rejeter-contestation/", RejeterContestationView.as_view(),
         name="rejeter-contestation"),
    path("infractions/<uuid:pk>/quittance/", QuittancePdfView.as_view(), name="quittance"),
]

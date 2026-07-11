"""Routes transversales (statistiques de pilotage)."""
from django.urls import path

from .views import DashboardStatsView

app_name = "core"

urlpatterns = [
    path("stats/dashboard/", DashboardStatsView.as_view(), name="stats-dashboard"),
]

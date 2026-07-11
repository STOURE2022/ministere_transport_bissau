"""Routes transversales (statistiques de pilotage)."""
from django.urls import path

from .views import DashboardStatsView, PublicStatsView

app_name = "core"

urlpatterns = [
    path("stats/public/", PublicStatsView.as_view(), name="stats-public"),
    path("stats/dashboard/", DashboardStatsView.as_view(), name="stats-dashboard"),
]

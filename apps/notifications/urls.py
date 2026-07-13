"""Routes de l'app notifications (préfixe /api/v1/)."""
from django.urls import path

from .views import (
    CompteurNonLuesView,
    EcheancesView,
    MarquerLuView,
    MarquerToutLuView,
    NotificationListView,
    PreferencesView,
)

app_name = "notifications"

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="liste"),
    path("notifications/compteur/", CompteurNonLuesView.as_view(), name="compteur"),
    path("notifications/tout-lu/", MarquerToutLuView.as_view(), name="tout-lu"),
    path("notifications/echeances/", EcheancesView.as_view(), name="echeances"),
    path("notifications/preferences/", PreferencesView.as_view(), name="preferences"),
    path("notifications/<uuid:pk>/lu/", MarquerLuView.as_view(), name="marquer-lu"),
]

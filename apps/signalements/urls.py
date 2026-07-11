"""Routes de l'app signalements (préfixe /api/v1/)."""
from django.urls import path

from .views import SignalementLeverView, SignalementListCreateView

app_name = "signalements"

urlpatterns = [
    path("signalements/", SignalementListCreateView.as_view(), name="liste-creer"),
    path("signalements/<uuid:pk>/lever/", SignalementLeverView.as_view(), name="lever"),
]

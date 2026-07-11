"""Routes de l'app vérifications (préfixe /api/v1/)."""
from django.urls import path

from .views import RelancerVerificationView, VerificationDetailView

app_name = "verifications"

urlpatterns = [
    path("dossiers/<uuid:dossier_id>/verification/",
         VerificationDetailView.as_view(), name="verification-detail"),
    path("dossiers/<uuid:dossier_id>/verification/relancer/",
         RelancerVerificationView.as_view(), name="verification-relancer"),
]

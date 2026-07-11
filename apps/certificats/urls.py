"""Routes de l'app certificats (préfixe /api/v1/)."""
from django.urls import path

from .views import (
    CertificatDetailView,
    CertificatPdfView,
    EmettreCertificatView,
    RevoquerCertificatView,
    ScansGlobalListView,
    ScansListView,
    VerifyPlaqueView,
    VerifyView,
)

app_name = "certificats"

urlpatterns = [
    path("dossiers/<uuid:dossier_id>/certificat/",
         EmettreCertificatView.as_view(), name="emettre"),
    path("certificats/<uuid:uuid>/", CertificatDetailView.as_view(), name="detail"),
    path("certificats/<uuid:uuid>/pdf/", CertificatPdfView.as_view(), name="pdf"),
    path("certificats/<uuid:uuid>/revoquer/", RevoquerCertificatView.as_view(), name="revoquer"),
    path("certificats/<uuid:uuid>/scans/", ScansListView.as_view(), name="scans"),
    # Historique global des contrôles (forces de l'ordre / staff).
    path("scans/", ScansGlobalListView.as_view(), name="scans-global"),
    # Vérification publique (terrain) — l'URL encodée dans le QR.
    path("verify/<uuid:uuid>/", VerifyView.as_view(), name="verify"),
    # Vérification par numéro de plaque (secours QR illisible, staff).
    path("verify-plaque/", VerifyPlaqueView.as_view(), name="verify-plaque"),
]

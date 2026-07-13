"""Routes de l'app dossiers (préfixe /api/v1/)."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ArchiverView,
    DocumentDetailView,
    DocumentFichierView,
    DocumentListCreateView,
    DocumentVerifierView,
    DossierViewSet,
    HistoriquePdfView,
    HistoriqueView,
)

app_name = "dossiers"

router = DefaultRouter()
router.register("dossiers", DossierViewSet, basename="dossier")

urlpatterns = [
    path("dossiers/<uuid:dossier_id>/cycle-de-vie/",
         HistoriqueView.as_view(), name="dossier-cycle-vie"),
    path("dossiers/<uuid:dossier_id>/cycle-de-vie/pdf/",
         HistoriquePdfView.as_view(), name="dossier-cycle-vie-pdf"),
    path("dossiers/<uuid:dossier_id>/archiver/",
         ArchiverView.as_view(), name="dossier-archiver"),
    path("dossiers/<uuid:dossier_id>/documents/",
         DocumentListCreateView.as_view(), name="dossier-documents"),
    path("documents/<uuid:pk>/fichier/",
         DocumentFichierView.as_view(), name="document-fichier"),
    path("documents/<uuid:pk>/verifier/",
         DocumentVerifierView.as_view(), name="document-verifier"),
    path("documents/<uuid:pk>/",
         DocumentDetailView.as_view(), name="document-detail"),
]
urlpatterns += router.urls

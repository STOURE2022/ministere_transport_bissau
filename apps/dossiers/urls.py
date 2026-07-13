"""Routes de l'app dossiers (préfixe /api/v1/)."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DocumentDetailView,
    DocumentFichierView,
    DocumentListCreateView,
    DossierViewSet,
)

app_name = "dossiers"

router = DefaultRouter()
router.register("dossiers", DossierViewSet, basename="dossier")

urlpatterns = [
    path("dossiers/<uuid:dossier_id>/documents/",
         DocumentListCreateView.as_view(), name="dossier-documents"),
    path("documents/<uuid:pk>/fichier/",
         DocumentFichierView.as_view(), name="document-fichier"),
    path("documents/<uuid:pk>/",
         DocumentDetailView.as_view(), name="document-detail"),
]
urlpatterns += router.urls

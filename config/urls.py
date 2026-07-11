"""Routage racine du projet SNICV."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

api_v1 = [
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.dossiers.urls")),
    path("", include("apps.verifications.urls")),
    path("", include("apps.validations.urls")),
    path("", include("apps.immatriculations.urls")),
    path("", include("apps.certificats.urls")),
    # Étape 7 (vérification QP temps réel) s'ajoutera ici.
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "api"), namespace="v1")),
    # Documentation OpenAPI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

# Sert les fichiers médias (documents déposés) en développement.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

"""
Configuration Django — SNICV (Système National d'Immatriculation
et de Contrôle des Véhicules) · Module Certificat QR.
"""
import sys
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Variables d'environnement ──
env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, ["http://localhost:3000", "http://localhost:5173"]),
    DATABASE_URL=(str, ""),
    JWT_ACCESS_MINUTES=(int, 30),
    JWT_REFRESH_DAYS=(int, 7),
    OTP_BACKEND=(str, "console"),
    OTP_CODE_TTL_MINUTES=(int, 10),
    OTP_CODE_LENGTH=(int, 6),
)
# Charge .env s'il existe (sinon on s'appuie sur les valeurs par défaut ci-dessus).
env_file = BASE_DIR / ".env"
if env_file.exists():
    environ.Env.read_env(env_file)

SECRET_KEY = env("SECRET_KEY", default="dev-insecure-secret-key-change-me")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# ── Déploiement Railway ──
# Railway fournit RAILWAY_PUBLIC_DOMAIN / RAILWAY_PRIVATE_DOMAIN. On autorise
# aussi *.railway.app et *.railway.internal (health checks, domaine interne).
RAILWAY_PUBLIC_DOMAIN = env("RAILWAY_PUBLIC_DOMAIN", default="")
RAILWAY_PRIVATE_DOMAIN = env("RAILWAY_PRIVATE_DOMAIN", default="")
CSRF_TRUSTED_ORIGINS = ["https://*.railway.app"]
ALLOWED_HOSTS += [".railway.app", ".railway.internal"]
for _domaine in (RAILWAY_PUBLIC_DOMAIN, RAILWAY_PRIVATE_DOMAIN):
    if _domaine:
        ALLOWED_HOSTS.append(_domaine)
if RAILWAY_PUBLIC_DOMAIN:
    CSRF_TRUSTED_ORIGINS.append(f"https://{RAILWAY_PUBLIC_DOMAIN}")

# ── Applications ──
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]
THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
]
LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.dossiers",
    "apps.verifications",
    "apps.validations",
    "apps.immatriculations",
    "apps.certificats",
    "apps.signalements",
    "apps.notifications",
    "apps.paiements",
    "apps.infractions",
]
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # sert les fichiers statiques en prod
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ── Base de données ──
# PostgreSQL en production via DATABASE_URL ; SQLite en repli pour le dev local.
if env("DATABASE_URL"):
    DATABASES = {"default": env.db("DATABASE_URL")}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ── Modèle utilisateur personnalisé ──
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# En contexte de test : hachage rapide (MD5) pour accélérer la suite.
# N'affecte JAMAIS la production (PBKDF2 par défaut de Django y reste actif).
if "test" in sys.argv:
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# ── Internationalisation ──
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Bissau"
USE_I18N = True
USE_TZ = True

# ── Fichiers statiques / médias ──
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# WhiteNoise : compression + service des statiques directement par l'app (prod).
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Django REST Framework ──
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "otp": "5/min",       # anti-bruteforce sur la vérification OTP
        "register": "10/hour",
        "verify": "60/min",   # vérification QR (public, usage terrain)
    },
}

# ── JWT (Simple JWT) ──
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env("JWT_ACCESS_MINUTES")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env("JWT_REFRESH_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ── OpenAPI / Swagger ──
SPECTACULAR_SETTINGS = {
    "TITLE": "SNICV — API Certificat QR",
    "DESCRIPTION": "Système National d'Immatriculation et de Contrôle des Véhicules. "
                   "Gestion du cycle de vie des dossiers d'immatriculation et des "
                   "certificats numériques sécurisés (QR + signature RSA).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

# ── CORS ──
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
# Autorise automatiquement tout front hébergé sur Railway (*.railway.app),
# sans avoir à ré-énumérer l'origine à chaque déploiement.
CORS_ALLOWED_ORIGIN_REGEXES = [r"^https://.*\.railway\.app$"]

# ── Paramètres OTP / notifications ──
OTP_BACKEND = env("OTP_BACKEND")          # console | mock
OTP_CODE_TTL_MINUTES = env("OTP_CODE_TTL_MINUTES")
OTP_CODE_LENGTH = env("OTP_CODE_LENGTH")

# ── Immatriculation ──
# Suffixe de plaque (bureau émetteur), ex. « AB 4821 BS » (BS = Bissau).
IMMATRICULATION_SUFFIXE = env("IMMATRICULATION_SUFFIXE", default="BS")
# Suffixe dédié aux plaques moto/tricycle (distinct de celui des voitures).
IMMATRICULATION_SUFFIXE_MOTO = env("IMMATRICULATION_SUFFIXE_MOTO", default="SB")

# Passerelle mobile money (abstraite) — mockée par défaut, vraie passerelle
# (Orange Money / MTN MoMo) branchée plus tard sans toucher au code métier.
PAIEMENT_BACKEND = env("PAIEMENT_BACKEND", default="apps.paiements.passerelle.PasserelleMock")

# ── Certificat QR (signature RSA) ──
# Répertoire des clés SNICV. La clé PRIVÉE ne doit JAMAIS être committée
# (voir .gitignore). En production, provisionnez-la via un secret manager.
SNICV_KEYS_DIR = env("SNICV_KEYS_DIR", default=str(BASE_DIR / "keys"))
SNICV_PRIVATE_KEY_PATH = env(
    "SNICV_PRIVATE_KEY_PATH", default=str(BASE_DIR / "keys" / "snicv_private.pem"))
SNICV_PUBLIC_KEY_PATH = env(
    "SNICV_PUBLIC_KEY_PATH", default=str(BASE_DIR / "keys" / "snicv_public.pem"))
# Alternative sans fichier (recommandé en prod / Railway) : clés PEM en base64.
# Prioritaires sur les chemins de fichiers ci-dessus si définies.
SNICV_PRIVATE_KEY_B64 = env("SNICV_PRIVATE_KEY_B64", default="")
SNICV_PUBLIC_KEY_B64 = env("SNICV_PUBLIC_KEY_B64", default="")
# URL de base encodée dans le QR : elle doit pointer vers la PAGE FRONT de
# vérification (/verify/<uuid>/?h=...), pas vers l'API JSON. La page front
# appelle ensuite l'endpoint public de vérification. Surchargeable par env.
SNICV_VERIFY_BASE_URL = env(
    "SNICV_VERIFY_BASE_URL",
    default="https://surprising-vision-production.up.railway.app",
)
# Durée de validité du certificat (renouvellement en étape 8).
CERTIFICAT_VALIDITE_ANNEES = env.int("CERTIFICAT_VALIDITE_ANNEES", default=1)

# ── Documents (upload) ──
DOCUMENT_MAX_SIZE_MB = env.int("DOCUMENT_MAX_SIZE_MB", default=5)
# Taille max des requêtes multipart (garde-fou serveur, marge au-dessus de la limite fichier).
DATA_UPLOAD_MAX_MEMORY_SIZE = (DOCUMENT_MAX_SIZE_MB + 1) * 1024 * 1024

# ── Sécurité HTTPS ──
# Piloté par variable d'environnement pour ne pas gêner les tests / le dev local.
# En production : SECURE_SSL_REDIRECT=True (ou laissez le reverse proxy Railway/Cloud Run gérer).
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ── Journalisation (audit) ──
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "[{asctime}] {levelname} {name} — {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "loggers": {
        "snicv": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}

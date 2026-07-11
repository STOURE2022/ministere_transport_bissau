# SNICV — Module Certificat QR (back-end)

**Système National d'Immatriculation et de Contrôle des Véhicules**
Ministère des Transports · République de Guinée-Bissau · Projet LINOVATECH

Back-end Django + Django REST Framework gérant le cycle de vie complet d'un
dossier d'immatriculation : création de compte, dépôt et vérification de
documents, validation par un agent, attribution d'immatriculation, génération
d'un certificat numérique sécurisé (QR + signature RSA) et vérification en
temps réel par les forces de l'ordre.

---

## État d'avancement

| Étape du processus métier | Statut |
|---|---|
| **1. Création de compte** (inscription, OTP SMS/e-mail, JWT) | ✅ implémenté |
| **2. Dépôt des documents** (dossier, véhicule, upload, cohérence dates) | ✅ implémenté |
| **3. Vérification automatique** (VIN, assurance, CT, doublons, score fraude) | ✅ implémenté |
| **4. Validation agent** (valider / rejeter / complément, historique) | ✅ implémenté |
| **5. Attribution immatriculation** (numéro plaque auto, série, UUID) | ✅ implémenté |
| **6. Génération du certificat QR** (snapshot, SHA-256, signature RSA, QR, PDF) | ✅ implémenté |
| **7. Activation / vérification QR** (temps réel, signature, ScanLog) | ✅ implémenté |
| 8. Archivage | ⏳ à venir |

---

## Stack

- **Python 3.14**, **Django 6.0**, **Django REST Framework**
- **JWT** : `djangorestframework-simplejwt` (rotation + blacklist)
- **Documentation** : OpenAPI/Swagger via `drf-spectacular`
- **Base de données** : PostgreSQL (prod) · SQLite (repli dev automatique)
- **Sécurité certificat** (étapes suivantes) : `cryptography` (RSA), `qrcode`

---

## Installation

```bash
# 1. Environnement virtuel
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/macOS

# 2. Dépendances
pip install -r requirements.txt

# 3. Configuration
copy .env.example .env          # puis adaptez les valeurs

# 4. Base de données
python manage.py migrate

# 5. Compte administrateur
python manage.py createsuperuser

# 6. Lancement
python manage.py runserver
```

> En développement, si `DATABASE_URL` est vide dans `.env`, le projet utilise
> automatiquement SQLite — aucune installation de PostgreSQL requise pour démarrer.

---

## Documentation de l'API

Serveur lancé, les URLs suivantes sont disponibles :

- **Swagger UI** : http://localhost:8000/api/docs/
- **ReDoc** : http://localhost:8000/api/redoc/
- **Schéma OpenAPI (YAML)** : http://localhost:8000/api/schema/
- **Admin Django** : http://localhost:8000/admin/

### Endpoints — Étape 1 (comptes)

Préfixe : `/api/v1/auth/`

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `register/` | Public | Créer un compte usager (envoie un code OTP par SMS) |
| POST | `verify-otp/` | Public | Vérifier le code → active le compte |
| POST | `resend-otp/` | Public | Renvoyer un nouveau code |
| POST | `login/` | Public | Connexion → `access` + `refresh` (rôle inclus dans le token) |
| POST | `refresh/` | Public | Renouveler le token d'accès |
| POST | `logout/` | JWT | Blacklister le refresh token |
| GET / PATCH | `me/` | JWT | Profil de l'utilisateur connecté |

### Endpoints — Étape 2 (dossiers & documents)

Préfixe : `/api/v1/`

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `dossiers/` | JWT | Liste (usager : les siens ; agent/admin : tous). Filtres : `?statut=&type_vehicule=&q=` |
| POST | `dossiers/` | Usager | Créer un dossier + véhicule (statut Brouillon) |
| GET | `dossiers/{id}/` | Propriétaire / Staff | Détail (véhicule, pièces, pièces manquantes) |
| PATCH | `dossiers/{id}/` | Propriétaire | Modifier le véhicule (tant que Brouillon) |
| DELETE | `dossiers/{id}/` | Propriétaire | Supprimer (tant que Brouillon) |
| POST | `dossiers/{id}/soumettre/` | Propriétaire | Brouillon → Soumis (contrôle pièces + cohérence dates) |
| GET / POST | `dossiers/{id}/documents/` | Propriétaire / Staff | Lister / déposer une pièce (PDF/JPG/PNG, 5 Mo max) |
| GET / DELETE | `documents/{id}/` | Propriétaire / Staff | Consulter / supprimer une pièce |

**Cohérence des dates** vérifiée à la soumission : date de début ≤ date de fin
sur chaque pièce, assurance et contrôle technique non expirés, contrôle
technique postérieur à la facture d'achat. Pièces obligatoires : attestation
d'assurance, contrôle technique, facture d'achat.

### Endpoints — Étape 3 (vérification automatique)

La soumission d'un dossier (`soumettre/`) **déclenche automatiquement** la
vérification : contrôle du VIN (norme ISO), validité de l'assurance et du
contrôle technique, **détection de doublons** (même VIN sur un autre dossier
actif) et calcul d'un **score de fraude** (0-100 → niveau faible/moyen/élevé).
Le dossier passe alors `SOUMIS → VERIF_AUTO → EN_VALIDATION` (file de l'agent).

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `dossiers/{id}/verification/` | Propriétaire / Staff | Rapport de vérification (contrôles, score, doublon) |
| POST | `dossiers/{id}/verification/relancer/` | Agent / Admin | Relancer les contrôles |

Score de fraude (pondération) : doublon **+50**, VIN invalide **+25**,
assurance invalide **+15**, contrôle technique invalide **+10** (plafonné à 100).

### Endpoints — Étape 4 (validation agent)

Décisions d'un agent sur un dossier au statut `EN_VALIDATION`. Chaque décision
est historisée (`ValidationAgent`) et journalisée ; l'agent est assigné au dossier.

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `dossiers/{id}/valider/` | Agent / Admin | Valider → `VALIDE` (commentaire optionnel) |
| POST | `dossiers/{id}/rejeter/` | Agent / Admin | Rejeter → `REJETE` (**motif obligatoire**) |
| POST | `dossiers/{id}/demander-complement/` | Agent / Admin | Renvoyer à l'usager → `BROUILLON` (commentaire obligatoire) |
| GET | `dossiers/{id}/historique/` | Propriétaire / Staff | Historique des décisions |

Une **demande de complément** repasse le dossier en `Brouillon` : l'usager le
complète puis le re-soumet, ce qui relance la vérification automatique.

### Endpoints — Étape 5 (attribution d'immatriculation)

Sur un dossier `VALIDE`, l'agent attribue une immatriculation : numéro de plaque
**généré automatiquement** au format Guinée-Bissau `<série> <numéro> <bureau>`
(ex. `AB 4821 BS`), séquentiel et unique. Le dossier passe `VALIDE → IMMATRICULE`.
L'UUID du véhicule (déjà attribué) servira d'identifiant du QR au certificat.

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `dossiers/{id}/immatriculer/` | Agent / Admin | Attribuer l'immatriculation |
| GET | `dossiers/{id}/immatriculation/` | Propriétaire / Staff | Consulter la plaque attribuée |

Le suffixe de bureau est configurable (`IMMATRICULATION_SUFFIXE`, défaut `BS` = Bissau).

### Endpoints — Étape 6 (certificat QR) 🔐

Sur un dossier `IMMATRICULE`, l'agent émet le certificat numérique : les données
sont **figées** (snapshot), leur **empreinte SHA-256** est **signée en RSA-2048**
(clé privée SNICV), un **QR code** (UUID certificat + hash + URL de vérification)
et un **PDF** sont générés. Le dossier passe `IMMATRICULE → CERTIFIE`.

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `dossiers/{id}/certificat/` | Agent / Admin | Émettre le certificat (signature + QR + PDF) |
| GET | `certificats/{uuid}/` | Propriétaire / Staff | Détail (données, hash, signature, QR) |
| GET | `certificats/{uuid}/pdf/` | Propriétaire / Staff | Télécharger le PDF |
| POST | `certificats/{uuid}/revoquer/` | Admin | Révoquer le certificat |

**Clés RSA** — à générer avant la première émission :

```bash
python manage.py generer_cles_snicv
```

La **clé privée** reste côté serveur et **ne doit jamais être committée**
(`.gitignore` couvre `keys/*.pem`). En production, provisionnez-la via un secret
manager (`SNICV_PRIVATE_KEY_PATH`).

### Endpoints — Étape 7 (vérification QR temps réel)

Le QR pointe vers l'endpoint **public** `verify/{uuid}/`. À la lecture, le serveur
recalcule l'empreinte du snapshot, **vérifie la signature RSA**, contrôle le statut
et journalise le scan (`ScanLog`). Conçu pour répondre en **< 2 s**.

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `verify/{uuid}/?h={hash}` | **Public** | Vérifier un certificat → `AUTHENTIQUE` / `FALSIFIÉ` / `RÉVOQUÉ` / `EXPIRÉ` / `INTROUVABLE` |
| GET | `certificats/{uuid}/scans/` | Staff / Force de l'ordre | Historique des scans du certificat |

Le résultat renvoie les données non sensibles du véhicule (immatriculation,
propriétaire, marque/modèle, échéances) uniquement si le certificat est fiable
(authentique / révoqué / expiré) ; pour un certificat **falsifié ou introuvable**,
aucune donnée n'est exposée. Chaque appel est limité (`60/min`) et un scanner
authentifié (force de l'ordre) est enregistré dans le journal.

### Exemple de parcours

```bash
# Inscription
curl -X POST http://localhost:8000/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"u@ex.gw","telephone":"+245955123456","nom":"Kone",
       "prenom":"Fatou","password":"MotDePasse123!","password2":"MotDePasse123!"}'

# → Le code OTP s'affiche dans les logs du serveur (backend "console" en dev)

# Vérification
curl -X POST http://localhost:8000/api/v1/auth/verify-otp/ \
  -H "Content-Type: application/json" \
  -d '{"email":"u@ex.gw","code":"123456","canal":"SMS"}'

# Connexion
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"u@ex.gw","password":"MotDePasse123!"}'
```

---

## Architecture du projet

```
transport_ministere/
├── manage.py
├── requirements.txt
├── .env.example
├── config/                 # Projet Django (settings, urls, wsgi/asgi)
│   ├── settings.py
│   └── urls.py             # /api/v1/ + /api/docs/
└── apps/
    ├── core/               # Transversal
    │   ├── models.py       # TimeStampedModel (base UUID), LogAction (audit)
    │   ├── permissions.py  # IsUsager, IsAgent, IsForceOrdre, IsAdmin…
    │   └── services.py     # log_action() — journal d'audit
    ├── accounts/           # Étape 1 — comptes
    │   ├── models.py       # User (4 rôles), OTPCode
    │   ├── managers.py     # UserManager (connexion par e-mail)
    │   ├── notifications.py# Backends d'envoi abstraits (console / mock)
    │   ├── services.py     # Génération & vérification OTP
    │   ├── serializers.py  # Register, OTP, JWT enrichi, profil
    │   ├── views.py        # Endpoints REST
    │   └── tests.py        # 9 tests (inscription, OTP, connexion, profil)
    ├── dossiers/           # Étape 2 — dossiers, véhicules, documents
    │   ├── models.py       # Vehicule (UUID = ID QR), Dossier (workflow), Document
    │   ├── validators.py   # Contrôle format (PDF/JPG/PNG) et taille
    │   ├── services.py     # N° dossier, hash SHA-256, cohérence des dates
    │   ├── serializers.py  # Dossier (véhicule imbriqué), Document (upload)
    │   ├── permissions.py  # IsProprietaireOrStaff (objet)
    │   ├── views.py        # DossierViewSet + endpoints documents
    │   └── tests.py        # 15 tests (création, upload, dates, permissions)
    ├── verifications/      # Étape 3 — vérification automatique
    │   ├── models.py       # VerificationAuto (contrôles, score, doublon)
    │   ├── services.py     # Moteur : VIN, assurance, CT, doublons, score
    │   ├── serializers.py  # VerificationAutoSerializer
    │   ├── views.py        # Rapport + relance
    │   └── tests.py        # 9 tests (moteur, doublons, score, endpoints)
    ├── validations/        # Étape 4 — validation agent
    │   ├── models.py       # ValidationAgent (historique des décisions)
    │   ├── services.py     # valider / rejeter / demander complément
    │   ├── serializers.py  # Historique + corps des actions
    │   ├── views.py        # Endpoints décision + historique
    │   └── tests.py        # 9 tests (décisions, permissions, historique)
    ├── immatriculations/   # Étape 5 — attribution d'immatriculation
    │   ├── models.py       # Immatriculation (numéro, série, séquence)
    │   ├── services.py     # Génération séquentielle du numéro de plaque
    │   ├── serializers.py  # ImmatriculationSerializer
    │   ├── views.py        # Attribution + consultation
    │   └── tests.py        # 8 tests (attribution, format, séquence, permissions)
    └── certificats/        # Étapes 6 & 7 — certificat QR + vérification (cœur sécurité)
        ├── models.py       # Certificat (snapshot, hash, signature, QR, PDF) + ScanLog
        ├── crypto.py       # SHA-256 + signature/vérif RSA + gestion des clés
        ├── pdf.py          # Génération QR + PDF (Pillow)
        ├── services.py     # Émission (fige, signe, génère) + révocation
        ├── verification.py # Vérification temps réel + journal ScanLog
        ├── views.py        # Émission, détail, PDF, révocation, verify, scans
        ├── management/…    # generer_cles_snicv (paire de clés RSA)
        └── tests.py        # 22 tests (crypto, émission, signature, PDF, vérif QR, scans)
```

### Rôles & permissions

Un modèle `User` unique différencié par un champ `role` :
`USAGER`, `AGENT`, `FORCE_ORDRE`, `ADMIN`. Les permissions DRF correspondantes
sont dans `apps/core/permissions.py`.

### Notifications (SMS / e-mail)

L'envoi passe par une abstraction (`apps/accounts/notifications.py`). En V1,
aucun fournisseur réel n'est branché :

- `console` (défaut dev) : le code s'affiche dans les logs.
- `mock` (tests) : les envois sont mémorisés, aucun envoi réel.

Brancher Twilio/SendGrid ou une passerelle locale = ajouter une sous-classe de
`NotificationBackend` et changer `OTP_BACKEND` dans `.env`.

### Sécurité

- Mots de passe hachés (Django), **codes OTP jamais stockés en clair** (hash).
- OTP à durée de vie limitée, **5 tentatives max**, un seul code actif à la fois.
- Anti-bruteforce : throttling (`5/min` sur l'OTP, `10/h` sur l'inscription).
- Anti-énumération de comptes sur le renvoi d'OTP.
- **Journal d'audit** (`LogAction`) sur toutes les actions sensibles.
- HTTPS forçable en production (`SECURE_SSL_REDIRECT=True`).

---

## Tests

```bash
python manage.py test
```

Suite actuelle : **72 tests** (9 comptes + 15 dossiers + 9 vérifications +
9 validations + 8 immatriculations + 22 certificats/vérification QR) couvrant
tout le parcours, de la création de compte à la vérification terrain du QR, avec
les permissions par rôle. Hachage de mot de passe rapide (MD5) auto-activé en test.

---

## Prochaine étape

**Étape 8 — Archivage** : historique complet du cycle de vie d'un véhicule
(dossier, pièces, décisions, certificat, scans), **infractions** et
**renouvellements** de certificat, plus les **statistiques** du dashboard admin.
(OCR toujours prévu en V2.)

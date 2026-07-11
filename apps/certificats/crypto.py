"""
Primitives cryptographiques du certificat SNICV.

- Empreinte SHA-256 d'une sérialisation canonique (déterministe) des données.
- Signature / vérification RSA-2048 (PKCS#1 v1.5 + SHA-256).
- Chargement / génération de la paire de clés SNICV.

La clé PRIVÉE reste côté serveur et n'est jamais exposée ni committée.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

TAILLE_CLE = 2048


# ── Sérialisation & empreinte ──
def canonicaliser(snapshot: dict) -> bytes:
    """Sérialisation JSON canonique (clés triées) → octets, pour un hash stable."""
    return json.dumps(
        snapshot, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")


def hash_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ── Gestion des clés ──
def generer_paire_cles(*, force: bool = False) -> tuple[str, str]:
    """Génère la paire de clés RSA du SNICV aux emplacements configurés."""
    prive = settings.SNICV_PRIVATE_KEY_PATH
    public = settings.SNICV_PUBLIC_KEY_PATH
    if not force and os.path.exists(prive) and os.path.exists(public):
        return prive, public

    os.makedirs(os.path.dirname(prive), exist_ok=True)
    os.makedirs(os.path.dirname(public), exist_ok=True)

    cle = rsa.generate_private_key(public_exponent=65537, key_size=TAILLE_CLE)
    with open(prive, "wb") as f:
        f.write(cle.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ))
    with open(public, "wb") as f:
        f.write(cle.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ))
    return prive, public


def charger_cle_privee():
    chemin = settings.SNICV_PRIVATE_KEY_PATH
    if not os.path.exists(chemin):
        raise ImproperlyConfigured(
            "Clé privée SNICV introuvable. Exécutez : "
            "python manage.py generer_cles_snicv"
        )
    with open(chemin, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def charger_cle_publique():
    chemin = settings.SNICV_PUBLIC_KEY_PATH
    if not os.path.exists(chemin):
        raise ImproperlyConfigured(
            "Clé publique SNICV introuvable. Exécutez : "
            "python manage.py generer_cles_snicv"
        )
    with open(chemin, "rb") as f:
        return serialization.load_pem_public_key(f.read())


# ── Signature & vérification ──
def signer(data: bytes) -> str:
    """Signe `data` avec la clé privée SNICV → signature en base64."""
    signature = charger_cle_privee().sign(data, padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(signature).decode("ascii")


def verifier(data: bytes, signature_b64: str) -> bool:
    """Vérifie la signature RSA sur `data` avec la clé publique SNICV."""
    from cryptography.exceptions import InvalidSignature
    try:
        signature = base64.b64decode(signature_b64)
        charger_cle_publique().verify(signature, data, padding.PKCS1v15(), hashes.SHA256())
        return True
    except (InvalidSignature, ValueError):
        return False

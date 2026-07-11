"""
Vérification temps réel du certificat QR (étape 7).

Recalcule l'empreinte du snapshot, vérifie la signature RSA côté serveur,
contrôle le statut (révoqué / expiré) et journalise chaque scan (ScanLog).
Conçu pour répondre en < 2 s (un accès base + une vérification RSA).
"""
from __future__ import annotations

from django.utils import timezone

from apps.core.services import get_client_ip

from . import crypto
from .models import Certificat, ResultatScan, ScanLog, StatutCertificat

# Messages destinés à l'affichage (app mobile des forces de l'ordre).
MESSAGES = {
    ResultatScan.AUTHENTIQUE: "Certificat authentique.",
    ResultatScan.FALSIFIE: "Certificat falsifié : la signature ou l'empreinte ne concorde pas.",
    ResultatScan.REVOQUE: "Certificat révoqué par le SNICV.",
    ResultatScan.EXPIRE: "Certificat expiré.",
    ResultatScan.INTROUVABLE: "Certificat introuvable.",
}


def _enregistrer_scan(certificat, uuid_scanne, resultat, user, request, localisation):
    ScanLog.objects.create(
        certificat=certificat,
        uuid_scanne=uuid_scanne,
        resultat=resultat,
        scanne_par=user if (user and getattr(user, "is_authenticated", False)) else None,
        ip=get_client_ip(request),
        localisation=localisation or "",
    )


def verifier_certificat(uuid_scanne, hash_fourni=None, *, user=None, request=None,
                        localisation="") -> tuple[str, Certificat | None]:
    """Retourne (résultat, certificat|None) et journalise le scan."""
    certificat = (
        Certificat.objects
        .select_related("dossier", "dossier__usager", "vehicule")
        .filter(pk=uuid_scanne)
        .first()
    )

    if certificat is None:
        _enregistrer_scan(None, uuid_scanne, ResultatScan.INTROUVABLE, user, request, localisation)
        return ResultatScan.INTROUVABLE, None

    # Intégrité : l'empreinte du snapshot et la signature RSA doivent concorder,
    # et l'empreinte fournie par le QR (le cas échéant) doit correspondre.
    canonical = crypto.canonicaliser(certificat.donnees_snapshot)
    empreinte_ok = crypto.hash_sha256(canonical) == certificat.hash_sha256
    signature_ok = crypto.verifier(canonical, certificat.signature_rsa)
    fourni_ok = hash_fourni is None or hash_fourni == certificat.hash_sha256

    if not (empreinte_ok and signature_ok and fourni_ok):
        resultat = ResultatScan.FALSIFIE
    elif certificat.statut == StatutCertificat.REVOQUE:
        resultat = ResultatScan.REVOQUE
    elif certificat.statut == StatutCertificat.EXPIRE or certificat.date_expiration < timezone.now():
        # Bascule paresseuse du statut si l'échéance est passée.
        if certificat.statut != StatutCertificat.EXPIRE:
            certificat.statut = StatutCertificat.EXPIRE
            certificat.save(update_fields=["statut", "date_maj"])
        resultat = ResultatScan.EXPIRE
    else:
        resultat = ResultatScan.AUTHENTIQUE

    _enregistrer_scan(certificat, uuid_scanne, resultat, user, request, localisation)
    return resultat, certificat

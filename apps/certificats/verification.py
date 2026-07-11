"""
Vérification temps réel du certificat QR (étape 7).

Recalcule l'empreinte du snapshot, vérifie la signature RSA côté serveur,
contrôle le statut (révoqué / expiré) et journalise chaque scan (ScanLog).
Conçu pour répondre en < 2 s (un accès base + une vérification RSA).
"""
from __future__ import annotations

import uuid as uuid_lib

from django.utils import timezone

from apps.core.services import get_client_ip

from . import crypto
from .models import Certificat, MethodeScan, ResultatScan, ScanLog, StatutCertificat

# UUID nul journalisé quand aucun certificat n'est trouvé (recherche par plaque).
_UUID_NUL = uuid_lib.UUID(int=0)

# Messages destinés à l'affichage (app mobile des forces de l'ordre).
MESSAGES = {
    ResultatScan.AUTHENTIQUE: "Certificat authentique.",
    ResultatScan.FALSIFIE: "Certificat falsifié : la signature ou l'empreinte ne concorde pas.",
    ResultatScan.REVOQUE: "Certificat révoqué par le SNICV.",
    ResultatScan.EXPIRE: "Certificat expiré.",
    ResultatScan.INTROUVABLE: "Certificat introuvable.",
}


def _enregistrer_scan(certificat, uuid_scanne, resultat, user, request, localisation,
                      methode=MethodeScan.QR):
    ScanLog.objects.create(
        certificat=certificat,
        uuid_scanne=uuid_scanne,
        resultat=resultat,
        methode=methode,
        scanne_par=user if (user and getattr(user, "is_authenticated", False)) else None,
        ip=get_client_ip(request),
        localisation=localisation or "",
    )


def _statut_vers_resultat(certificat) -> str:
    """Déduit le résultat d'un certificat DÉJÀ authentifié à partir de son statut/échéance."""
    if certificat.statut == StatutCertificat.REVOQUE:
        return ResultatScan.REVOQUE
    if certificat.statut == StatutCertificat.EXPIRE or certificat.date_expiration < timezone.now():
        if certificat.statut != StatutCertificat.EXPIRE:
            certificat.statut = StatutCertificat.EXPIRE
            certificat.save(update_fields=["statut", "date_maj"])
        return ResultatScan.EXPIRE
    return ResultatScan.AUTHENTIQUE


def verifier_par_immatriculation(numero, *, user=None, request=None,
                                 localisation="") -> tuple[str, Certificat | None]:
    """
    Vérifie un véhicule à partir de son numéro de plaque (secours quand le QR est
    illisible). Retrouve le certificat de l'immatriculation et renvoie son statut.
    Contrairement au scan QR, il n'y a pas d'empreinte externe à confronter :
    on lit l'enregistrement de confiance en base, donc pas de résultat FALSIFIE.
    """
    from apps.immatriculations.models import Immatriculation

    numero_norm = " ".join((numero or "").upper().split())
    immat = (
        Immatriculation.objects
        .select_related("vehicule")
        .filter(numero__iexact=numero_norm)
        .first()
    )
    certificat = None
    if immat is not None:
        certificat = (
            Certificat.objects
            .select_related("dossier", "dossier__usager", "vehicule")
            .filter(vehicule=immat.vehicule)
            .order_by("-date_emission")
            .first()
        )

    if certificat is None:
        _enregistrer_scan(None, _UUID_NUL, ResultatScan.INTROUVABLE, user, request,
                          localisation, methode=MethodeScan.PLAQUE)
        return ResultatScan.INTROUVABLE, None

    resultat = _statut_vers_resultat(certificat)
    _enregistrer_scan(certificat, certificat.id, resultat, user, request,
                      localisation, methode=MethodeScan.PLAQUE)
    return resultat, certificat


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

"""Logique métier des comptes : génération, envoi et vérification des OTP."""
from __future__ import annotations

import secrets

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from .models import OTPCanal, OTPCode, User
from .notifications import get_backend


def _generer_code() -> str:
    """Génère un code numérique aléatoire de longueur configurable."""
    length = getattr(settings, "OTP_CODE_LENGTH", 6)
    # secrets.randbelow pour un tirage cryptographiquement sûr
    borne = 10 ** length
    return str(secrets.randbelow(borne)).zfill(length)


def creer_et_envoyer_otp(user: User, canal: str = OTPCanal.SMS) -> OTPCode:
    """
    Invalide les anciens codes actifs, en génère un nouveau, l'envoie via le
    canal demandé et retourne l'instance OTPCode (le code en clair n'est pas
    conservé).
    """
    # Un seul code actif à la fois par utilisateur/canal.
    OTPCode.objects.filter(user=user, canal=canal, consomme=False).update(consomme=True)

    code = _generer_code()
    ttl = getattr(settings, "OTP_CODE_TTL_MINUTES", 10)
    otp = OTPCode.objects.create(
        user=user,
        canal=canal,
        code_hash=make_password(code),
        expire_le=timezone.now() + timezone.timedelta(minutes=ttl),
    )

    backend = get_backend()
    message = (
        f"SNICV : votre code de vérification est {code}. "
        f"Valable {ttl} minutes. Ne le partagez jamais."
    )
    if canal == OTPCanal.SMS:
        backend.send_sms(to=user.telephone, message=message)
    else:
        backend.send_email(to=user.email, subject="Vérification de votre compte SNICV", message=message)

    return otp


def verifier_otp(user: User, code: str, canal: str = OTPCanal.SMS) -> tuple[bool, str]:
    """
    Vérifie un code OTP. Retourne (succès, message).
    Active le compte et marque le canal comme vérifié en cas de succès.
    """
    otp = (
        OTPCode.objects.filter(user=user, canal=canal, consomme=False)
        .order_by("-date_creation")
        .first()
    )
    if otp is None:
        return False, "Aucun code actif. Demandez un nouveau code."
    if otp.est_expire:
        otp.consomme = True
        otp.save(update_fields=["consomme"])
        return False, "Code expiré. Demandez un nouveau code."
    if otp.tentatives >= OTPCode.MAX_TENTATIVES:
        otp.consomme = True
        otp.save(update_fields=["consomme"])
        return False, "Trop de tentatives. Demandez un nouveau code."

    if not check_password(code, otp.code_hash):
        otp.tentatives += 1
        otp.save(update_fields=["tentatives"])
        restantes = OTPCode.MAX_TENTATIVES - otp.tentatives
        return False, f"Code incorrect. {restantes} tentative(s) restante(s)."

    # Succès
    otp.consomme = True
    otp.save(update_fields=["consomme"])

    champs = []
    if canal == OTPCanal.SMS:
        user.is_telephone_verifie = True
        champs.append("is_telephone_verifie")
    else:
        user.is_email_verifie = True
        champs.append("is_email_verifie")
    if not user.is_active:
        user.is_active = True
        champs.append("is_active")
    user.save(update_fields=champs)

    return True, "Compte vérifié avec succès."

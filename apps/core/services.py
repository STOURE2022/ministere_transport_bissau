"""Services transversaux : écriture du journal d'audit."""
from __future__ import annotations

from .models import LogAction


def get_client_ip(request) -> str | None:
    """Extrait l'IP client en tenant compte d'un éventuel reverse proxy."""
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(action: str, *, user=None, objet=None, request=None, **metadata) -> LogAction:
    """
    Enregistre une entrée d'audit.

    Exemple :
        log_action("COMPTE_CREE", user=user, request=request, canal="SMS")
    """
    ip = get_client_ip(request)
    user_agent = request.META.get("HTTP_USER_AGENT", "") if request else ""
    entry = LogAction(
        action=action,
        user=user if (user and getattr(user, "is_authenticated", False)) else None,
        metadata=metadata,
        ip=ip,
        user_agent=user_agent,
    )
    if objet is not None:
        entry.objet = objet
    entry.save()
    return entry

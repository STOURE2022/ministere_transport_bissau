"""
Abstraction d'envoi de notifications (SMS / e-mail).

En V1 aucun fournisseur réel n'est branché : on fournit un backend `console`
(affiche le message dans les logs) et un backend `mock` (mémorise les envois
pour les tests). Brancher Twilio/SendGrid ou une passerelle locale plus tard
consistera à ajouter une sous-classe de `NotificationBackend` et à changer
`OTP_BACKEND` dans la configuration.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from django.conf import settings

logger = logging.getLogger("snicv")


class NotificationBackend(ABC):
    """Interface commune à tous les canaux d'envoi."""

    @abstractmethod
    def send_sms(self, *, to: str, message: str) -> None: ...

    @abstractmethod
    def send_email(self, *, to: str, subject: str, message: str) -> None: ...


class ConsoleBackend(NotificationBackend):
    """Backend de développement : écrit le message dans les logs."""

    def send_sms(self, *, to: str, message: str) -> None:
        logger.info("[SMS → %s] %s", to, message)

    def send_email(self, *, to: str, subject: str, message: str) -> None:
        logger.info("[EMAIL → %s] %s — %s", to, subject, message)


class MockBackend(NotificationBackend):
    """Backend de test : conserve les envois en mémoire (aucun envoi réel)."""

    sent: list[dict] = []

    def send_sms(self, *, to: str, message: str) -> None:
        self.sent.append({"canal": "SMS", "to": to, "message": message})

    def send_email(self, *, to: str, subject: str, message: str) -> None:
        self.sent.append({"canal": "EMAIL", "to": to, "subject": subject, "message": message})

    @classmethod
    def reset(cls) -> None:
        cls.sent = []


_BACKENDS = {
    "console": ConsoleBackend,
    "mock": MockBackend,
}


def get_backend() -> NotificationBackend:
    """Retourne l'instance du backend configuré via OTP_BACKEND."""
    key = getattr(settings, "OTP_BACKEND", "console")
    backend_cls = _BACKENDS.get(key, ConsoleBackend)
    return backend_cls()

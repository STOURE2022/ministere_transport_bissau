"""
Passerelle mobile money — abstraite, backend mocké pour l'instant.

Comme le backend d'envoi SMS/e-mail, l'implémentation réelle (Orange Money /
MTN MoMo) se branchera plus tard en changeant `PAIEMENT_BACKEND` dans les
settings, sans toucher au code métier.
"""
from __future__ import annotations

import uuid
from importlib import import_module

from django.conf import settings


class PasserelleBase:
    def demander_paiement(self, paiement) -> tuple[bool, str]:
        """Retourne (succès, référence_transaction)."""
        raise NotImplementedError


class PasserelleMock(PasserelleBase):
    """Simule une confirmation immédiate et renvoie une référence de transaction."""

    def demander_paiement(self, paiement) -> tuple[bool, str]:
        prefixe = "".join(c for c in paiement.operateur.upper() if c.isalpha())[:3] or "MM"
        return True, f"{prefixe}-{uuid.uuid4().hex[:8].upper()}"


def get_passerelle() -> PasserelleBase:
    chemin = getattr(settings, "PAIEMENT_BACKEND",
                     "apps.paiements.passerelle.PasserelleMock")
    module, classe = chemin.rsplit(".", 1)
    return getattr(import_module(module), classe)()

"""Permissions DRF basées sur les 4 rôles SNICV."""
from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    """Base : autorise si l'utilisateur authentifié possède l'un des `roles`."""

    roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.roles)


class IsUsager(RolePermission):
    roles = ("USAGER",)


class IsAgent(RolePermission):
    roles = ("AGENT",)


class IsForceOrdre(RolePermission):
    roles = ("FORCE_ORDRE",)


class IsAdmin(RolePermission):
    roles = ("ADMIN",)


class IsAgentOrAdmin(RolePermission):
    """Traitement des dossiers : agents et administrateurs."""

    roles = ("AGENT", "ADMIN")


class IsStaffRole(RolePermission):
    """Tout profil interne (non-usager)."""

    roles = ("AGENT", "FORCE_ORDRE", "ADMIN")

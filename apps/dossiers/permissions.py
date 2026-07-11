"""Permissions objet propres aux dossiers."""
from rest_framework.permissions import BasePermission, SAFE_METHODS

STAFF_ROLES = {"AGENT", "ADMIN"}


class IsProprietaireOrStaff(BasePermission):
    """
    Accès à un dossier / document :
    - l'usager propriétaire y accède ;
    - agents et administrateurs y accèdent (lecture et traitement).
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role in STAFF_ROLES:
            return True
        # obj peut être un Dossier ou un Document.
        usager_id = getattr(obj, "usager_id", None)
        if usager_id is None and hasattr(obj, "dossier"):
            usager_id = obj.dossier.usager_id
        return usager_id == user.id

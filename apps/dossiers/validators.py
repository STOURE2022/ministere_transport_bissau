"""Validation des fichiers déposés (format et taille)."""
from django.conf import settings
from django.core.exceptions import ValidationError

# Formats acceptés : PDF, JPG/JPEG, PNG.
EXTENSIONS_AUTORISEES = {"pdf", "jpg", "jpeg", "png"}
CONTENT_TYPES_AUTORISES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}


def _taille_max_octets() -> int:
    mb = getattr(settings, "DOCUMENT_MAX_SIZE_MB", 5)
    return int(mb * 1024 * 1024)


def extension_de(nom_fichier: str) -> str:
    return nom_fichier.rsplit(".", 1)[-1].lower() if "." in nom_fichier else ""


def valider_fichier(fichier) -> None:
    """Lève ValidationError si le format ou la taille est invalide."""
    ext = extension_de(fichier.name)
    if ext not in EXTENSIONS_AUTORISEES:
        raise ValidationError(
            f"Format « {ext or 'inconnu'} » non autorisé. "
            f"Formats acceptés : PDF, JPG, PNG."
        )

    content_type = getattr(fichier, "content_type", None)
    if content_type and content_type not in CONTENT_TYPES_AUTORISES:
        raise ValidationError(
            f"Type de fichier « {content_type} » non autorisé. "
            f"Déposez un PDF, un JPG ou un PNG."
        )

    taille_max = _taille_max_octets()
    if fichier.size > taille_max:
        mb = taille_max / (1024 * 1024)
        raise ValidationError(
            f"Fichier trop volumineux ({fichier.size / (1024 * 1024):.1f} Mo). "
            f"Taille maximale : {mb:.0f} Mo."
        )

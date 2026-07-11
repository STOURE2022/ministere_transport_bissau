"""Génère la paire de clés RSA du SNICV (signature des certificats)."""
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.certificats.crypto import generer_paire_cles


class Command(BaseCommand):
    help = "Génère la paire de clés RSA-2048 du SNICV (clé privée + clé publique)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action="store_true",
            help="Regénère les clés même si elles existent (INVALIDE les certificats existants).",
        )

    def handle(self, *args, **options):
        force = options["force"]
        prive, public = generer_paire_cles(force=force)
        self.stdout.write(self.style.SUCCESS("Clés SNICV prêtes :"))
        self.stdout.write(f"  • Clé privée : {prive}")
        self.stdout.write(f"  • Clé publique : {public}")
        self.stdout.write(self.style.WARNING(
            "ATTENTION : ne committez JAMAIS la cle privee. En production, "
            "provisionnez-la via un secret manager (variable SNICV_PRIVATE_KEY_PATH)."
        ))
        _ = settings  # noqa (chemins lus depuis les settings)

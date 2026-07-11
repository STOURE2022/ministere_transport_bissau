"""Génère la paire de clés RSA du SNICV (signature des certificats)."""
import base64

from django.core.management.base import BaseCommand

from apps.certificats.crypto import generer_paire_cles


class Command(BaseCommand):
    help = "Génère la paire de clés RSA-2048 du SNICV (clé privée + clé publique)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force", action="store_true",
            help="Regénère les clés même si elles existent (INVALIDE les certificats existants).",
        )
        parser.add_argument(
            "--b64", action="store_true",
            help="Affiche les clés en base64 (à coller dans les variables Railway).",
        )

    def handle(self, *args, **options):
        prive, public = generer_paire_cles(force=options["force"])
        self.stdout.write(self.style.SUCCESS("Cles SNICV pretes :"))
        self.stdout.write(f"  - Cle privee : {prive}")
        self.stdout.write(f"  - Cle publique : {public}")

        if options["b64"]:
            with open(prive, "rb") as f:
                prive_b64 = base64.b64encode(f.read()).decode()
            with open(public, "rb") as f:
                public_b64 = base64.b64encode(f.read()).decode()
            self.stdout.write("\nVariables d'environnement (Railway) :")
            self.stdout.write(f"\nSNICV_PRIVATE_KEY_B64={prive_b64}")
            self.stdout.write(f"\nSNICV_PUBLIC_KEY_B64={public_b64}")

        self.stdout.write(self.style.WARNING(
            "\nATTENTION : ne committez JAMAIS la cle privee. En production, "
            "definissez SNICV_PRIVATE_KEY_B64 (variable secrete)."
        ))

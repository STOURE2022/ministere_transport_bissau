"""
Génère les notifications d'alerte pour les échéances proches (à lancer par un
cron quotidien en production). Idempotent : ne recrée pas une alerte déjà émise.

    python manage.py generer_alertes_echeance
"""
from django.core.management.base import BaseCommand

from apps.notifications.services import generer_relances


class Command(BaseCommand):
    help = "Crée les notifications d'alerte d'échéance (assurance, CT, certificat)."

    def handle(self, *args, **options):
        crees = generer_relances()
        self.stdout.write(self.style.SUCCESS(f"{crees} alerte(s) d'échéance générée(s)."))

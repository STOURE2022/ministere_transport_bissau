"""Barème d'infractions par défaut (modifiable ensuite depuis l'admin)."""
from django.db import migrations

DEFAUTS = [
    {"libelle": "Excès de vitesse", "code": "EXCES_VITESSE", "montant": 25000, "ordre": 1},
    {"libelle": "Défaut d'assurance", "code": "DEFAUT_ASSURANCE", "montant": 50000, "ordre": 2},
    {"libelle": "Défaut de contrôle technique", "code": "DEFAUT_CT", "montant": 30000, "ordre": 3},
    {"libelle": "Certificat non présenté", "code": "CERT_NON_PRESENTE", "montant": 15000, "ordre": 4},
    {"libelle": "Stationnement interdit", "code": "STATIONNEMENT", "montant": 10000, "ordre": 5},
]


def creer(apps, schema_editor):
    Type = apps.get_model("infractions", "TypeInfraction")
    if Type.objects.exists():
        return
    for d in DEFAUTS:
        Type.objects.create(**d)


def supprimer(apps, schema_editor):
    Type = apps.get_model("infractions", "TypeInfraction")
    Type.objects.filter(code__in=[d["code"] for d in DEFAUTS]).delete()


class Migration(migrations.Migration):
    dependencies = [("infractions", "0001_initial")]
    operations = [migrations.RunPython(creer, supprimer)]

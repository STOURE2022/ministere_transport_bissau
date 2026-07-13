"""Opérateurs mobile money par défaut (modifiables ensuite depuis l'admin)."""
from django.db import migrations

DEFAUTS = [
    {"nom": "Orange Money", "code": "ORANGE", "code_ussd": "#144#", "couleur": "#ff7900", "ordre": 1},
    {"nom": "MTN MoMo", "code": "MTN", "code_ussd": "*160#", "couleur": "#ffcc00", "ordre": 2},
]


def creer(apps, schema_editor):
    Operateur = apps.get_model("paiements", "OperateurPaiement")
    if Operateur.objects.exists():
        return
    for d in DEFAUTS:
        Operateur.objects.create(**d)


def supprimer(apps, schema_editor):
    Operateur = apps.get_model("paiements", "OperateurPaiement")
    Operateur.objects.filter(code__in=[d["code"] for d in DEFAUTS]).delete()


class Migration(migrations.Migration):
    dependencies = [("paiements", "0001_initial")]
    operations = [migrations.RunPython(creer, supprimer)]

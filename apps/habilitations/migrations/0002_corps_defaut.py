"""Barème initial des corps de contrôle (éditable ensuite depuis l'admin)."""
from django.db import migrations

CORPS = [
    # (code, nom, nom_court, sigle, couleur, ordre)
    ("CIRCULATION", "Police de la circulation", "Circulation", "PT", "#1e5aa8", 1),
    ("GARDE_NATIONALE", "Garde Nationale", "Garde Nat.", "GN", "#1e8e5a", 2),
    ("ORDRE_PUBLIC", "Police d'Ordre Public", "Ordre Public", "OP", "#0d2748", 3),
    ("JUDICIAIRE", "Police Judiciaire", "Judiciaire", "PJ", "#3a3f4a", 4),
    ("FORCES_ARMEES", "Forces Armées", "Forces Arm.", "FA", "#6f6a34", 5),
    ("DOUANES", "Douanes", "Douanes", "AL", "#b8891f", 6),
]


def creer_corps(apps, schema_editor):
    CorpsControle = apps.get_model("habilitations", "CorpsControle")
    for code, nom, nom_court, sigle, couleur, ordre in CORPS:
        CorpsControle.objects.get_or_create(
            code=code,
            defaults={"nom": nom, "nom_court": nom_court, "sigle": sigle,
                      "couleur": couleur, "ordre": ordre, "actif": True},
        )


def supprimer_corps(apps, schema_editor):
    CorpsControle = apps.get_model("habilitations", "CorpsControle")
    CorpsControle.objects.filter(code__in=[c[0] for c in CORPS]).delete()


class Migration(migrations.Migration):

    dependencies = [("habilitations", "0001_initial")]

    operations = [migrations.RunPython(creer_corps, supprimer_corps)]

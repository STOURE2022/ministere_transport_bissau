"""Statistiques nationales agrégées (tableau de bord de pilotage)."""
from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.certificats.models import Certificat, ResultatScan, ScanLog, StatutCertificat
from apps.core.permissions import IsAgentOrAdmin
from apps.dossiers.models import Dossier, StatutDossier, Vehicule
from apps.immatriculations.models import Immatriculation
from apps.signalements.models import Signalement, StatutSignalement
from apps.verifications.models import NiveauRisque, VerificationAuto

TYPE_VEHICULE_LABEL = {
    "VP": "Voiture particulière", "UTILITAIRE": "Utilitaire", "MOTO": "Moto / tricycle",
    "POIDS_LOURD": "Poids lourd", "BUS": "Bus / transport en commun",
}


def _repartition(qs, champ, libelles=None):
    """Compte les occurrences d'un champ et renvoie [{cle, libelle, count}] trié desc."""
    lignes = qs.values(champ).annotate(count=Count("id")).order_by("-count")
    out = []
    for row in lignes:
        cle = row[champ]
        out.append({"cle": cle, "libelle": (libelles or {}).get(cle, cle), "count": row["count"]})
    return out


class DashboardStatsView(APIView):
    """KPIs nationaux du parc, des certificats et des contrôles."""

    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(responses={200: dict})
    def get(self, request):
        now = timezone.now()

        # Entonnoir des dossiers par statut (ordre du cycle métier).
        compte_statut = {r["statut"]: r["count"] for r in
                         Dossier.objects.values("statut").annotate(count=Count("id"))}
        dossiers_par_statut = [
            {"statut": s, "libelle": lib, "count": compte_statut.get(s, 0)}
            for s, lib in StatutDossier.choices
        ]

        # Scans par résultat.
        compte_scan = {r["resultat"]: r["count"] for r in
                       ScanLog.objects.values("resultat").annotate(count=Count("id"))}
        scans_par_resultat = [
            {"resultat": r, "libelle": lib, "count": compte_scan.get(r, 0)}
            for r, lib in ResultatScan.choices
        ]

        # Taux de fraude = part des vérifications à risque élevé.
        verifs_total = VerificationAuto.objects.count()
        verifs_eleve = VerificationAuto.objects.filter(niveau_risque=NiveauRisque.ELEVE).count()
        taux_fraude = round(100 * verifs_eleve / verifs_total, 1) if verifs_total else 0.0

        # Certificats émis sur les 6 derniers mois.
        y, m = now.year, now.month
        fenetre = []
        for _ in range(6):
            fenetre.append((y, m))
            m -= 1
            if m == 0:
                m, y = 12, y - 1
        fenetre.reverse()
        par_mois = {}
        for row in (Certificat.objects
                    .annotate(mois=TruncMonth("date_emission"))
                    .values("mois").annotate(count=Count("id"))):
            if row["mois"]:
                par_mois[(row["mois"].year, row["mois"].month)] = row["count"]
        certificats_par_mois = [
            {"mois": f"{yy:04d}-{mm:02d}", "label": f"{mm:02d}/{yy}", "count": par_mois.get((yy, mm), 0)}
            for (yy, mm) in fenetre
        ]

        return Response({
            "vehicules": Vehicule.objects.count(),
            "immatriculations": Immatriculation.objects.count(),
            "certificats_actifs": Certificat.objects.filter(statut=StatutCertificat.ACTIF).count(),
            "certificats_total": Certificat.objects.count(),
            "signalements_actifs": Signalement.objects.filter(statut=StatutSignalement.ACTIF).count(),
            "controles_total": ScanLog.objects.count(),
            "controles_aujourdhui": ScanLog.objects.filter(date_scan__date=now.date()).count(),
            "taux_fraude": taux_fraude,
            "dossiers_par_statut": dossiers_par_statut,
            "scans_par_resultat": scans_par_resultat,
            "repartition_type": _repartition(Vehicule.objects, "type_vehicule", TYPE_VEHICULE_LABEL),
            "repartition_energie": _repartition(Vehicule.objects, "energie"),
            "certificats_par_mois": certificats_par_mois,
        })

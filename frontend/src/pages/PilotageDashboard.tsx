import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Car,
  Loader2,
  MapPin,
  ScanLine,
  ShieldCheck,
  Siren,
  Stamp,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CENTRES = ["Bissau", "Bafatá", "Gabú", "Canchungo", "Cacheu", "Bolama", "Buba", "Farim"];

const COULEUR_RESULTAT: Record<string, string> = {
  AUTHENTIQUE: "#1e8e5a",
  REVOQUE: "#c43d3d",
  FALSIFIE: "#a1201f",
  EXPIRE: "#c6841a",
  INTROUVABLE: "#8a99ae",
};

export default function PilotageDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api
      .get<DashboardStats>("/stats/dashboard/")
      .then((r) => setStats(r.data))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </Layout>
    );
  }
  if (!stats) {
    return (
      <Layout>
        <p className="text-muted-foreground">Statistiques indisponibles.</p>
      </Layout>
    );
  }

  const maxMois = Math.max(1, ...stats.certificats_par_mois.map((m) => m.count));
  const maxType = Math.max(1, ...stats.repartition_type.map((t) => t.count));
  const totalDossiers = Math.max(1, ...stats.dossiers_par_statut.map((d) => d.count));
  const maxScan = Math.max(1, ...stats.scans_par_resultat.map((s) => s.count));

  return (
    <Layout>
      <div className="mb-6">
        <div className="eyebrow">Ministère des Transports · Pilotage national</div>
        <h1 className="mt-1.5 font-serif text-2xl font-bold tracking-tight">Tableau de bord national</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d'ensemble du parc, des certificats et de l'activité de contrôle en temps réel.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icone={Car} accent="bg-secondary text-primary-deep" valeur={stats.immatriculations}
             titre="Véhicules immatriculés" sous={`${stats.vehicules} au total`} />
        <Kpi icone={ShieldCheck} accent="bg-[#E4F3EC] text-[#166b44]" valeur={stats.certificats_actifs}
             titre="Certificats actifs" sous={`${stats.certificats_total} émis`} />
        <Kpi icone={ScanLine} accent="bg-[#EAF1FB] text-primary" valeur={stats.controles_total}
             titre="Contrôles effectués" sous={`${stats.controles_aujourdhui} aujourd'hui`} />
        <Kpi icone={Siren} accent="bg-[#FBE7E7] text-[#9a2f2f]" valeur={stats.signalements_actifs}
             titre="Signalements actifs" sous="véhicules recherchés"
             alerte={stats.signalements_actifs > 0} />
        <Kpi icone={AlertTriangle} accent="bg-[#FBF0DD] text-[#96631a]"
             valeur={`${stats.taux_fraude}%`} titre="Taux de fraude" sous="dossiers à risque élevé" />
      </div>

      {/* Graphiques */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Entonnoir des dossiers */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle>Cycle des dossiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {stats.dossiers_par_statut.map((d) => (
              <div key={d.statut}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{d.libelle}</span>
                  <span className="font-semibold tnum">{d.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary"
                       style={{ width: `${(d.count / totalDossiers) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Certificats par mois */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Stamp className="size-4 text-primary" />
              Certificats émis · 6 mois
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex h-44 items-end justify-between gap-2">
              {stats.certificats_par_mois.map((m) => (
                <div key={m.mois} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-primary-deep to-primary"
                      style={{ height: `${Math.max(4, (m.count / maxMois) * 100)}%` }}
                      title={`${m.count} certificat(s)`}
                    />
                  </div>
                  <span className="text-[11px] font-semibold tnum">{m.count}</span>
                  <span className="text-[10px] text-faint tnum">{m.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contrôles par résultat */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="size-4 text-primary" />
              Contrôles par résultat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {stats.scans_par_resultat.map((s) => (
              <div key={s.resultat}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2.5 rounded-full"
                          style={{ background: COULEUR_RESULTAT[s.resultat] ?? "#8a99ae" }} />
                    {s.libelle}
                  </span>
                  <span className="font-semibold tnum">{s.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full"
                       style={{ width: `${(s.count / maxScan) * 100}%`,
                                background: COULEUR_RESULTAT[s.resultat] ?? "#8a99ae" }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Répartition par type */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle>Parc par type de véhicule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {stats.repartition_type.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun véhicule enregistré.</p>
            ) : (
              stats.repartition_type.map((t) => (
                <div key={t.cle}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">{t.libelle}</span>
                    <span className="font-semibold tnum">{t.count}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent"
                         style={{ width: `${(t.count / maxType) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Couverture nationale */}
      <Card className="mt-5 overflow-hidden">
        <div className="grid gap-0 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col justify-center gap-1 bg-navy px-8 py-7 text-white">
            <div className="text-[11px] uppercase tracking-[0.16em] text-accent-soft">Couverture nationale</div>
            <div className="font-serif text-4xl font-bold tnum">{stats.immatriculations}</div>
            <div className="text-[12px] text-[#b9cbe6]">véhicules immatriculés · République de Guinée-Bissau</div>
          </div>
          <div className="p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 text-primary" />
              Centres d'immatriculation SNICV
            </div>
            <div className="flex flex-wrap gap-2">
              {CENTRES.map((c) => (
                <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-[13px] font-medium text-primary-deep">
                  <span className="size-1.5 rounded-full bg-accent" />
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </Layout>
  );
}

function Kpi({
  icone: Icone,
  accent,
  valeur,
  titre,
  sous,
  alerte = false,
}: {
  icone: typeof Car;
  accent: string;
  valeur: number | string;
  titre: string;
  sous: string;
  alerte?: boolean;
}) {
  return (
    <Card className={cn("p-4", alerte && "ring-2 ring-destructive/30")}>
      <span className={cn("grid size-10 place-items-center rounded-lg", accent)}>
        <Icone className="size-5" />
      </span>
      <div className="mt-3 text-2xl font-bold leading-none tnum">{valeur}</div>
      <div className="mt-1.5 text-[12.5px] font-medium">{titre}</div>
      <div className="text-[11px] text-faint">{sous}</div>
    </Card>
  );
}

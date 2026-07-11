import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Siren,
  Stamp,
} from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type {
  DashboardStats,
  Paginated,
  ScanLog,
  Signalement,
  TypeSignalement,
} from "@/lib/types";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CENTRES = ["Bissau", "Bafatá", "Gabú", "Canchungo", "Cacheu", "Bolama", "Buba", "Farim"];

const COULEUR_RESULTAT: Record<string, string> = {
  AUTHENTIQUE: "#1e8e5a",
  REVOQUE: "#c43d3d",
  FALSIFIE: "#a1201f",
  EXPIRE: "#c6841a",
  INTROUVABLE: "#8a99ae",
};

const BADGE_SCAN: Record<string, string> = {
  AUTHENTIQUE: "bg-[#e4f3ec] text-[#166b44]",
  REVOQUE: "bg-[#fbe7e7] text-[#9a2f2f]",
  EXPIRE: "bg-[#fbf0dd] text-[#96631a]",
  FALSIFIE: "bg-[#fbe7e7] text-[#9a2f2f]",
  INTROUVABLE: "bg-muted text-muted-foreground",
};

const BADGE_SIGNALEMENT: Record<TypeSignalement, string> = {
  VOLE: "bg-[#fbe7e7] text-[#9a2f2f]",
  RECHERCHE: "bg-[#fbf0dd] text-[#96631a]",
  OPPOSITION: "bg-secondary text-primary-deep",
};

export default function PilotageDashboard() {
  const { user } = useAuth();
  const estAdmin = user?.role === "ADMIN";
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [scans, setScans] = useState<ScanLog[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);
  const signalRef = useRef<HTMLDivElement>(null);

  const charger = useCallback(async () => {
    const [s, sig, sc] = await Promise.allSettled([
      api.get<DashboardStats>("/stats/dashboard/"),
      api.get<Signalement[]>("/signalements/"),
      api.get<Paginated<ScanLog>>("/scans/", { params: { page_size: 8 } }),
    ]);
    if (s.status === "fulfilled") setStats(s.value.data);
    if (sig.status === "fulfilled") setSignalements(sig.value.data);
    if (sc.status === "fulfilled") setScans(sc.value.data.results.slice(0, 8));
  }, []);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  async function actualiser() {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }

  async function lever(id: string, motif: string) {
    await api.post(`/signalements/${id}/lever/`, { motif });
    await charger();
  }

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
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Ministère des Transports · Pilotage national</div>
          <h1 className="mt-1.5 font-serif text-2xl font-bold tracking-tight">Tableau de bord national</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vue d'ensemble du parc, des certificats et de l'activité de contrôle en temps réel.
          </p>
        </div>
        <Button variant="outline" onClick={actualiser} disabled={rafraichit}>
          <RefreshCw className={cn("size-4", rafraichit && "animate-spin")} />
          Actualiser
        </Button>
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
             titre="Véhicules signalés" sous={stats.signalements_actifs > 0 ? "voir le détail →" : "aucun en cours"}
             alerte={stats.signalements_actifs > 0}
             onClick={() => signalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
        <Kpi icone={AlertTriangle} accent="bg-[#FBF0DD] text-[#96631a]"
             valeur={`${stats.taux_fraude}%`} titre="Taux de fraude" sous="dossiers à risque élevé" />
      </div>

      {/* Véhicules signalés */}
      <div ref={signalRef} className="mt-5 scroll-mt-20">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-destructive text-white">
                <Siren className="size-4" />
              </span>
              Véhicules signalés
              <span className="rounded-full bg-[#fbe7e7] px-2 py-0.5 text-[11px] font-bold text-[#9a2f2f] tnum">
                {signalements.length} actif{signalements.length > 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {signalements.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <CheckCircle2 className="size-7 text-success" />
                <p className="text-sm font-medium">Aucun véhicule signalé actuellement</p>
                <p className="text-[13px] text-muted-foreground">
                  Les déclarations des usagers et des agents apparaissent ici en temps réel.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                      <th className="px-5 py-3 font-bold">Type</th>
                      <th className="px-5 py-3 font-bold">Immatriculation</th>
                      <th className="px-5 py-3 font-bold">Référence</th>
                      <th className="px-5 py-3 font-bold">Déclaré par</th>
                      <th className="px-5 py-3 font-bold text-right">{estAdmin ? "Action" : "Signalé le"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signalements.map((s) => (
                      <LigneSignalement key={s.id} sig={s} estAdmin={estAdmin} onLever={lever} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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

      {/* Activité de contrôle en direct */}
      <Card className="mt-5 overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
            Activité de contrôle en direct
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {scans.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Aucun contrôle enregistré pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {scans.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <ScanLine className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tnum">
                        {s.immatriculation ?? "— inconnue —"}
                      </span>
                      <span className="text-[11px] text-faint">· {s.methode_libelle}</span>
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {s.scanne_par_nom ?? "Contrôle public"}
                      {s.localisation ? ` · ${s.localisation}` : ""}
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                                      BADGE_SCAN[s.resultat] ?? "bg-muted text-muted-foreground")}>
                    {s.resultat_libelle}
                  </span>
                  <span className="hidden shrink-0 text-[11.5px] text-faint tnum sm:block">
                    {formatDateTime(s.date_scan)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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

/* ─────────────────────── Ligne de signalement (avec levée admin) ─────────────────────── */

function LigneSignalement({
  sig,
  estAdmin,
  onLever,
}: {
  sig: Signalement;
  estAdmin: boolean;
  onLever: (id: string, motif: string) => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function confirmer() {
    setBusy(true);
    setErreur(null);
    try {
      await onLever(sig.id, motif);
    } catch (err) {
      setErreur(messageErreur(err, "Levée impossible."));
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="px-5 py-3">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", BADGE_SIGNALEMENT[sig.type])}>
            {sig.type_libelle}
          </span>
        </td>
        <td className="px-5 py-3 font-semibold tnum">
          {sig.immatriculation ?? <span className="text-faint">VIN {sig.vin}</span>}
          {sig.motif && (
            <span className="block text-[11.5px] font-normal text-muted-foreground">{sig.motif}</span>
          )}
        </td>
        <td className="px-5 py-3 text-muted-foreground">{sig.reference || "—"}</td>
        <td className="px-5 py-3 text-muted-foreground">
          {sig.signale_par_nom ?? "—"}
          <span className="block text-[11px] text-faint tnum">{formatDateTime(sig.date_signalement)}</span>
        </td>
        <td className="px-5 py-3 text-right">
          {estAdmin ? (
            <Button variant="outline" size="sm" onClick={() => setOuvert((v) => !v)}>
              Lever
            </Button>
          ) : (
            <span className="text-[11.5px] text-faint tnum">{formatDateTime(sig.date_signalement)}</span>
          )}
        </td>
      </tr>
      {estAdmin && ouvert && (
        <tr className="bg-muted/40">
          <td colSpan={5} className="px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Motif de levée (véhicule retrouvé, erreur…)"
                className="h-9 max-w-xs"
              />
              <Button size="sm" variant="success" disabled={busy} onClick={confirmer}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Confirmer la levée
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOuvert(false)}>
                Annuler
              </Button>
              {erreur && <span className="text-[12.5px] text-destructive">{erreur}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Kpi({
  icone: Icone,
  accent,
  valeur,
  titre,
  sous,
  alerte = false,
  onClick,
}: {
  icone: typeof Car;
  accent: string;
  valeur: number | string;
  titre: string;
  sous: string;
  alerte?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4",
        alerte && "ring-2 ring-destructive/30",
        onClick && "cursor-pointer transition-shadow hover:shadow-[0_10px_28px_rgba(13,39,72,.12)]"
      )}
    >
      <span className={cn("grid size-10 place-items-center rounded-lg", accent)}>
        <Icone className="size-5" />
      </span>
      <div className="mt-3 text-2xl font-bold leading-none tnum">{valeur}</div>
      <div className="mt-1.5 text-[12.5px] font-medium">{titre}</div>
      <div className="text-[11px] text-faint">{sous}</div>
    </Card>
  );
}

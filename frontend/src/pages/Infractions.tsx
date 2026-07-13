import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Ban,
  Coins,
  Download,
  FileWarning,
  Gavel,
  Loader2,
  Plus,
  Search,
  Settings2,
  Undo2,
} from "lucide-react";
import { api, ouvrirQuittancePdf } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { Infraction, InfractionStats, StatutInfraction } from "@/lib/types";
import { Layout } from "@/components/Layout";

function fmt(montant: number, devise: string): string {
  return `${montant.toLocaleString("fr-FR")} ${devise}`;
}

const STATUT_STYLE: Record<StatutInfraction, { tint: string; color: string }> = {
  A_REGLER: { tint: "#fbe7e7", color: "#a3312f" },
  PAYEE: { tint: "#e7f2ec", color: "#166b44" },
  CONTESTEE: { tint: "#f7efd9", color: "#8a6410" },
  ANNULEE: { tint: "#eef1f5", color: "#5a6b82" },
};

export default function Infractions() {
  const { t } = useLang();
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [stats, setStats] = useState<InfractionStats | null>(null);
  const [statut, setStatut] = useState<"" | StatutInfraction>("");
  const [q, setQ] = useState("");
  const [chargement, setChargement] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const params: Record<string, string> = {};
    if (statut) params.statut = statut;
    if (q.trim()) params.q = q.trim();
    const [liste, s] = await Promise.all([
      api.get<{ results: Infraction[] }>("/infractions/", { params }),
      api.get<InfractionStats>("/infractions/stats/").catch(() => null),
    ]);
    setInfractions(liste.data.results);
    if (s) setStats(s.data);
  }, [statut, q]);

  useEffect(() => {
    const timer = setTimeout(() => charger().finally(() => setChargement(false)), 220);
    return () => clearTimeout(timer);
  }, [charger]);

  async function action(inf: Infraction, url: string) {
    setBusy(inf.id);
    try {
      await api.post(url);
      await charger();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{t("Administration")} · SNICV</div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-navy">
            {t("Infractions & amendes")}
          </h1>
          <p className="mt-1 max-w-[60ch] text-[14.5px] text-muted-foreground">
            {t("Suivez les procès-verbaux dressés, leur règlement et les recettes.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/infractions/nouveau"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#a3312f] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:brightness-110"
          >
            <Plus className="size-4" />
            {t("Dresser un PV")}
          </Link>
          {admin && (
            <Link
              to="/infractions/configuration"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-navy hover:bg-muted"
            >
              <Settings2 className="size-4" />
              {t("Barème")}
            </Link>
          )}
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<FileWarning className="size-[19px]" />} tint="#eef1f5" color="#5a6b82" valeur={String(stats.total)} label={t("PV émis")} />
          <StatCard icon={<AlertTriangle className="size-[19px]" />} tint="#fbe7e7" color="#a3312f" valeur={String(stats.a_regler)} label={t("En attente de paiement")} />
          <StatCard icon={<Gavel className="size-[19px]" />} tint="#f7efd9" color="#8a6410" valeur={String(stats.contestees)} label={t("Contestées")} />
          <StatCard icon={<Coins className="size-[19px]" />} tint="#e7f2ec" color="#166b44" valeur={fmt(stats.recettes, stats.devise)} label={t("Recettes")} />
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <FileWarning className="size-[17px] text-accent" />
            <h2 className="font-serif text-[16px] font-bold text-navy">{t("Journal des infractions")}</h2>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
              <Search className="size-4 text-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("PV, plaque, titulaire…")}
                className="w-40 bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["", t("Tous")],
                  ["A_REGLER", t("À régler")],
                  ["CONTESTEE", t("Contestées")],
                  ["PAYEE", t("Soldées")],
                ] as const
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setStatut(val as "" | StatutInfraction)}
                  className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
                    statut === val ? "bg-navy text-white" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </header>

        {chargement ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : infractions.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <FileWarning className="mx-auto size-8 text-faint" />
            <p className="mt-3 font-semibold text-navy">{t("Aucune infraction")}</p>
            <p className="text-[13px] text-muted-foreground">{t("Aucun procès-verbal ne correspond à ce filtre.")}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-faint">
                    <th className="px-5 py-3 font-bold">{t("PV")}</th>
                    <th className="px-3 py-3 font-bold">{t("Véhicule")}</th>
                    <th className="px-3 py-3 font-bold">{t("Infraction")}</th>
                    <th className="px-3 py-3 text-right font-bold">{t("Montant")}</th>
                    <th className="px-3 py-3 font-bold">{t("Statut")}</th>
                    <th className="px-3 py-3 font-bold">{t("Date")}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {infractions.map((inf) => (
                    <tr key={inf.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/30">
                      <td className="px-5 py-3 font-mono font-semibold text-navy tnum">{inf.reference}</td>
                      <td className="px-3 py-3 font-mono tnum">{inf.immatriculation ?? "—"}</td>
                      <td className="px-3 py-3">{t(inf.libelle)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmt(inf.montant, inf.devise)}</td>
                      <td className="px-3 py-3"><Badge statut={inf.statut} libelle={inf.statut_libelle} /></td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{formatDateTime(inf.date_infraction)}</td>
                      <td className="px-5 py-3">
                        <Actions inf={inf} admin={admin} busy={busy === inf.id} onAction={action} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border/60 md:hidden">
              {infractions.map((inf) => (
                <div key={inf.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-semibold text-navy">{inf.reference}</span>
                    <Badge statut={inf.statut} libelle={inf.statut_libelle} />
                  </div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {t(inf.libelle)} · <span className="font-mono">{inf.immatriculation ?? "—"}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-serif text-[17px] font-bold text-navy tabular-nums">{fmt(inf.montant, inf.devise)}</span>
                    <Actions inf={inf} admin={admin} busy={busy === inf.id} onAction={action} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </Layout>
  );
}

function Actions({
  inf,
  admin,
  busy,
  onAction,
}: {
  inf: Infraction;
  admin: boolean;
  busy: boolean;
  onAction: (inf: Infraction, url: string) => Promise<void>;
}) {
  const { t } = useLang();
  const [ouvre, setOuvre] = useState(false);
  return (
    <div className="flex items-center justify-end gap-1.5">
      {inf.statut === "PAYEE" && inf.a_quittance && (
        <button
          onClick={async () => {
            setOuvre(true);
            try {
              await ouvrirQuittancePdf(inf.id);
            } finally {
              setOuvre(false);
            }
          }}
          disabled={ouvre}
          title={t("Quittance")}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-navy transition hover:bg-muted disabled:opacity-60"
        >
          {ouvre ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {t("Quittance")}
        </button>
      )}
      {admin && inf.statut === "CONTESTEE" && (
        <button
          onClick={() => onAction(inf, `/infractions/${inf.id}/rejeter-contestation/`)}
          disabled={busy}
          title={t("Rejeter la contestation")}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-[#8a6410] transition hover:bg-[#f7efd9] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
          {t("Rejeter")}
        </button>
      )}
      {admin && (inf.statut === "A_REGLER" || inf.statut === "CONTESTEE") && (
        <button
          onClick={() => onAction(inf, `/infractions/${inf.id}/annuler/`)}
          disabled={busy}
          title={t("Annuler l'amende")}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground transition hover:bg-[#fbe7e7] hover:text-[#a3312f] disabled:opacity-60"
        >
          <Ban className="size-3.5" />
          {t("Annuler")}
        </button>
      )}
    </div>
  );
}

function Badge({ statut, libelle }: { statut: StatutInfraction; libelle: string }) {
  const { t } = useLang();
  const s = STATUT_STYLE[statut];
  return (
    <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: s.tint, color: s.color }}>
      {t(libelle)}
    </span>
  );
}

function StatCard({ icon, tint, color, valeur, label }: { icon: ReactNode; tint: string; color: string; valeur: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_0_rgba(13,39,72,.03),0_18px_38px_-30px_rgba(13,39,72,.5)]">
      <span className="grid size-9 place-items-center rounded-[10px]" style={{ background: tint, color }}>{icon}</span>
      <div className="mt-3 font-serif text-2xl font-bold text-navy tabular-nums">{valeur}</div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
    </div>
  );
}

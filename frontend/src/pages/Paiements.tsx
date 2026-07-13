import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Clock,
  Coins,
  Download,
  Loader2,
  Receipt,
  Search,
  Settings2,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, ouvrirRecuPdf } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { Paiement, PaiementStats, StatutPaiement } from "@/lib/types";
import { Layout } from "@/components/Layout";

function fmt(montant: number, devise: string): string {
  return `${montant.toLocaleString("fr-FR")} ${devise}`;
}

const STATUT_STYLE: Record<StatutPaiement, { tint: string; color: string }> = {
  PAYE: { tint: "#e7f2ec", color: "#166b44" },
  EN_ATTENTE: { tint: "#f7efd9", color: "#8a6410" },
  ECHOUE: { tint: "#fbe7e7", color: "#9a2f2f" },
};

export default function Paiements() {
  const { t } = useLang();
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [stats, setStats] = useState<PaiementStats | null>(null);
  const [statut, setStatut] = useState<"" | StatutPaiement>("");
  const [q, setQ] = useState("");
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    const params: Record<string, string> = {};
    if (statut) params.statut = statut;
    if (q.trim()) params.q = q.trim();
    const [liste, s] = await Promise.all([
      api.get<{ results: Paiement[] }>("/paiements/", { params }),
      api.get<PaiementStats>("/paiements/stats/").catch(() => null),
    ]);
    setPaiements(liste.data.results);
    if (s) setStats(s.data);
  }, [statut, q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      charger().finally(() => setChargement(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [charger]);

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{t("Administration")} · SNICV</div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-navy">
            {t("Paiements de la taxe")}
          </h1>
          <p className="mt-1 max-w-[60ch] text-[14.5px] text-muted-foreground">
            {t("Suivez tous les règlements de la taxe d'immatriculation réglés par mobile money.")}
          </p>
        </div>
        {admin && (
          <Link
            to="/paiements/configuration"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-navy hover:bg-muted"
          >
            <Settings2 className="size-4" />
            {t("Configuration")}
          </Link>
        )}
      </div>

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<BadgeCheck className="size-[19px]" />}
            tint="#e7f2ec"
            color="#1e8e5a"
            valeur={String(stats.nombre_payes)}
            label={t("Paiements réglés")}
          />
          <StatCard
            icon={<Coins className="size-[19px]" />}
            tint="#f7efd9"
            color="#b5852a"
            valeur={fmt(stats.montant_total, stats.devise)}
            label={t("Total encaissé")}
          />
          <StatCard
            icon={<Clock className="size-[19px]" />}
            tint="#eaf1fb"
            color="#1e5aa8"
            valeur={String(stats.en_attente)}
            label={t("En attente")}
          />
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Wallet className="size-[17px] text-accent" />
            <h2 className="font-serif text-[16px] font-bold text-navy">{t("Journal des paiements")}</h2>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
              <Search className="size-4 text-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Reçu, dossier, nom…")}
                className="w-44 bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </div>
            <div className="flex gap-1">
              {([["", t("Tous")], ["PAYE", t("Réglés")], ["EN_ATTENTE", t("En attente")]] as const).map(
                ([val, lbl]) => (
                  <button
                    key={val}
                    onClick={() => setStatut(val as "" | StatutPaiement)}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      statut === val ? "bg-navy text-white" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {lbl}
                  </button>
                )
              )}
            </div>
          </div>
        </header>

        {chargement ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : paiements.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Receipt className="mx-auto size-8 text-faint" />
            <p className="mt-3 font-semibold text-navy">{t("Aucun paiement")}</p>
            <p className="text-[13px] text-muted-foreground">{t("Aucun règlement ne correspond à ce filtre.")}</p>
          </div>
        ) : (
          <>
            {/* Tableau (desktop) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-faint">
                    <th className="px-5 py-3 font-bold">{t("Reçu")}</th>
                    <th className="px-3 py-3 font-bold">{t("Dossier")}</th>
                    <th className="px-3 py-3 font-bold">{t("Usager")}</th>
                    <th className="px-3 py-3 font-bold">{t("Opérateur")}</th>
                    <th className="px-3 py-3 text-right font-bold">{t("Montant")}</th>
                    <th className="px-3 py-3 font-bold">{t("Statut")}</th>
                    <th className="px-3 py-3 font-bold">{t("Date")}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {paiements.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/30">
                      <td className="px-5 py-3 font-mono font-semibold text-navy tnum">{p.reference}</td>
                      <td className="px-3 py-3 font-mono tnum">{p.numero_dossier}</td>
                      <td className="px-3 py-3">{p.usager_nom}</td>
                      <td className="px-3 py-3">{p.operateur}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {fmt(p.montant_total, p.devise)}
                      </td>
                      <td className="px-3 py-3">
                        <StatutBadge statut={p.statut} libelle={p.statut_libelle} />
                      </td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">
                        {p.paye_le ? formatDateTime(p.paye_le) : formatDateTime(p.date_creation)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {p.a_recu && <BoutonRecu id={p.id} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes (mobile) */}
            <div className="divide-y divide-border/60 md:hidden">
              {paiements.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-semibold text-navy">{p.reference}</span>
                    <StatutBadge statut={p.statut} libelle={p.statut_libelle} />
                  </div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {p.usager_nom} · <span className="font-mono">{p.numero_dossier}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-serif text-[17px] font-bold text-navy tabular-nums">
                      {fmt(p.montant_total, p.devise)}
                    </span>
                    {p.a_recu && <BoutonRecu id={p.id} />}
                  </div>
                  <div className="mt-1 text-[11.5px] text-faint">
                    {p.operateur} · {p.paye_le ? formatDateTime(p.paye_le) : formatDateTime(p.date_creation)}
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

function BoutonRecu({ id }: { id: string }) {
  const { t } = useLang();
  const [ouvre, setOuvre] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setOuvre(true);
        try {
          await ouvrirRecuPdf(id);
        } finally {
          setOuvre(false);
        }
      }}
      disabled={ouvre}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-navy transition hover:bg-muted disabled:opacity-60"
    >
      {ouvre ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
      {t("Reçu")}
    </button>
  );
}

function StatutBadge({ statut, libelle }: { statut: StatutPaiement; libelle: string }) {
  const { t } = useLang();
  const s = STATUT_STYLE[statut];
  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: s.tint, color: s.color }}
    >
      {t(libelle)}
    </span>
  );
}

function StatCard({
  icon,
  tint,
  color,
  valeur,
  label,
}: {
  icon: ReactNode;
  tint: string;
  color: string;
  valeur: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_0_rgba(13,39,72,.03),0_18px_38px_-30px_rgba(13,39,72,.5)]">
      <span className="grid size-9 place-items-center rounded-[10px]" style={{ background: tint, color }}>
        {icon}
      </span>
      <div className="mt-3 font-serif text-2xl font-bold text-navy tabular-nums">{valeur}</div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
    </div>
  );
}

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Check,
  Clock,
  Loader2,
  Search,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { DemandeHabilitation, HabilitationStats, StatutHabilitation } from "@/lib/types";
import { Layout } from "@/components/Layout";

const STATUT_STYLE: Record<StatutHabilitation, { tint: string; color: string }> = {
  EN_ATTENTE: { tint: "#fbf0d8", color: "#8a6410" },
  VALIDE: { tint: "#e7f2ec", color: "#166b44" },
  REJETE: { tint: "#f7e3e1", color: "#a3312f" },
};

export default function Habilitations() {
  const { t } = useLang();
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const [demandes, setDemandes] = useState<DemandeHabilitation[]>([]);
  const [stats, setStats] = useState<HabilitationStats | null>(null);
  const [statut, setStatut] = useState<"" | StatutHabilitation>("EN_ATTENTE");
  const [q, setQ] = useState("");
  const [chargement, setChargement] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const params: Record<string, string> = {};
    if (statut) params.statut = statut;
    if (q.trim()) params.q = q.trim();
    const [liste, s] = await Promise.all([
      api.get<{ results: DemandeHabilitation[] }>("/habilitations/", { params }),
      api.get<HabilitationStats>("/habilitations/stats/").catch(() => null),
    ]);
    setDemandes(liste.data.results);
    if (s) setStats(s.data);
  }, [statut, q]);

  useEffect(() => {
    const timer = setTimeout(() => charger().finally(() => setChargement(false)), 220);
    return () => clearTimeout(timer);
  }, [charger]);

  async function valider(d: DemandeHabilitation) {
    setBusy(d.id);
    try {
      await api.post(`/habilitations/${d.id}/valider/`);
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
            {t("Habilitations")}
          </h1>
          <p className="mt-1 max-w-[60ch] text-[14.5px] text-muted-foreground">
            {t("Validez les inscriptions des corps de contrôle avant l'ouverture de leur accès.")}
          </p>
        </div>
        {admin && (
          <Link
            to="/agent/habilitations/corps"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-navy hover:bg-muted"
          >
            <Settings2 className="size-4" />
            {t("Gérer les corps")}
          </Link>
        )}
      </div>

      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Clock className="size-[19px]" />} tint="#fbf0d8" color="#8a6410" valeur={String(stats.en_attente)} label={t("En attente")} />
          <StatCard icon={<BadgeCheck className="size-[19px]" />} tint="#e7f2ec" color="#166b44" valeur={String(stats.validees)} label={t("Habilités actifs")} />
          <StatCard icon={<Users className="size-[19px]" />} tint="#eef3fb" color="#1e5aa8" valeur={String(stats.corps_actifs)} label={t("Corps représentés")} />
          <StatCard icon={<ShieldCheck className="size-[19px]" />} tint="#f7e3e1" color="#a3312f" valeur={String(stats.rejetees)} label={t("Rejetées")} />
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-[17px] text-accent" />
            <h2 className="font-serif text-[16px] font-bold text-navy">{t("Demandes d'habilitation")}</h2>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
              <Search className="size-4 text-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Nom, matricule, corps…")}
                className="w-40 bg-transparent text-[13px] outline-none placeholder:text-faint"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["EN_ATTENTE", t("En attente")],
                  ["VALIDE", t("Validées")],
                  ["REJETE", t("Rejetées")],
                  ["", t("Toutes")],
                ] as const
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setStatut(val as "" | StatutHabilitation)}
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
        ) : demandes.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <ShieldCheck className="mx-auto size-8 text-faint" />
            <p className="mt-3 font-semibold text-navy">{t("Aucune demande")}</p>
            <p className="text-[13px] text-muted-foreground">{t("Aucune demande ne correspond à ce filtre.")}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-faint">
                    <th className="px-5 py-3 font-bold">{t("Demandeur")}</th>
                    <th className="px-3 py-3 font-bold">{t("Corps")}</th>
                    <th className="px-3 py-3 font-bold">{t("Matricule")}</th>
                    <th className="px-3 py-3 font-bold">{t("Région")}</th>
                    <th className="px-3 py-3 font-bold">{t("Déposée le")}</th>
                    <th className="px-3 py-3 font-bold">{t("Statut")}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((d) => (
                    <tr key={d.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <Personne d={d} />
                      </td>
                      <td className="px-3 py-3"><CorpsBadge d={d} /></td>
                      <td className="px-3 py-3 font-mono tnum">{d.matricule}</td>
                      <td className="px-3 py-3 text-muted-foreground">{d.region || "—"}</td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{formatDate(d.date_creation)}</td>
                      <td className="px-3 py-3"><Pill d={d} /></td>
                      <td className="px-5 py-3">
                        <Actions d={d} busy={busy === d.id} onValider={valider} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border/60 md:hidden">
              {demandes.map((d) => (
                <div key={d.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Personne d={d} />
                    <Pill d={d} />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    <CorpsBadge d={d} /> · <span className="font-mono">{d.matricule}</span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Actions d={d} busy={busy === d.id} onValider={valider} />
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

function Personne({ d }: { d: DemandeHabilitation }) {
  const initiales = `${d.prenom[0] ?? ""}${d.nom[0] ?? ""}`.toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
        style={{ background: d.corps_couleur || "#0d2748" }}
      >
        {initiales}
      </span>
      <span className="min-w-0">
        <b className="block truncate text-[13.5px] text-foreground">
          {d.prenom} {d.nom}
        </b>
        <span className="text-[12px] text-faint">{d.grade || "—"}</span>
      </span>
    </div>
  );
}

function CorpsBadge({ d }: { d: DemandeHabilitation }) {
  const { t } = useLang();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-navy">
      <i className="size-2.5 rounded-sm" style={{ background: d.corps_couleur || "#0d2748" }} />
      {t(d.corps_nom)}
    </span>
  );
}

function Pill({ d }: { d: DemandeHabilitation }) {
  const { t } = useLang();
  const s = STATUT_STYLE[d.statut];
  return (
    <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: s.tint, color: s.color }}>
      {t(d.statut_libelle)}
    </span>
  );
}

function Actions({
  d,
  busy,
  onValider,
}: {
  d: DemandeHabilitation;
  busy: boolean;
  onValider: (d: DemandeHabilitation) => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        to={`/agent/habilitations/${d.id}`}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-navy transition hover:bg-muted"
      >
        {d.statut === "EN_ATTENTE" ? t("Examiner") : t("Voir")}
      </Link>
      {d.statut === "EN_ATTENTE" && (
        <button
          onClick={() => onValider(d)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-[#bfe0cd] bg-[#f2faf5] px-2.5 py-1.5 text-[12px] font-semibold text-[#166b44] transition hover:brightness-95 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {t("Valider")}
        </button>
      )}
    </div>
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

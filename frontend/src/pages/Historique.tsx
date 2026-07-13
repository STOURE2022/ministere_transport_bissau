import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  Award,
  BarChart3,
  Check,
  Clock,
  Download,
  FileText,
  Hash,
  Loader2,
  Paperclip,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Siren,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { api, messageErreur, ouvrirCycleViePdf } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { DossierDeVie, EvenementVie, TypeEvenement } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { PlaqueImmatriculation } from "@/components/PlaqueImmatriculation";

const EV: Record<TypeEvenement, { accent: string; tint: string; Icon: LucideIcon }> = {
  CREATION: { accent: "#5a6b82", tint: "#eef1f5", Icon: FileText },
  PIECES: { accent: "#1e5aa8", tint: "#eaf1fb", Icon: Paperclip },
  VERIFICATION: { accent: "#1e5aa8", tint: "#eaf1fb", Icon: ShieldCheck },
  VALIDATION: { accent: "#1e8e5a", tint: "#e7f2ec", Icon: Check },
  REJET: { accent: "#a3312f", tint: "#fbe7e7", Icon: XCircle },
  COMPLEMENT: { accent: "#b5852a", tint: "#f7efd9", Icon: Clock },
  IMMATRICULATION: { accent: "#b5852a", tint: "#f7efd9", Icon: Hash },
  CERTIFICAT: { accent: "#b8891f", tint: "#f7efd9", Icon: Award },
  CERTIFICAT_REVOQUE: { accent: "#a3312f", tint: "#fbe7e7", Icon: ShieldAlert },
  CONTROLE: { accent: "#1e5aa8", tint: "#eaf1fb", Icon: ScanLine },
  SIGNALEMENT: { accent: "#a3312f", tint: "#fbe7e7", Icon: Siren },
  SIGNALEMENT_LEVE: { accent: "#1e8e5a", tint: "#e7f2ec", Icon: ShieldCheck },
  ARCHIVAGE: { accent: "#5a6b82", tint: "#eef1f5", Icon: Archive },
};

const TAG_COULEUR: Record<string, { bg: string; fg: string }> = {
  success: { bg: "#e7f2ec", fg: "#1e8e5a" },
  warning: { bg: "#f7efd9", fg: "#b5852a" },
  danger: { bg: "#fbe7e7", fg: "#a3312f" },
  gold: { bg: "#f7efd9", fg: "#b8891f" },
};

const FILTRES = ["Tout", "Traitement", "Certificat", "Contrôles", "Sécurité"] as const;

export default function Historique() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DossierDeVie | null>(null);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]>("Tout");
  const [archivage, setArchivage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const estStaff = user?.role === "AGENT" || user?.role === "ADMIN";
  const retour = estStaff ? `/agent/dossiers/${id}` : `/dossiers/${id}`;

  const charger = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get<DossierDeVie>(`/dossiers/${id}/cycle-de-vie/`);
    setData(data);
  }, [id]);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  async function archiver() {
    if (!id) return;
    setArchivage(true);
    setErreur(null);
    try {
      await api.post(`/dossiers/${id}/archiver/`);
      await charger();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setArchivage(false);
    }
  }

  if (chargement) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </Layout>
    );
  }
  if (!data) {
    return (
      <Layout>
        <p className="text-muted-foreground">{t("Historique introuvable.")}</p>
      </Layout>
    );
  }

  const { vehicule, resume } = data;
  const evenements =
    filtre === "Tout" ? data.evenements : data.evenements.filter((e) => e.categorie === filtre);
  const parAnnee = grouperParAnnee(evenements);
  const estArchive = data.dossier.statut === "ARCHIVE";

  return (
    <Layout>
      <Link
        to={retour}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("Retour au dossier")}
      </Link>

      {/* Héro véhicule */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-navy to-[#0a1e39] px-6 py-6 text-white shadow-[0_30px_60px_-40px_rgba(10,30,57,.85)] sm:px-8">
        <span aria-hidden className="pointer-events-none absolute -right-8 -top-12 select-none text-[230px] leading-none text-white/[0.045]">★</span>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow !text-accent-soft">{t("Dossier de vie · Archivage")} · SNICV</div>
            <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight">{t("Historique du véhicule")}</h1>
            <p className="mt-1 text-[14.5px] text-[#c3d2e8]">
              <b className="font-semibold text-white">{vehicule.marque} {vehicule.modele}</b>
              {" · "}{vehicule.annee} · {t(vehicule.energie)} · VIN <span className="font-mono">{vehicule.vin}</span>
            </p>
            {vehicule.immatriculation && (
              <div className="mt-3.5">
                <PlaqueImmatriculation numero={vehicule.immatriculation} />
              </div>
            )}
          </div>
          <BadgeStatut statut={data.dossier.statut} libelle={data.dossier.statut_libelle} />
        </div>
        <div className="relative mt-6 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/10 pt-5">
          <MetaHero k={t("Titulaire")} v={vehicule.titulaire} />
          {data.immatricule_le && <MetaHero k={t("Immatriculé le")} v={formatDate(data.immatricule_le)} mono />}
          {data.certificat && <MetaHero k={t("Certificat valable")} v={`→ ${formatDate(data.certificat.date_expiration)}`} mono />}
          <MetaHero k={t("Dossier")} v={data.dossier.numero_dossier} mono />
        </div>
      </div>

      {/* KPIs */}
      <div className="my-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <Kpi tint="#eaf1fb" accent="#1e5aa8" Icon={ScanLine} valeur={String(resume.controles)} label={t("Contrôles routiers")} />
        <Kpi tint="#e7f2ec" accent="#1e8e5a" Icon={ShieldCheck} valeur={resume.certificat_actif ? t("Actif") : "—"} label={t("Certificat")} />
        <Kpi tint="#f7efd9" accent="#b8891f" Icon={BarChart3} valeur={String(resume.evenements)} label={t("Événements")} />
        <Kpi tint="#eef1f5" accent="#5a6b82" Icon={Clock} valeur={`${resume.anciennete_mois} ${t("mois")}`} label={t("Ancienneté")} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        {/* Frise */}
        <Panel
          icon={<Clock className="size-[17px]" />}
          titre={t("Frise du cycle de vie")}
          action={
            <button
              onClick={() => id && ouvrirCycleViePdf(id)}
              className="inline-flex items-center gap-2 rounded-lg border border-navy px-3 py-1.5 text-[12.5px] font-semibold text-navy transition hover:bg-navy hover:text-white"
            >
              <Download className="size-3.5" /> {t("Dossier de vie (PDF)")}
            </button>
          }
        >
          <div className="mb-1 flex flex-wrap gap-2 px-1">
            {FILTRES.map((f) => (
              <button
                key={f}
                onClick={() => setFiltre(f)}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                  filtre === f ? "border-navy bg-navy text-white" : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {t(f)}
              </button>
            ))}
          </div>

          {evenements.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">{t("Aucun événement.")}</p>
          ) : (
            parAnnee.map(({ annee, items }) => (
              <div key={annee}>
                <div className="px-1 pt-4 font-serif text-[15px] font-bold text-navy">{annee}</div>
                <div className="relative mt-2 pl-1">
                  {items.map((e, i) => (
                    <LigneEvenement key={i} ev={e} dernier={i === items.length - 1} />
                  ))}
                </div>
              </div>
            ))
          )}
        </Panel>

        {/* Sidebar : résumé + archivage */}
        <div className="space-y-4">
          <Panel icon={<BarChart3 className="size-[17px]" />} titre={t("Résumé")}>
            <dl className="grid gap-0">
              <ResRow k={t("Statut actuel")} v={t(resume.statut_libelle)} vClass={estArchive ? "text-faint" : "text-success"} />
              <ResRow k={t("Événements")} v={String(resume.evenements)} />
              <ResRow k={t("Contrôles routiers")} v={`${resume.controles} · ${resume.controles_authentiques} ${t("authentiques")}`} />
              <ResRow k={t("Signalements")} v={`${resume.signalements_leves} ${t("levé(s)")} · ${resume.signalements_actifs} ${t("actif(s)")}`} />
              {resume.dernier_controle && <ResRow k={t("Dernier contrôle")} v={formatDate(resume.dernier_controle)} mono />}
              {resume.premier_evenement && <ResRow k={t("Premier enregistrement")} v={formatDate(resume.premier_evenement)} mono />}
            </dl>
          </Panel>

          {user?.role === "ADMIN" && (
            <Panel icon={<Archive className="size-[17px]" />} titre={t("Archivage")}>
              {estArchive ? (
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-3 text-[13px] font-medium text-muted-foreground">
                  <Archive className="size-4" /> {t("Dossier archivé — dossier de vie figé.")}
                </div>
              ) : (
                <>
                  <p className="text-[12.5px] text-muted-foreground">
                    {t("Clôt le cycle de vie du véhicule et fige le dossier de vie (consultable, non modifiable). Réservé à l'administration.")}
                  </p>
                  <button
                    onClick={archiver}
                    disabled={archivage}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-muted py-2.5 text-[13.5px] font-semibold text-navy transition hover:bg-navy hover:text-white disabled:opacity-60"
                  >
                    {archivage ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
                    {t("Archiver le dossier")}
                  </button>
                  {erreur && <p className="mt-2 text-[12.5px] text-destructive">{erreur}</p>}
                </>
              )}
            </Panel>
          )}
        </div>
      </div>
    </Layout>
  );
}

/* ── Ligne d'événement (frise) ── */
function LigneEvenement({ ev, dernier }: { ev: EvenementVie; dernier: boolean }) {
  const { t } = useLang();
  const { accent, tint, Icon } = EV[ev.type];
  const tag = ev.tag_niveau ? TAG_COULEUR[ev.tag_niveau] : null;
  return (
    <div className="relative pb-4 pl-10 last:pb-1">
      {!dernier && <span className="absolute left-[15px] top-6 bottom-0 w-0.5 bg-border" />}
      <span
        className="absolute left-1 top-0.5 grid size-6 place-items-center rounded-full border-[3px] border-card"
        style={{ background: tint, color: accent, boxShadow: `0 0 0 1px ${accent}` }}
      >
        <Icon className="size-3" />
      </span>
      <div className="rounded-xl border border-border bg-[#fbfcfe] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13.5px] font-semibold">
            {t(ev.titre)}
            {ev.tag && tag && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: tag.bg, color: tag.fg }}
              >
                {t(ev.tag)}
              </span>
            )}
          </div>
          <div className="shrink-0 text-[11.5px] tabular-nums text-faint">{formatDateTime(ev.date)}</div>
        </div>
        {ev.description && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{ev.description}</div>}
        {ev.acteur && <div className="mt-1 text-[11.5px] text-faint">{t("par")} {ev.acteur}</div>}
      </div>
    </div>
  );
}

/* ── Petits composants ── */
function Panel({ icon, titre, action, children }: { icon: ReactNode; titre: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
      <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-accent">{icon}</span>
          <h2 className="font-serif text-[16px] font-bold text-navy">{titre}</h2>
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MetaHero({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-[#8fa4c2]">{k}</div>
      <div className={`mt-1 text-[14.5px] font-semibold text-[#eef3fa] ${mono ? "font-mono tabular-nums" : ""}`}>{v}</div>
    </div>
  );
}

function Kpi({ tint, accent, Icon, valeur, label }: { tint: string; accent: string; Icon: LucideIcon; valeur: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-[0_1px_0_rgba(13,39,72,.03),0_18px_38px_-30px_rgba(13,39,72,.5)]">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-[9px]" style={{ background: tint, color: accent }}>
          <Icon className="size-[17px]" />
        </span>
        <div>
          <div className="font-serif text-[21px] font-bold leading-none text-navy">{valeur}</div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ResRow({ k, v, mono = false, vClass = "" }: { k: string; v: string; mono?: boolean; vClass?: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-border/70 py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="text-[13px] text-muted-foreground">{k}</dt>
      <dd className={`text-right text-[13px] font-semibold ${mono ? "font-mono tabular-nums" : ""} ${vClass}`}>{v}</dd>
    </div>
  );
}

function BadgeStatut({ statut, libelle }: { statut: string; libelle: string }) {
  const { t } = useLang();
  const ok = ["VALIDE", "IMMATRICULE", "CERTIFIE"].includes(statut);
  const archive = statut === "ARCHIVE";
  const rejete = statut === "REJETE";
  const tone = rejete
    ? "bg-destructive/20 text-[#ffb4b4] border-[#ffb4b4]/30"
    : archive
      ? "bg-white/10 text-[#c3d2e8] border-white/20"
      : ok
        ? "bg-success/20 text-[#7ee0aa] border-[#7ee0aa]/30"
        : "bg-accent/20 text-accent-soft border-accent-soft/30";
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[12px] font-bold tracking-wide ${tone}`}>
      <span className="size-2 rounded-full bg-current" />
      {t(libelle)}
    </span>
  );
}

function grouperParAnnee(evenements: EvenementVie[]) {
  const map = new Map<number, EvenementVie[]>();
  for (const e of evenements) {
    const a = new Date(e.date).getFullYear();
    if (!map.has(a)) map.set(a, []);
    map.get(a)!.push(e);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([annee, items]) => ({ annee, items }));
}

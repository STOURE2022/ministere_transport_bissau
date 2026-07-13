import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  Loader2,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type {
  Echeance,
  NiveauNotification,
  Notification as Notif,
  PreferencesNotification,
} from "@/lib/types";
import { Layout } from "@/components/Layout";

/* Couleur + icône selon le niveau (cohérent maquette). */
const NIVEAU: Record<NiveauNotification, { accent: string; tint: string; Icon: LucideIcon }> = {
  SUCCES: { accent: "#1e8e5a", tint: "#e7f2ec", Icon: CheckCircle2 },
  INFO: { accent: "#1e5aa8", tint: "#eaf1fb", Icon: Mail },
  ALERTE: { accent: "#a3312f", tint: "#fbe7e7", Icon: AlertTriangle },
  ACTION: { accent: "#b5852a", tint: "#f7efd9", Icon: Clock },
  NEUTRE: { accent: "#5a6b82", tint: "#eef1f5", Icon: FileText },
};

const ECHEANCE_ICON: Record<string, LucideIcon> = {
  ASSURANCE: ShieldAlert,
  CT: Gauge,
  CERTIFICAT: ShieldCheck,
};

export default function Notifications() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [compteur, setCompteur] = useState({ non_lues: 0, alertes: 0 });
  const [prefs, setPrefs] = useState<PreferencesNotification | null>(null);
  const [filtre, setFiltre] = useState<"toutes" | "non_lues" | "alertes">("toutes");
  const [chargement, setChargement] = useState(true);

  const chargerNotifs = useCallback(async () => {
    const params = filtre === "toutes" ? {} : { filtre };
    const [n, c] = await Promise.all([
      api.get<{ results: Notif[] }>("/notifications/", { params }),
      api.get<{ non_lues: number; alertes: number }>("/notifications/compteur/"),
    ]);
    setNotifs(n.data.results);
    setCompteur(c.data);
  }, [filtre]);

  useEffect(() => {
    Promise.all([
      api.get<Echeance[]>("/notifications/echeances/").then((r) => setEcheances(r.data)),
      api.get<PreferencesNotification>("/notifications/preferences/").then((r) => setPrefs(r.data)),
      chargerNotifs(),
    ]).finally(() => setChargement(false));
  }, [chargerNotifs]);

  async function marquerLu(n: Notif) {
    if (n.lu) return;
    await api.post(`/notifications/${n.id}/lu/`);
    await chargerNotifs();
  }
  async function toutMarquerLu() {
    await api.post("/notifications/tout-lu/");
    await chargerNotifs();
  }
  function ouvrir(n: Notif) {
    marquerLu(n);
    if (n.lien) navigate(n.lien);
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

  const groupes = grouperParDate(notifs);
  // Une carte par catégorie (la plus urgente), dans l'ordre assurance · CT · certificat.
  const cartes = (["ASSURANCE", "CT", "CERTIFICAT"] as const)
    .map((cat) => echeances.find((e) => e.categorie === cat))
    .filter((e): e is Echeance => Boolean(e));

  return (
    <Layout>
      <div className="mb-6">
        <div className="eyebrow">{t("Espace usager")} · SNICV</div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-navy">
          {t("Notifications & alertes")}
        </h1>
        <p className="mt-1 max-w-[60ch] text-[14.5px] text-muted-foreground">
          {t("Suivez l'avancement de vos dossiers et anticipez les échéances de votre assurance, de votre contrôle technique et de votre certificat.")}
        </p>
      </div>

      {/* Alertes d'échéance */}
      {cartes.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cartes.map((e, i) => (
            <CarteEcheance key={i} echeance={e} onAction={() => navigate(e.lien)} />
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Fil des notifications */}
        <Panel
          icon={<Bell className="size-[17px]" />}
          titre={t("Fil des notifications")}
          action={
            compteur.non_lues > 0 ? (
              <button onClick={toutMarquerLu} className="text-[12.5px] font-semibold text-primary">
                {t("Tout marquer comme lu")}
              </button>
            ) : null
          }
        >
          <div className="mb-1 flex gap-1.5 px-1">
            <Onglet actif={filtre === "toutes"} onClick={() => setFiltre("toutes")}>
              {t("Toutes")}
            </Onglet>
            <Onglet actif={filtre === "non_lues"} onClick={() => setFiltre("non_lues")} badge={compteur.non_lues}>
              {t("Non lues")}
            </Onglet>
            <Onglet actif={filtre === "alertes"} onClick={() => setFiltre("alertes")} badge={compteur.alertes}>
              {t("Alertes")}
            </Onglet>
          </div>

          {notifs.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              {t("Aucune notification.")}
            </p>
          ) : (
            groupes.map((g) => (
              <div key={g.cle}>
                <div className="px-1 pt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                  {t(g.cle)}
                </div>
                <div className="mt-1 space-y-0.5">
                  {g.items.map((n) => (
                    <LigneNotif key={n.id} notif={n} onOuvrir={() => ouvrir(n)} />
                  ))}
                </div>
              </div>
            ))
          )}
        </Panel>

        {/* Préférences + mini-stats */}
        <div className="space-y-4">
          {prefs && <PanneauPreferences prefs={prefs} onSave={setPrefs} />}
          <div className="flex gap-3">
            <MiniStat valeur={compteur.non_lues} label={t("Non lues")} />
            <MiniStat valeur={compteur.alertes} label={t("Alertes actives")} rouge />
          </div>
        </div>
      </div>
    </Layout>
  );
}

/* ── Carte d'échéance ── */
function CarteEcheance({ echeance, onAction }: { echeance: Echeance; onAction: () => void }) {
  const { t } = useLang();
  const { accent } = NIVEAU[echeance.niveau];
  const Icon = ECHEANCE_ICON[echeance.categorie] ?? ShieldCheck;
  const j = echeance.jours_restants;
  const pct = Math.max(4, Math.min(100, Math.round((1 - j / 365) * 100)));
  const cta =
    echeance.categorie === "ASSURANCE"
      ? t("Renouveler")
      : echeance.categorie === "CT"
        ? t("Mettre à jour")
        : t("Voir le certificat");

  let compteRebours: string;
  if (j <= 0) compteRebours = t("Expiré");
  else if (j <= 30) compteRebours = `${t("Expire dans")} ${j} j`;
  else if (j <= 90) compteRebours = `${t("Dans")} ${Math.round(j / 30)} ${t("mois")}`;
  else compteRebours = `${t("Valable")} ${Math.max(1, Math.round(j / 365))} ${t("an(s)")}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[0_1px_0_rgba(13,39,72,.03),0_18px_38px_-30px_rgba(13,39,72,.5)]">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-9 place-items-center rounded-[10px]"
          style={{ background: NIVEAU[echeance.niveau].tint, color: accent }}
        >
          <Icon className="size-[19px]" />
        </span>
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-faint">{t(echeance.label)}</div>
          <div className="text-[14px] font-bold">{echeance.immatriculation ?? "—"}</div>
        </div>
      </div>
      <div className="mt-3 font-serif text-[22px] font-bold" style={{ color: accent }}>
        {compteRebours}
      </div>
      <div className="text-[12px] tabular-nums text-muted-foreground">
        {t("Échéance")} · {formatDate(echeance.echeance)}
      </div>
      <div className="my-3 h-1.5 overflow-hidden rounded-full bg-[#eef1f5]">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
      </div>
      <button
        onClick={onAction}
        className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-bold text-white"
        style={{ background: accent }}
      >
        {cta} <ArrowRight className="size-3.5" />
      </button>
    </div>
  );
}

/* ── Ligne de notification ── */
function LigneNotif({ notif, onOuvrir }: { notif: Notif; onOuvrir: () => void }) {
  const { t } = useLang();
  const { accent, tint, Icon } = NIVEAU[notif.niveau];
  const accentBtn = notif.niveau === "ALERTE" || notif.niveau === "ACTION";
  return (
    <div className={`flex gap-3 rounded-xl p-3 ${notif.lu ? "" : "bg-[#f4f8ff]"}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px]" style={{ background: tint, color: accent }}>
        <Icon className="size-[19px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[14px] font-semibold">
          {!notif.lu && <span className="size-2 shrink-0 rounded-full bg-primary" />}
          {t(notif.titre)}
        </div>
        {notif.message && <div className="mt-0.5 text-[13px] text-muted-foreground">{notif.message}</div>}
        <div className="mt-1.5 text-[11.5px] tabular-nums text-faint">
          {formatDateTime(notif.date_creation)}
          {notif.categorie && <> · {t(notif.categorie)}</>}
        </div>
        {notif.cta_label && (
          <button
            onClick={onOuvrir}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition"
            style={
              accentBtn
                ? { background: accent, color: "#fff" }
                : { border: "1px solid var(--color-border)", color: "var(--color-navy)" }
            }
          >
            {t(notif.cta_label)}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Préférences ── */
function PanneauPreferences({
  prefs,
  onSave,
}: {
  prefs: PreferencesNotification;
  onSave: (p: PreferencesNotification) => void;
}) {
  const { t } = useLang();
  const [local, setLocal] = useState(prefs);
  const [enregistre, setEnregistre] = useState(false);
  const [ok, setOk] = useState(false);

  function toggleCanal(cle: "canal_email" | "canal_sms" | "canal_push") {
    setLocal((p) => ({ ...p, [cle]: !p[cle] }));
    setOk(false);
  }
  function toggleDelai(j: number) {
    setLocal((p) => ({
      ...p,
      delais_relance: p.delais_relance.includes(j)
        ? p.delais_relance.filter((d) => d !== j)
        : [...p.delais_relance, j].sort((a, b) => b - a),
    }));
    setOk(false);
  }
  async function enregistrer() {
    setEnregistre(true);
    try {
      const { data } = await api.put<PreferencesNotification>("/notifications/preferences/", {
        canal_email: local.canal_email,
        canal_sms: local.canal_sms,
        canal_push: local.canal_push,
        delais_relance: local.delais_relance,
      });
      setLocal(data);
      onSave(data);
      setOk(true);
    } finally {
      setEnregistre(false);
    }
  }

  return (
    <Panel icon={<Bell className="size-[17px]" />} titre={t("Préférences")}>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{t("Canaux")}</div>
      <Canal
        icon={<Mail className="size-[17px]" />}
        titre={t("E-mail")}
        sousTitre={t("Alertes et suivi par e-mail")}
        actif={local.canal_email}
        onToggle={() => toggleCanal("canal_email")}
      />
      <Canal
        icon={<Smartphone className="size-[17px]" />}
        titre={t("SMS")}
        sousTitre={t("Relances par SMS")}
        actif={local.canal_sms}
        onToggle={() => toggleCanal("canal_sms")}
        vert
      />
      <Canal
        icon={<Bell className="size-[17px]" />}
        titre={t("Notifications push")}
        sousTitre={t("Application mobile")}
        actif={local.canal_push}
        onToggle={() => toggleCanal("canal_push")}
      />

      <div className="mt-4 border-t border-border pt-3.5">
        <div className="mb-2 text-[12.5px] text-muted-foreground">{t("Me prévenir avant échéance")}</div>
        <div className="flex flex-wrap gap-2">
          {local.delais_disponibles.map((j) => {
            const actif = local.delais_relance.includes(j);
            return (
              <button
                key={j}
                onClick={() => toggleDelai(j)}
                className={`rounded-full border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold tabular-nums transition ${
                  actif ? "border-accent bg-accent text-white" : "border-border text-muted-foreground"
                }`}
              >
                {j} j
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={enregistrer}
        disabled={enregistre}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-navy py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
      >
        {enregistre ? <Loader2 className="size-4 animate-spin" /> : ok ? <CheckCircle2 className="size-4" /> : null}
        {ok ? t("Préférences enregistrées") : t("Enregistrer mes préférences")}
      </button>
    </Panel>
  );
}

function Canal({
  icon,
  titre,
  sousTitre,
  actif,
  onToggle,
  vert = false,
}: {
  icon: ReactNode;
  titre: string;
  sousTitre: string;
  actif: boolean;
  onToggle: () => void;
  vert?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border/70 py-2.5 first:border-t-0">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-lg"
        style={{
          background: vert ? "#e7f2ec" : "#eaf1fb",
          color: vert ? "#1e8e5a" : "#1e5aa8",
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold">{titre}</div>
        <div className="truncate text-[11.5px] text-faint">{sousTitre}</div>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={actif}
        className={`relative h-6 w-[42px] shrink-0 rounded-full transition ${actif ? "bg-success" : "bg-[#cdd5df]"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${actif ? "left-5" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

/* ── Petits composants ── */
function Panel({
  icon,
  titre,
  action,
  children,
}: {
  icon: ReactNode;
  titre: string;
  action?: ReactNode;
  children: ReactNode;
}) {
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

function Onglet({
  actif,
  onClick,
  badge,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
        actif ? "bg-navy text-white" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          className={`ml-1.5 rounded-md px-1.5 text-[10px] font-extrabold ${
            actif ? "bg-white/25 text-white" : "bg-destructive text-white"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function MiniStat({ valeur, label, rouge = false }: { valeur: number; label: string; rouge?: boolean }) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-card p-3.5 shadow-[0_1px_0_rgba(13,39,72,.03),0_18px_38px_-30px_rgba(13,39,72,.5)]">
      <div className="font-serif text-2xl font-bold" style={{ color: rouge ? "#a3312f" : "var(--color-navy)" }}>
        {valeur}
      </div>
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
    </div>
  );
}

/* Regroupe les notifications par ancienneté. */
function grouperParDate(notifs: Notif[]) {
  const jour = 86_400_000;
  const now = Date.now();
  const buckets: Record<string, Notif[]> = { "Aujourd'hui": [], "Cette semaine": [], "Plus tôt": [] };
  for (const n of notifs) {
    const age = now - new Date(n.date_creation).getTime();
    const cle = age < jour ? "Aujourd'hui" : age < 7 * jour ? "Cette semaine" : "Plus tôt";
    buckets[cle].push(n);
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([cle, items]) => ({ cle, items }));
}

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  SlidersHorizontal,
  Smartphone,
  Trash2,
} from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { ConfigurationPaiement, OperateurPaiement } from "@/lib/types";
import { Layout } from "@/components/Layout";

export default function PaiementsConfig() {
  const { t } = useLang();
  const [cfg, setCfg] = useState<ConfigurationPaiement | null>(null);
  const [operateurs, setOperateurs] = useState<OperateurPaiement[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<ConfigurationPaiement>("/paiements/configuration/").then((r) => setCfg(r.data)),
      api.get<{ results: OperateurPaiement[] }>("/paiements/operateurs/").then((r) => setOperateurs(r.data.results)),
    ]).finally(() => setChargement(false));
  }, []);

  async function rechargerOperateurs() {
    const { data } = await api.get<{ results: OperateurPaiement[] }>("/paiements/operateurs/");
    setOperateurs(data.results);
  }

  if (chargement || !cfg) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Link
        to="/paiements"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("Journal des paiements")}
      </Link>

      <div className="mb-6">
        <div className="eyebrow">{t("Administration")} · SNICV</div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-navy">
          {t("Configuration des paiements")}
        </h1>
        <p className="mt-1 max-w-[62ch] text-[14.5px] text-muted-foreground">
          {t("Montants, devise et opérateurs de la taxe d'immatriculation — rien n'est codé en dur, tout se règle ici.")}
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1fr]">
        <PanneauMontants cfg={cfg} onSave={setCfg} />
        <PanneauOperateurs operateurs={operateurs} onChange={rechargerOperateurs} />
      </div>
    </Layout>
  );
}

/* ── Montants & barème ── */
function PanneauMontants({
  cfg,
  onSave,
}: {
  cfg: ConfigurationPaiement;
  onSave: (c: ConfigurationPaiement) => void;
}) {
  const { t } = useLang();
  const [local, setLocal] = useState(cfg);
  const [enreg, setEnreg] = useState(false);
  const [ok, setOk] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const total = local.montant_taxe + local.montant_timbre + local.frais_service;

  function maj<K extends keyof ConfigurationPaiement>(cle: K, val: ConfigurationPaiement[K]) {
    setLocal((c) => ({ ...c, [cle]: val }));
    setOk(false);
  }

  async function enregistrer() {
    setEnreg(true);
    setErreur(null);
    try {
      const { data } = await api.put<ConfigurationPaiement>("/paiements/configuration/", {
        devise: local.devise,
        montant_taxe: local.montant_taxe,
        montant_timbre: local.montant_timbre,
        frais_service: local.frais_service,
        paiement_requis: local.paiement_requis,
      });
      setLocal(data);
      onSave(data);
      setOk(true);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnreg(false);
    }
  }

  return (
    <Panel icon={<SlidersHorizontal className="size-[17px]" />} titre={t("Barème & devise")}>
      <div className="grid gap-3">
        <ChampMontant label={t("Taxe d'immatriculation")} valeur={local.montant_taxe} devise={local.devise} onChange={(v) => maj("montant_taxe", v)} />
        <ChampMontant label={t("Timbre fiscal")} valeur={local.montant_timbre} devise={local.devise} onChange={(v) => maj("montant_timbre", v)} />
        <ChampMontant label={t("Frais de service")} valeur={local.frais_service} devise={local.devise} onChange={(v) => maj("frais_service", v)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">{t("Devise")}</label>
            <input
              value={local.devise}
              onChange={(e) => maj("devise", e.target.value.toUpperCase().slice(0, 8))}
              className="w-full rounded-lg border-[1.5px] border-border px-3 py-2 font-mono font-semibold text-navy outline-none focus:border-navy"
            />
          </div>
          <div className="flex flex-col justify-end">
            <div className="rounded-lg border border-border bg-[#f7f9fc] px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.1em] text-faint">{t("Total à payer")}</div>
              <div className="font-serif text-lg font-bold text-navy tabular-nums">
                {total.toLocaleString("fr-FR")} {local.devise}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exiger le paiement avant le certificat */}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-navy">{t("Exiger le paiement avant le certificat")}</div>
          <div className="text-[12px] text-muted-foreground">
            {t("Si activé, l'agent ne peut émettre le certificat qu'après règlement de la taxe.")}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={local.paiement_requis}
          onClick={() => maj("paiement_requis", !local.paiement_requis)}
          className={`relative h-6 w-[42px] shrink-0 rounded-full transition ${local.paiement_requis ? "bg-success" : "bg-[#cdd5df]"}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${local.paiement_requis ? "left-5" : "left-0.5"}`} />
        </button>
      </div>

      {erreur && <p className="mt-3 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">{erreur}</p>}

      <button
        type="button"
        onClick={enregistrer}
        disabled={enreg}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-navy py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
      >
        {enreg ? <Loader2 className="size-4 animate-spin" /> : ok ? <CheckCircle2 className="size-4" /> : <Save className="size-4" />}
        {ok ? t("Barème enregistré") : t("Enregistrer le barème")}
      </button>
    </Panel>
  );
}

function ChampMontant({
  label,
  valeur,
  devise,
  onChange,
}: {
  label: string;
  valeur: number;
  devise: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border-[1.5px] border-border px-3 py-2 focus-within:border-navy">
        <input
          type="number"
          min={0}
          value={valeur}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="flex-1 bg-transparent font-mono font-semibold text-navy tabular-nums outline-none"
        />
        <span className="text-[12px] font-bold text-faint">{devise}</span>
      </div>
    </div>
  );
}

/* ── Opérateurs mobile money ── */
function PanneauOperateurs({
  operateurs,
  onChange,
}: {
  operateurs: OperateurPaiement[];
  onChange: () => Promise<void>;
}) {
  const { t } = useLang();
  const [ajout, setAjout] = useState(false);
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [ussd, setUssd] = useState("");
  const [couleur, setCouleur] = useState("#0d2748");
  const [enreg, setEnreg] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer() {
    if (!nom.trim() || !code.trim()) return;
    setEnreg(true);
    setErreur(null);
    try {
      await api.post("/paiements/operateurs/", {
        nom: nom.trim(),
        code: code.trim().toUpperCase(),
        code_ussd: ussd.trim(),
        couleur,
        ordre: operateurs.length + 1,
      });
      setNom("");
      setCode("");
      setUssd("");
      setCouleur("#0d2748");
      setAjout(false);
      await onChange();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnreg(false);
    }
  }

  async function basculerActif(op: OperateurPaiement) {
    await api.patch(`/paiements/operateurs/${op.id}/`, { actif: !op.actif });
    await onChange();
  }

  async function supprimer(op: OperateurPaiement) {
    await api.delete(`/paiements/operateurs/${op.id}/`);
    await onChange();
  }

  return (
    <Panel
      icon={<Smartphone className="size-[17px]" />}
      titre={t("Opérateurs mobile money")}
      action={
        <button
          onClick={() => setAjout((v) => !v)}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
        >
          <Plus className="size-3.5" /> {t("Ajouter")}
        </button>
      }
    >
      {ajout && (
        <div className="mb-4 space-y-2.5 rounded-xl border border-dashed border-border p-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder={t("Nom (ex. Wave)")}
              className="rounded-lg border-[1.5px] border-border px-3 py-2 text-[13px] outline-none focus:border-navy"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("Code (ex. WAVE)")}
              className="rounded-lg border-[1.5px] border-border px-3 py-2 font-mono text-[13px] outline-none focus:border-navy"
            />
            <input
              value={ussd}
              onChange={(e) => setUssd(e.target.value)}
              placeholder={t("Code USSD (ex. #144#)")}
              className="rounded-lg border-[1.5px] border-border px-3 py-2 font-mono text-[13px] outline-none focus:border-navy"
            />
            <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-border px-3 py-1.5">
              <input type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} className="size-7 cursor-pointer rounded" />
              <span className="font-mono text-[12px] text-muted-foreground">{couleur}</span>
            </label>
          </div>
          {erreur && <p className="text-[12.5px] text-destructive">{erreur}</p>}
          <button
            onClick={creer}
            disabled={enreg || !nom.trim() || !code.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {enreg ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {t("Créer l'opérateur")}
          </button>
        </div>
      )}

      <div className="space-y-2.5">
        {operateurs.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">{t("Aucun opérateur configuré.")}</p>
        ) : (
          operateurs.map((op) => (
            <div key={op.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[10px] font-extrabold"
                style={{ background: op.couleur, color: estClair(op.couleur) ? "#0d2748" : "#fff" }}
              >
                {op.nom.slice(0, 3)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-navy">{op.nom}</div>
                <div className="text-[11.5px] text-faint">
                  <span className="font-mono">{op.code}</span>
                  {op.code_ussd && <> · {op.code_ussd}</>}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={op.actif}
                onClick={() => basculerActif(op)}
                title={op.actif ? t("Actif") : t("Inactif")}
                className={`relative h-6 w-[42px] shrink-0 rounded-full transition ${op.actif ? "bg-success" : "bg-[#cdd5df]"}`}
              >
                <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${op.actif ? "left-5" : "left-0.5"}`} />
              </button>
              <button
                type="button"
                onClick={() => supprimer(op)}
                title={t("Supprimer")}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-[#fbe7e7] hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </div>
      <p className="mt-3 text-[11.5px] text-faint">
        {t("Seuls les opérateurs actifs sont proposés à l'usager au moment du paiement.")}
      </p>
    </Panel>
  );
}

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
      <div className="p-5">{children}</div>
    </section>
  );
}

function estClair(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

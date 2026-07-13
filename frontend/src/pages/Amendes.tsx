import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Download,
  Gavel,
  Loader2,
  MessageSquareWarning,
  ShieldCheck,
  Ban,
} from "lucide-react";
import { api, messageErreur, telechargerQuittancePdf } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { Infraction, OperateurPaiement, StatutInfraction } from "@/lib/types";
import { Layout } from "@/components/Layout";

function fmt(montant: number, devise: string): string {
  return `${montant.toLocaleString("fr-FR")} ${devise}`;
}

function estClair(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

const STATUT: Record<StatutInfraction, { tint: string; color: string; Icon: typeof AlertTriangle }> = {
  A_REGLER: { tint: "#fbe7e7", color: "#a3312f", Icon: AlertTriangle },
  PAYEE: { tint: "#e7f2ec", color: "#166b44", Icon: CheckCircle2 },
  CONTESTEE: { tint: "#f7efd9", color: "#8a6410", Icon: MessageSquareWarning },
  ANNULEE: { tint: "#eef1f5", color: "#5a6b82", Icon: Ban },
};

export default function Amendes() {
  const { t } = useLang();
  const [amendes, setAmendes] = useState<Infraction[]>([]);
  const [operateurs, setOperateurs] = useState<OperateurPaiement[]>([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    const { data } = await api.get<{ results: Infraction[] }>("/infractions/");
    setAmendes(data.results);
  }, []);

  useEffect(() => {
    Promise.all([
      charger(),
      api
        .get<{ results: OperateurPaiement[] }>("/paiements/operateurs/")
        .then((r) => setOperateurs(r.data.results.filter((o) => o.actif)))
        .catch(() => setOperateurs([])),
    ]).finally(() => setChargement(false));
  }, [charger]);

  const aRegler = amendes.filter((a) => a.statut === "A_REGLER");
  const totalDu = aRegler.reduce((s, a) => s + a.montant, 0);
  const devise = amendes[0]?.devise ?? "XOF";

  return (
    <Layout>
      <div className="mb-6">
        <div className="eyebrow">{t("Espace usager")} · SNICV</div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-navy">{t("Mes amendes")}</h1>
        <p className="mt-1 max-w-[60ch] text-[14.5px] text-muted-foreground">
          {t("Consultez les procès-verbaux de vos véhicules et réglez vos amendes par mobile money.")}
        </p>
      </div>

      {aRegler.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[#f1cfcf] bg-[#fdf3f2] px-5 py-4">
          <AlertTriangle className="size-6 text-[#a3312f]" />
          <div className="flex-1">
            <div className="font-semibold text-[#9a2f2f]">
              {aRegler.length} {t("amende(s) à régler")}
            </div>
            <div className="text-[13px] text-[#9a2f2f]/80">{t("Réglez-les pour clôturer les procès-verbaux.")}</div>
          </div>
          <div className="font-serif text-2xl font-bold text-[#a3312f] tabular-nums">{fmt(totalDu, devise)}</div>
        </div>
      )}

      {chargement ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : amendes.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-16 text-center">
          <ShieldCheck className="mx-auto size-9 text-success" />
          <p className="mt-3 font-serif text-[17px] font-bold text-navy">{t("Aucune amende")}</p>
          <p className="text-[13px] text-muted-foreground">{t("Vos véhicules n'ont aucun procès-verbal. Continuez comme ça !")}</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {amendes.map((a) => (
            <CarteAmende key={a.id} amende={a} operateurs={operateurs} onChange={charger} />
          ))}
        </div>
      )}
    </Layout>
  );
}

function CarteAmende({
  amende,
  operateurs,
  onChange,
}: {
  amende: Infraction;
  operateurs: OperateurPaiement[];
  onChange: () => Promise<void>;
}) {
  const { t } = useLang();
  const s = STATUT[amende.statut];
  const [mode, setMode] = useState<"" | "payer" | "contester">("");
  const [tel, setTel] = useState(false);

  async function quittance() {
    setTel(true);
    try {
      await telechargerQuittancePdf(amende.id, amende.quittance_reference);
    } finally {
      setTel(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_16px_34px_-28px_rgba(13,39,72,.5)]">
      <div className="flex items-center gap-3.5 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: s.tint, color: s.color }}>
          <s.Icon className="size-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-bold text-navy">{t(amende.libelle)}</div>
          <div className="text-[12px] text-muted-foreground">
            <span className="font-mono">{amende.reference}</span> · {formatDateTime(amende.date_infraction)}
            {amende.lieu && <> · {amende.lieu}</>}
            {amende.immatriculation && <> · <span className="font-mono">{amende.immatriculation}</span></>}
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-[19px] font-bold text-navy tabular-nums">{fmt(amende.montant, amende.devise)}</div>
          <span className="mt-0.5 inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: s.tint, color: s.color }}>
            {t(amende.statut_libelle)}
          </span>
        </div>
      </div>

      {/* Actions selon le statut */}
      {(amende.statut === "A_REGLER" || amende.statut === "PAYEE" || amende.statut === "CONTESTEE" || amende.statut === "ANNULEE") && (
        <div className="border-t border-border/60 px-4 py-3">
          {amende.statut === "A_REGLER" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setMode((m) => (m === "payer" ? "" : "payer"))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#a3312f] px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:brightness-110"
              >
                <BadgeCheck className="size-4" /> {t("Payer par mobile money")}
              </button>
              <button
                onClick={() => setMode((m) => (m === "contester" ? "" : "contester"))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-semibold text-navy transition hover:bg-muted"
              >
                <Gavel className="size-4" /> {t("Contester")}
              </button>
            </div>
          )}
          {amende.statut === "PAYEE" && (
            <button
              onClick={quittance}
              disabled={tel || !amende.a_quittance}
              className="inline-flex items-center gap-1.5 rounded-lg border-[1.5px] border-navy px-3.5 py-2 text-[12.5px] font-semibold text-navy transition hover:bg-navy hover:text-white disabled:opacity-60"
            >
              {tel ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {t("Télécharger la quittance")}
            </button>
          )}
          {amende.statut === "CONTESTEE" && (
            <p className="flex items-start gap-2 text-[12.5px] text-[#8a6410]">
              <MessageSquareWarning className="mt-px size-4 shrink-0" />
              <span>
                <b>{t("Contestation en cours d'examen.")}</b>
                {amende.motif_contestation && <> « {amende.motif_contestation} »</>}
              </span>
            </p>
          )}
          {amende.statut === "ANNULEE" && (
            <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
              <Ban className="mt-px size-4 shrink-0" />
              <span>
                <b>{t("Amende annulée par l'administration.")}</b>
                {amende.motif_annulation && <> {amende.motif_annulation}</>}
              </span>
            </p>
          )}

          {mode === "payer" && (
            <PayerPanel amende={amende} operateurs={operateurs} onDone={onChange} onClose={() => setMode("")} />
          )}
          {mode === "contester" && (
            <ContesterPanel amende={amende} onDone={onChange} onClose={() => setMode("")} />
          )}
        </div>
      )}
    </div>
  );
}

function PayerPanel({
  amende,
  operateurs,
  onDone,
  onClose,
}: {
  amende: Infraction;
  operateurs: OperateurPaiement[];
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [operateur, setOperateur] = useState<OperateurPaiement | null>(operateurs[0] ?? null);
  const [numero, setNumero] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function payer() {
    if (!operateur || !numero.trim()) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post(`/infractions/${amende.id}/payer/`, { operateur: operateur.code, numero: numero.trim() });
      onClose();
      await onDone();
    } catch (err) {
      setErreur(messageErreur(err, t("Paiement impossible. Réessayez.")));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-border p-3.5">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{t("Opérateur mobile money")}</div>
      <div className="grid grid-cols-2 gap-2.5">
        {operateurs.map((op) => {
          const actif = operateur?.id === op.id;
          return (
            <button
              key={op.id}
              type="button"
              onClick={() => setOperateur(op)}
              className={`flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left transition ${actif ? "border-navy" : "border-border"}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-[8px] text-[10px] font-extrabold" style={{ background: op.couleur, color: estClair(op.couleur) ? "#0d2748" : "#fff" }}>
                {op.nom.slice(0, 3)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-bold">{op.nom}</span>
                {op.code_ussd && <span className="block text-[10.5px] text-faint">{op.code_ussd}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border-[1.5px] border-border px-3 py-2.5 focus-within:border-navy">
        <span>🇬🇼</span>
        <span className="font-mono font-bold text-navy">+245</span>
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="95 500 01 03"
          inputMode="tel"
          className="flex-1 bg-transparent font-mono tracking-wide outline-none placeholder:text-faint"
        />
      </div>
      {erreur && <p className="mt-2 text-[12.5px] text-destructive">{erreur}</p>}
      <button
        onClick={payer}
        disabled={enCours || !operateur || !numero.trim()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#16396a] to-navy py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
      >
        {enCours ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {t("Payer")} {fmt(amende.montant, amende.devise)}
      </button>
    </div>
  );
}

function ContesterPanel({
  amende,
  onDone,
  onClose,
}: {
  amende: Infraction;
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLang();
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function contester() {
    if (!motif.trim()) return;
    setEnCours(true);
    setErreur(null);
    try {
      await api.post(`/infractions/${amende.id}/contester/`, { motif: motif.trim() });
      onClose();
      await onDone();
    } catch (err) {
      setErreur(messageErreur(err, t("Contestation impossible.")));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-border p-3.5">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">
        {t("Motif de la contestation")}
      </label>
      <textarea
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        rows={2}
        placeholder={t("Expliquez pourquoi vous contestez ce procès-verbal.")}
        className="w-full resize-y rounded-xl border-[1.5px] border-border px-3 py-2.5 text-[13.5px] outline-none focus:border-navy"
      />
      {erreur && <p className="mt-2 text-[12.5px] text-destructive">{erreur}</p>}
      <button
        onClick={contester}
        disabled={enCours || !motif.trim()}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        {enCours ? <Loader2 className="size-4 animate-spin" /> : <Gavel className="size-4" />}
        {t("Envoyer la contestation")}
      </button>
    </div>
  );
}

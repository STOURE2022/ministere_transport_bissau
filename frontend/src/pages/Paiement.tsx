import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  ShieldCheck,
  Star,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api, messageErreur, telechargerRecuPdf } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type {
  DossierDetail as Dossier,
  MontantPaiement,
  OperateurPaiement,
  Paiement as PaiementType,
} from "@/lib/types";
import { Layout } from "@/components/Layout";

function fmt(montant: number, devise: string): string {
  return `${montant.toLocaleString("fr-FR").replace(/ /g, " ")} ${devise}`;
}

export default function Paiement() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [montant, setMontant] = useState<MontantPaiement | null>(null);
  const [paiement, setPaiement] = useState<PaiementType | null>(null);
  const [operateur, setOperateur] = useState<OperateurPaiement | null>(null);
  const [numero, setNumero] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!id) return;
    const [d, m] = await Promise.all([
      api.get<Dossier>(`/dossiers/${id}/`),
      api.get<MontantPaiement>(`/dossiers/${id}/paiement/montant/`),
    ]);
    setDossier(d.data);
    setMontant(m.data);
    setOperateur((o) => o ?? m.data.operateurs[0] ?? null);
    // Déjà réglé : on récupère le reçu existant.
    if (m.data.deja_paye) {
      const p = await api.get<PaiementType>(`/dossiers/${id}/paiement/`).catch(() => null);
      if (p) setPaiement(p.data);
    }
  }, [id]);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  async function payer() {
    if (!id || !operateur || !numero.trim()) return;
    setEnCours(true);
    setErreur(null);
    try {
      const { data } = await api.post<PaiementType>(`/dossiers/${id}/paiement/`, {
        operateur: operateur.code,
        numero: numero.trim(),
      });
      setPaiement(data);
    } catch (err) {
      setErreur(messageErreur(err, t("Paiement impossible. Réessayez.")));
    } finally {
      setEnCours(false);
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
  if (!dossier || !montant) {
    return (
      <Layout>
        <p className="text-muted-foreground">{t("Dossier introuvable.")}</p>
      </Layout>
    );
  }

  const immat = paiement?.immatriculation ?? null;
  const paye = Boolean(paiement && paiement.statut === "PAYE");
  const etape = paye ? 4 : operateur ? (numero.trim() ? 3 : 2) : 1;

  return (
    <Layout>
      <Link
        to={`/dossiers/${dossier.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("Retour au dossier")}
      </Link>

      <div className="mb-6">
        <div className="eyebrow">{t("Espace usager")} · SNICV</div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-navy">
          {t("Paiement de la taxe d'immatriculation")}
        </h1>
        <div className="mt-2 inline-flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          {t("Dossier")}{" "}
          <span className="rounded-full bg-[#eef2f8] px-2.5 py-1 font-semibold text-navy tnum">
            {dossier.numero_dossier}
          </span>
          {immat && (
            <>
              · {t("Plaque")}{" "}
              <span className="rounded-full bg-[#eef2f8] px-2.5 py-1 font-mono font-semibold text-navy tnum">
                {immat}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* ── Panneau paiement ── */}
        <Panel icon={<CreditCard className="size-[17px]" />} titre={t("Régler par mobile money")}>
          <Stepper etape={etape} paye={paye} />

          {/* Détail des montants (depuis la configuration admin) */}
          <div className="overflow-hidden rounded-xl border border-border">
            {montant.lignes.map((l, i) => (
              <div
                key={i}
                className="flex justify-between border-t border-border/60 px-3.5 py-2.5 text-[13.5px] first:border-t-0"
              >
                <span className="text-muted-foreground">{t(l.libelle)}</span>
                <span className="tabular-nums">{fmt(l.montant, montant.devise)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border bg-[#f7f9fc] px-3.5 py-2.5 font-bold text-navy">
              <span>{t("Total à payer")}</span>
              <span className="font-serif tabular-nums">{fmt(montant.total, montant.devise)}</span>
            </div>
          </div>

          {paye ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#bfe0cd] bg-[#e7f2ec] px-4 py-3.5 text-[13px] text-[#166b44]">
              <CheckCircle2 className="mt-px size-5 shrink-0" />
              <span>
                <b className="font-semibold">{t("Taxe réglée.")}</b>{" "}
                {t("Votre reçu officiel est disponible ci-contre. Il débloque l'émission du certificat.")}
              </span>
            </div>
          ) : (
            <>
              <div className="mb-2.5 mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                {t("Opérateur mobile money")}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {montant.operateurs.map((op) => {
                  const actif = operateur?.id === op.id;
                  const clair = estClair(op.couleur);
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setOperateur(op)}
                      className={`relative flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition ${
                        actif ? "border-navy shadow-[0_8px_22px_-16px_rgba(13,39,72,.6)]" : "border-border"
                      }`}
                    >
                      {actif && (
                        <span className="absolute right-2 top-2 grid size-[18px] place-items-center rounded-full bg-navy text-white">
                          <CheckCircle2 className="size-3" />
                        </span>
                      )}
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[11px] font-extrabold"
                        style={{ background: op.couleur, color: clair ? "#0d2748" : "#fff" }}
                      >
                        {op.nom.slice(0, 3)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-bold">{op.nom}</span>
                        {op.code_ussd && <span className="block text-[11px] text-faint">{op.code_ussd}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <label htmlFor="numero" className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">
                  {t("Numéro mobile money")}
                </label>
                <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-border px-3 py-2.5 focus-within:border-navy">
                  <span className="text-base">🇬🇼</span>
                  <span className="font-mono font-bold text-navy">+245</span>
                  <input
                    id="numero"
                    inputMode="tel"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="95 500 01 03"
                    className="flex-1 bg-transparent font-mono tracking-wide outline-none placeholder:text-faint"
                  />
                </div>
              </div>

              {erreur && (
                <p className="mt-3 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">{erreur}</p>
              )}

              <button
                type="button"
                onClick={payer}
                disabled={enCours || !operateur || !numero.trim()}
                className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#16396a] to-navy py-3.5 text-[15px] font-bold text-white shadow-[0_14px_30px_-18px_rgba(13,39,72,.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enCours ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-[18px]" />}
                {t("Payer")} <span className="font-serif tabular-nums">{fmt(montant.total, montant.devise)}</span>
              </button>

              <div className="mt-3.5 flex items-start gap-2.5 text-[12px] text-muted-foreground">
                <ShieldCheck className="mt-px size-[15px] shrink-0 text-success" />
                <span>
                  {t("Paiement sécurisé. Vous recevrez une demande de confirmation (USSD) sur votre téléphone pour valider.")}
                </span>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {[t("CHIFFRÉ TLS"), t("SNICV · TRÉSOR PUBLIC"), t("REÇU OFFICIEL")].map((b) => (
                  <span key={b} className="rounded-md bg-[#f1f4f9] px-2.5 py-1.5 text-[10.5px] font-bold text-muted-foreground">
                    {b}
                  </span>
                ))}
              </div>
            </>
          )}
        </Panel>

        {/* ── Reçu ── */}
        <div>{paiement ? <Recu paiement={paiement} /> : <RecuEnAttente />}</div>
      </div>
    </Layout>
  );
}

/* ── Reçu officiel (miroir du PDF) ── */
function Recu({ paiement }: { paiement: PaiementType }) {
  const { t } = useLang();
  const [tel, setTel] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function telecharger() {
    setTel(true);
    setErreur(null);
    try {
      await telechargerRecuPdf(paiement.id, paiement.reference);
    } catch {
      setErreur(t("Reçu momentanément indisponible."));
    } finally {
      setTel(false);
    }
  }

  const qr = `SNICV|RECU|${paiement.reference}|${paiement.montant_total} ${paiement.devise}|${paiement.reference_transaction}`;
  const lignes = [
    { k: t("Reçu N°"), v: paiement.reference, mono: true },
    { k: t("Dossier"), v: paiement.numero_dossier, mono: true },
    { k: t("Opérateur"), v: paiement.operateur },
    { k: t("Réf. transaction"), v: paiement.reference_transaction || "—", mono: true },
    { k: t("Date"), v: paiement.paye_le ? formatDateTime(paiement.paye_le) : "—", mono: true },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-b from-navy to-[#0a1e39] px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full border-2 border-accent text-accent">
            <Star className="size-4 fill-accent" />
          </span>
          <div>
            <div className="font-serif text-[15px] font-bold">{t("Reçu de paiement")}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-accent-soft">
              {t("République de Guinée-Bissau")}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-[#a7e8c4] to-success px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-navy">
          <BadgeCheck className="size-3.5" /> {t("PAYÉ")}
        </span>
      </div>

      <div className="grid grid-cols-1 items-center gap-4 p-5 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-faint">{t("Montant réglé")}</div>
          <div className="mt-1 font-serif text-[32px] font-bold leading-none text-navy tabular-nums">
            {fmt(paiement.montant_total, paiement.devise)}
          </div>
          <div className="mt-4 grid">
            {lignes.map((l) => (
              <div key={l.k} className="flex justify-between gap-3 border-t border-border/60 py-2 text-[12.5px] first:border-t-0">
                <span className="text-muted-foreground">{l.k}</span>
                <span className={`text-right font-semibold ${l.mono ? "font-mono tnum" : ""}`}>{l.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl border border-border bg-[#f3f6fb] p-2.5">
            <QRCodeSVG value={qr} size={112} level="M" />
          </div>
          <div className="max-w-[130px] text-center text-[10.5px] font-semibold text-muted-foreground">
            {t("Vérifier l'authenticité du reçu")}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-t border-border/60 bg-[#f7f9fc] px-5 py-3">
        <span className="self-stretch w-1 rounded-full bg-success" />
        <p className="text-[11px] text-muted-foreground">
          <b className="text-navy">{t("Paiement confirmé.")}</b>{" "}
          {t("Ce reçu débloque l'émission du certificat d'immatriculation.")}
        </p>
      </div>

      <div className="p-5 pt-4">
        <button
          type="button"
          onClick={telecharger}
          disabled={tel}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-navy py-2.5 text-[13px] font-semibold text-navy transition hover:bg-navy hover:text-white disabled:opacity-60"
        >
          {tel ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {t("Télécharger le reçu (PDF)")}
        </button>
        {erreur && <p className="mt-2 text-center text-[12px] text-destructive">{erreur}</p>}
      </div>
    </div>
  );
}

/* ── Reçu en attente (avant paiement) ── */
function RecuEnAttente() {
  const { t } = useLang();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#eef2f8] text-navy/40">
        <CreditCard className="size-7" />
      </span>
      <p className="mt-4 font-serif text-[16px] font-bold text-navy">{t("Votre reçu apparaîtra ici")}</p>
      <p className="mx-auto mt-1 max-w-[34ch] text-[13px] text-muted-foreground">
        {t("Une fois le paiement confirmé, un reçu officiel signé (référence + QR de vérification) est généré instantanément.")}
      </p>
    </div>
  );
}

/* ── Stepper ── */
function Stepper({ etape, paye }: { etape: number; paye: boolean }) {
  const { t } = useLang();
  const etapes = [t("Montant"), t("Opérateur"), t("Confirmation"), t("Reçu")];
  return (
    <div className="mb-5 flex">
      {etapes.map((label, i) => {
        const n = i + 1;
        const done = paye ? n <= 4 : n < etape;
        const on = !paye && n === etape;
        return (
          <div key={label} className="relative flex-1 text-center">
            {i > 0 && (
              <span
                className="absolute left-[-50%] top-[10px] -z-0 h-[3px] w-full"
                style={{ background: done || on ? "var(--color-success)" : "#e6eaf1" }}
              />
            )}
            <span
              className="relative z-10 mx-auto mb-1.5 grid size-[22px] place-items-center rounded-full border-[3px] border-card text-[11px] font-bold"
              style={
                done
                  ? { background: "var(--color-success)", color: "#fff" }
                  : on
                    ? { background: "var(--color-accent)", color: "#fff", boxShadow: "0 0 0 4px rgba(184,137,31,.18)" }
                    : { background: "#e6eaf1", color: "var(--color-muted-foreground)" }
              }
            >
              {done ? "✓" : n}
            </span>
            <span
              className={`block text-[10px] font-bold uppercase tracking-[0.05em] ${on || done ? "text-navy" : "text-faint"}`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Panneau ── */
function Panel({ icon, titre, children }: { icon: ReactNode; titre: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
      <header className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <span className="text-accent">{icon}</span>
        <h2 className="font-serif text-[16px] font-bold text-navy">{titre}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Un hex clair (ex. jaune MTN) demande un texte foncé pour rester lisible. */
function estClair(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileWarning,
  Info,
  Loader2,
  Search,
  Star,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api, messageErreur } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { Infraction, InfractionCible, TypeInfraction } from "@/lib/types";
import { Layout } from "@/components/Layout";

function fmt(montant: number, devise: string): string {
  return `${montant.toLocaleString("fr-FR")} ${devise}`;
}

export default function NouveauPV() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plaqueUrl = params.get("immatriculation") ?? "";

  const [recherche, setRecherche] = useState(plaqueUrl);
  const [cible, setCible] = useState<InfractionCible | null>(null);
  const [type, setType] = useState<TypeInfraction | null>(null);
  const [lieu, setLieu] = useState("");
  const [observations, setObservations] = useState("");
  const [pv, setPv] = useState<Infraction | null>(null);
  const [chargement, setChargement] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const resoudre = useCallback(
    async (plaque: string) => {
      if (!plaque.trim()) return;
      setChargement(true);
      setErreur(null);
      try {
        const { data } = await api.get<InfractionCible>("/infractions/cible/", {
          params: { immatriculation: plaque.trim() },
        });
        setCible(data);
        setType(data.types[0] ?? null);
      } catch (err) {
        setCible(null);
        setErreur(messageErreur(err, t("Aucun véhicule immatriculé pour cette plaque.")));
      } finally {
        setChargement(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (plaqueUrl) resoudre(plaqueUrl);
  }, [plaqueUrl, resoudre]);

  async function emettre() {
    if (!cible || !type) return;
    setEnCours(true);
    setErreur(null);
    try {
      const { data } = await api.post<Infraction>("/infractions/", {
        immatriculation: cible.immatriculation,
        type: type.code,
        lieu: lieu.trim(),
        observations: observations.trim(),
      });
      setPv(data);
    } catch (err) {
      setErreur(messageErreur(err, t("Émission impossible.")));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Layout>
      <Link
        to="/infractions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("Journal des infractions")}
      </Link>

      <div className="mb-6">
        <div className="eyebrow">{t("Forces de l'ordre")} · SNICV</div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-navy">
          {t("Dresser un procès-verbal")}
        </h1>
        <p className="mt-1 max-w-[62ch] text-[14.5px] text-muted-foreground">
          {t("Rattachez l'infraction au véhicule contrôlé. L'usager est notifié et pourra régler l'amende par mobile money.")}
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.05fr_1fr]">
        {/* ── Formulaire ── */}
        <Panel icon={<FileWarning className="size-[17px]" />} titre={t("Nouveau PV")}>
          {/* Recherche véhicule si pas de plaque en paramètre */}
          {!cible && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                resoudre(recherche);
              }}
              className="space-y-2.5"
            >
              <label className="block text-[12.5px] font-semibold text-muted-foreground">
                {t("Plaque du véhicule contrôlé")}
              </label>
              <div className="flex gap-2">
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value.toUpperCase())}
                  placeholder="AA 1024 BS"
                  className="flex-1 rounded-xl border-[1.5px] border-border px-3 py-2.5 font-mono font-semibold tracking-wide text-navy outline-none focus:border-navy"
                />
                <button
                  type="submit"
                  disabled={chargement || !recherche.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
                >
                  {chargement ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  {t("Rechercher")}
                </button>
              </div>
              {erreur && !cible && (
                <p className="rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">{erreur}</p>
              )}
            </form>
          )}

          {cible && (
            <>
              {/* Véhicule identifié */}
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                {t("Véhicule concerné (vérifié au contrôle)")}
              </div>
              <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-border bg-gradient-to-b from-white to-[#fafbfd] px-3.5 py-3">
                <span className="rounded-lg border-2 border-[#16202e] bg-white px-2.5 py-1.5 font-mono text-[14px] font-extrabold tracking-wide text-[#111]">
                  {cible.immatriculation ?? "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold text-navy">{cible.titulaire}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {cible.marque} {cible.modele} · {cible.annee}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f2ec] px-2.5 py-1 text-[11px] font-bold text-[#166b44]">
                  <CheckCircle2 className="size-3" /> {t("Identifié")}
                </span>
              </div>
              {!pv && (
                <button
                  onClick={() => {
                    setCible(null);
                    setRecherche("");
                  }}
                  className="mt-1.5 text-[12px] font-semibold text-primary"
                >
                  {t("Changer de véhicule")}
                </button>
              )}

              {pv ? (
                <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#f1cfcf] bg-[#fdf3f2] px-4 py-3.5 text-[13px] text-[#9a2f2f]">
                  <CheckCircle2 className="mt-px size-5 shrink-0 text-red-600" />
                  <span>
                    <b className="font-semibold">{t("Procès-verbal émis.")}</b>{" "}
                    {t("L'usager a été notifié ; l'amende est désormais payable par mobile money.")}
                  </span>
                </div>
              ) : (
                <>
                  {/* Type d'infraction (barème) */}
                  <div className="mb-2.5 mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                    {t("Type d'infraction (barème)")}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {cible.types.map((tp) => {
                      const actif = type?.id === tp.id;
                      return (
                        <button
                          key={tp.id}
                          type="button"
                          onClick={() => setType(tp)}
                          className={`flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition ${
                            actif ? "border-[#a3312f] bg-[#fef7f6]" : "border-border"
                          }`}
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-[#fbe7e7] text-[#a3312f]">
                            <AlertTriangle className="size-[18px]" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-bold">{t(tp.libelle)}</span>
                            <span className={`block font-mono text-[12px] ${actif ? "font-bold text-[#a3312f]" : "text-muted-foreground"}`}>
                              {fmt(tp.montant, "XOF")}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">
                        {t("Lieu du contrôle")}
                      </label>
                      <input
                        value={lieu}
                        onChange={(e) => setLieu(e.target.value)}
                        placeholder={t("Ex. Avenida Amílcar Cabral, Bissau")}
                        className="w-full rounded-xl border-[1.5px] border-border px-3 py-2.5 text-[14px] outline-none focus:border-navy"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">
                        {t("Date / heure")}
                      </label>
                      <input
                        readOnly
                        value={t("Maintenant")}
                        className="w-full rounded-xl border-[1.5px] border-border bg-muted/40 px-3 py-2.5 text-[14px] text-muted-foreground outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">
                      {t("Observations (facultatif)")}
                    </label>
                    <textarea
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      rows={2}
                      className="w-full resize-y rounded-xl border-[1.5px] border-border px-3 py-2.5 text-[14px] outline-none focus:border-navy"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl border border-[#a3312f] bg-[#fff6f5] px-4 py-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#a3312f]">
                      {t("Montant de l'amende")}
                    </span>
                    <span className="font-serif text-2xl font-bold text-[#a3312f] tabular-nums">
                      {type ? fmt(type.montant, "XOF") : "—"}
                    </span>
                  </div>

                  {erreur && (
                    <p className="mt-3 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">{erreur}</p>
                  )}

                  <button
                    type="button"
                    onClick={emettre}
                    disabled={enCours || !type}
                    className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#b8433f] to-[#a3312f] py-3.5 text-[15px] font-bold text-white shadow-[0_14px_30px_-18px_rgba(163,49,47,.9)] transition hover:brightness-110 disabled:opacity-50"
                  >
                    {enCours ? <Loader2 className="size-4 animate-spin" /> : <FileWarning className="size-[18px]" />}
                    {t("Émettre le procès-verbal")}
                  </button>
                  <div className="mt-3 flex items-start gap-2.5 text-[12px] text-muted-foreground">
                    <Info className="mt-px size-[15px] shrink-0 text-[#1e5aa8]" />
                    <span>
                      {t("À l'émission : l'usager reçoit une notification, le PV s'ajoute au dossier de vie du véhicule, et devient payable par mobile money.")}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </Panel>

        {/* ── Aperçu du PV ── */}
        <div>{pv ? <ApercuPV pv={pv} onJournal={() => navigate("/infractions")} /> : <ApercuVide />}</div>
      </div>
    </Layout>
  );
}

function ApercuPV({ pv, onJournal }: { pv: Infraction; onJournal: () => void }) {
  const { t } = useLang();
  const qr = `SNICV|PV|${pv.reference}|${pv.immatriculation ?? ""}|${pv.montant} ${pv.devise}`;
  const lignes = [
    { k: t("Infraction"), v: t(pv.libelle) },
    { k: t("PV N°"), v: pv.reference, mono: true },
    { k: t("Véhicule"), v: pv.immatriculation ?? pv.vin, mono: true },
    { k: t("Titulaire"), v: pv.titulaire },
    { k: t("Lieu"), v: pv.lieu || "—" },
    { k: t("Agent"), v: pv.dressee_par_nom ?? "—" },
    { k: t("Date"), v: formatDateTime(pv.date_infraction), mono: true },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-b from-navy to-[#0a1e39] px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full border-2 border-accent text-accent">
            <Star className="size-4 fill-accent" />
          </span>
          <div>
            <div className="font-serif text-[15px] font-bold">{t("Procès-verbal")}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-accent-soft">
              {t("République de Guinée-Bissau")}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-gradient-to-b from-[#f2b6b4] to-[#a3312f] px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-white">
          {t("À RÉGLER")}
        </span>
      </div>
      <div className="grid grid-cols-1 items-center gap-4 p-5 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-faint">{t("Montant dû")}</div>
          <div className="mt-1 font-serif text-[30px] font-bold leading-none text-navy tabular-nums">
            {fmt(pv.montant, pv.devise)}
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
            <QRCodeSVG value={qr} size={104} level="M" />
          </div>
          <div className="max-w-[118px] text-center text-[10px] font-semibold text-muted-foreground">
            {t("Vérifier le PV")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 border-t border-border/60 bg-[#f7f9fc] px-5 py-3">
        <span className="self-stretch w-1 rounded-full bg-[#a3312f]" />
        <p className="text-[11px] text-muted-foreground">
          <b className="text-navy">{t("À régler sous 30 jours.")}</b>{" "}
          {t("Le paiement génère une quittance officielle.")}
        </p>
      </div>
      <div className="p-5 pt-4">
        <button
          onClick={onJournal}
          className="w-full rounded-lg border-[1.5px] border-navy py-2.5 text-[13px] font-semibold text-navy transition hover:bg-navy hover:text-white"
        >
          {t("Voir le journal des infractions")}
        </button>
      </div>
    </div>
  );
}

function ApercuVide() {
  const { t } = useLang();
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#fbe7e7] text-[#a3312f]">
        <FileWarning className="size-7" />
      </span>
      <p className="mt-4 font-serif text-[16px] font-bold text-navy">{t("Aperçu du procès-verbal")}</p>
      <p className="mx-auto mt-1 max-w-[34ch] text-[13px] text-muted-foreground">
        {t("Identifiez le véhicule et choisissez l'infraction : le PV apparaîtra ici avec son QR de vérification.")}
      </p>
    </div>
  );
}

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

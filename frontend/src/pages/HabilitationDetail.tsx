import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, FileText, Loader2, X } from "lucide-react";
import { api, messageErreur, ouvrirJustificatif } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { DemandeHabilitation } from "@/lib/types";
import { Layout } from "@/components/Layout";

export default function HabilitationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const [d, setD] = useState<DemandeHabilitation | null>(null);
  const [chargement, setChargement] = useState(true);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState<null | "valider" | "rejeter" | "justif">(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await api.get<DemandeHabilitation>(`/habilitations/${id}/`);
    setD(r.data);
  }, [id]);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  async function valider() {
    setBusy("valider");
    setErreur(null);
    try {
      await api.post(`/habilitations/${id}/valider/`);
      navigate("/agent/habilitations");
    } catch (err) {
      setErreur(messageErreur(err));
      setBusy(null);
    }
  }

  async function rejeter() {
    if (!motif.trim()) {
      setErreur(t("Indiquez le motif du refus."));
      return;
    }
    setBusy("rejeter");
    setErreur(null);
    try {
      await api.post(`/habilitations/${id}/rejeter/`, { motif: motif.trim() });
      navigate("/agent/habilitations");
    } catch (err) {
      setErreur(messageErreur(err));
      setBusy(null);
    }
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
  if (!d) {
    return (
      <Layout>
        <p className="py-16 text-center text-muted-foreground">{t("Demande introuvable.")}</p>
      </Layout>
    );
  }

  const enAttente = d.statut === "EN_ATTENTE";

  return (
    <Layout>
      <Link
        to="/agent/habilitations"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-navy"
      >
        <ArrowLeft className="size-4" />
        {t("Retour à la file")}
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl font-serif text-[13px] font-extrabold text-white"
          style={{ background: d.corps_couleur || "#0d2748" }}
        >
          {d.corps_sigle}
        </span>
        <div>
          <div className="eyebrow">{t(d.corps_nom)}</div>
          <h1 className="font-serif text-2xl font-bold text-navy">
            {d.prenom} {d.nom}
          </h1>
        </div>
        <span className="ml-auto font-mono text-[13px] font-semibold text-faint tnum">{d.reference}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 border-b border-border pb-3 font-serif text-[16px] font-bold text-navy">
            {t("Identité & affectation")}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[13.5px]">
            <Spec k={t("Corps")} v={t(d.corps_nom)} />
            <Spec k={t("Matricule")} v={d.matricule} mono />
            <Spec k={t("Grade")} v={d.grade || "—"} />
            <Spec k={t("Unité / Brigade")} v={d.unite || "—"} />
            <Spec k={t("Région")} v={d.region || "—"} />
            <Spec k={t("Téléphone")} v={d.telephone} mono />
            <Spec k={t("E-mail")} v={d.email} />
            <Spec k={t("Déposée le")} v={formatDateTime(d.date_creation)} />
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 border-b border-border pb-3 font-serif text-[16px] font-bold text-navy">
            {t("Pièce justificative")}
          </h2>
          {d.a_justificatif ? (
            <button
              onClick={async () => {
                setBusy("justif");
                try {
                  await ouvrirJustificatif(d.id);
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy === "justif"}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left transition hover:bg-muted disabled:opacity-60"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-[#eef3fb] text-[#1e5aa8]">
                {busy === "justif" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              </span>
              <span className="text-[13px]">
                <b className="block text-foreground">{t("Ouvrir la pièce")}</b>
                <span className="text-faint">{t("Carte pro. / ordre de mission")}</span>
              </span>
            </button>
          ) : (
            <p className="text-[13px] text-muted-foreground">{t("Aucune pièce jointe.")}</p>
          )}

          {enAttente ? (
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                onClick={valider}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e8e5a] px-4 py-3 text-[14px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {busy === "valider" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {t("Valider l'habilitation")}
              </button>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder={t("Motif (obligatoire en cas de refus)…")}
                className="min-h-[64px] w-full resize-none rounded-xl border border-border bg-card p-3 text-[13px] outline-none focus:border-navy"
              />
              <button
                onClick={rejeter}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e6cbc8] bg-white px-4 py-3 text-[14px] font-bold text-[#a3312f] transition hover:bg-[#fdf4f3] disabled:opacity-60"
              >
                {busy === "rejeter" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                {t("Rejeter la demande")}
              </button>
              {erreur && <p className="text-[12.5px] text-[#a3312f]">{erreur}</p>}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-muted/50 px-4 py-3 text-[13px]">
              <b className="text-navy">{t(d.statut_libelle)}</b>
              {d.decide_par_nom && (
                <span className="text-muted-foreground">
                  {" "}
                  · {d.decide_par_nom}
                  {d.decide_le ? ` · ${formatDate(d.decide_le)}` : ""}
                </span>
              )}
              {d.motif_decision && <p className="mt-1 text-muted-foreground">{d.motif_decision}</p>}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

function Spec({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-faint">{k}</dt>
      <dd className={`text-right font-semibold text-foreground ${mono ? "font-mono tnum" : ""}`}>{v}</dd>
    </>
  );
}

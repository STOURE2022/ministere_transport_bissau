import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  Files,
  Loader2,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { api, messageErreur, ouvrirDocument, telechargerCertificatPdf } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  DOCUMENTS_REQUIS,
  TYPE_VEHICULE_LABEL,
  type Certificat,
  type DocumentItem,
  type DossierDetail as Dossier,
  type Immatriculation,
  type Verification,
} from "@/lib/types";
import { Layout } from "@/components/Layout";
import { Stepper } from "@/components/Stepper";
import { PlaqueImmatriculation } from "@/components/PlaqueImmatriculation";
import { CertificatPremium } from "@/components/CertificatPremium";
import { SignalerVehiculeCard } from "@/components/SignalerVehiculeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DossierDetail() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [immat, setImmat] = useState<Immatriculation | null>(null);
  const [certificat, setCertificat] = useState<Certificat | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [problemes, setProblemes] = useState<string[]>([]);
  const [soumission, setSoumission] = useState(false);

  const charger = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get<Dossier>(`/dossiers/${id}/`);
    setDossier(data);
    if (data.statut !== "BROUILLON") {
      api
        .get<Verification>(`/dossiers/${id}/verification/`)
        .then((r) => setVerification(r.data))
        .catch(() => setVerification(null));
    }
    if (["IMMATRICULE", "CERTIFIE", "ARCHIVE"].includes(data.statut)) {
      api
        .get<Immatriculation>(`/dossiers/${id}/immatriculation/`)
        .then((r) => setImmat(r.data))
        .catch(() => setImmat(null));
    }
    if (["CERTIFIE", "ARCHIVE"].includes(data.statut)) {
      api
        .get<Certificat>(`/dossiers/${id}/certificat/`)
        .then((r) => setCertificat(r.data))
        .catch(() => setCertificat(null));
    }
  }, [id]);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  async function soumettre() {
    if (!id) return;
    setErreur(null);
    setProblemes([]);
    setSoumission(true);
    try {
      await api.post(`/dossiers/${id}/soumettre/`);
      await charger();
    } catch (err) {
      const data = (err as { response?: { data?: { problemes?: string[] } } }).response?.data;
      if (data?.problemes) setProblemes(data.problemes);
      else setErreur(messageErreur(err));
    } finally {
      setSoumission(false);
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
  if (!dossier) {
    return (
      <Layout>
        <p className="text-muted-foreground">{t("Dossier introuvable.")}</p>
      </Layout>
    );
  }

  const estBrouillon = dossier.statut === "BROUILLON";
  const typesPresents = new Set(dossier.documents.map((d) => d.type_document));
  const docParType = new Map(dossier.documents.map((d) => [d.type_document, d]));
  const manquants = dossier.documents_requis_manquants;
  const titulaire = dossier.usager ? `${dossier.usager.prenom} ${dossier.usager.nom}`.trim() : null;

  const meta = [
    titulaire && { k: t("Titulaire"), v: titulaire },
    immat && { k: t("Immatriculation"), v: immat.numero, mono: true },
    dossier.date_soumission && { k: t("Déposé le"), v: formatDate(dossier.date_soumission), mono: true },
    certificat && { k: t("Valable jusqu'au"), v: formatDate(certificat.date_expiration), mono: true },
  ].filter(Boolean) as { k: string; v: string; mono?: boolean }[];

  return (
    <Layout>
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("Mes dossiers")}
      </Link>

      {/* ── Héro premium ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-navy to-[#0a1e39] px-6 py-6 text-white shadow-[0_30px_60px_-40px_rgba(10,30,57,.85)] sm:px-8 sm:py-7">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-12 select-none text-[240px] leading-none text-white/[0.045]"
        >
          ★
        </span>
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow !text-accent-soft">{t("Processus d'immatriculation")} · SNICV</div>
            <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight tnum">{dossier.numero_dossier}</h1>
            <p className="mt-1 text-[15px] text-[#c3d2e8]">
              {t("Véhicule")} : <b className="font-semibold text-white">{dossier.vehicule.marque} {dossier.vehicule.modele}</b>
              {" · "}{dossier.vehicule.annee}
            </p>
          </div>
          <HeroPill statut={dossier.statut} libelle={dossier.statut_libelle} />
        </div>
        {meta.length > 0 && (
          <div className="relative mt-6 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/10 pt-5">
            {meta.map((m) => (
              <div key={m.k}>
                <div className="text-[10.5px] uppercase tracking-[0.16em] text-[#8fa4c2]">{m.k}</div>
                <div className={`mt-1 text-[15px] font-semibold text-[#eef3fa] ${m.mono ? "tnum font-mono" : ""}`}>
                  {m.v}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Cycle de vie ── */}
      <div className="mt-5">
        <Stepper statut={dossier.statut} />
      </div>

      {/* ── Certificat (pièce maîtresse) ── */}
      {certificat && (
        <div className="mt-5">
          <div className="eyebrow mb-2">{t("Certificat délivré")}</div>
          <CertificatPremium certificat={certificat} />
        </div>
      )}

      {/* ── Rejet ── */}
      {dossier.statut === "REJETE" && dossier.motif_rejet && (
        <div className="mt-5 flex gap-3 rounded-xl border border-[#F1CFCF] bg-[#FBE7E7] p-4">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-[#9a2f2f]">{t("Dossier rejeté")}</p>
            <p className="mt-0.5 text-[13px] text-[#9a2f2f]">{dossier.motif_rejet}</p>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* Colonne principale : pièces */}
        <div className="space-y-5">
          <Panel icon={<Files className="size-[17px]" />} titre={t("Pièces justificatives")}>
            <div className="space-y-2.5">
              {DOCUMENTS_REQUIS.map((doc) => (
                <DocRow
                  key={doc.value}
                  label={t(doc.label)}
                  present={typesPresents.has(doc.value)}
                  document={docParType.get(doc.value)}
                  withDates={doc.withDates}
                  estBrouillon={estBrouillon}
                  dossierId={dossier.id}
                  type={doc.value}
                  onDone={charger}
                />
              ))}
            </div>

            {estBrouillon && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <div className="text-sm text-muted-foreground">
                  {manquants.length === 0 ? (
                    <span className="font-medium text-success">
                      {t("Toutes les pièces obligatoires sont déposées.")}
                    </span>
                  ) : (
                    <>
                      <b className="text-foreground">{manquants.length}</b> {t("pièce(s) obligatoire(s)")}{" "}
                      {t("manquante(s).")}
                    </>
                  )}
                </div>
                <Button onClick={soumettre} disabled={soumission || manquants.length > 0}>
                  {soumission ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {t("Soumettre le dossier")}
                </Button>
              </div>
            )}
            {(problemes.length > 0 || erreur) && (
              <div className="mt-4 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">
                {erreur && <p>{erreur}</p>}
                {problemes.map((p, i) => (
                  <p key={i}>• {p}</p>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          {immat && !certificat && <CarteCertificatUsager immat={immat} certificat={null} />}

          <Panel icon={<Car className="size-[17px]" />} titre={t("Véhicule")}>
            <dl className="grid gap-0">
              <Spec label="VIN" valeur={dossier.vehicule.vin} mono />
              <Spec label={t("Marque / Modèle")} valeur={`${dossier.vehicule.marque} ${dossier.vehicule.modele}`} />
              <Spec label={t("Année")} valeur={String(dossier.vehicule.annee)} mono />
              <Spec
                label={t("Type")}
                valeur={t(TYPE_VEHICULE_LABEL[dossier.vehicule.type_vehicule] ?? dossier.vehicule.type_vehicule)}
              />
              <Spec label={t("Énergie")} valeur={dossier.vehicule.energie} />
            </dl>
          </Panel>

          {immat && (
            <SignalerVehiculeCard
              contexte="usager"
              immatriculation={immat.numero}
              vin={dossier.vehicule.vin}
              onDeclare={charger}
            />
          )}

          {verification && (
            <Panel icon={<FileCheck2 className="size-[17px]" />} titre={t("Vérification automatique")}>
              <div className="space-y-1">
                <VRow ok={verification.vin_valide} label={t("VIN valide")} />
                <VRow ok={verification.assurance_valide} label={t("Assurance valide")} />
                <VRow ok={verification.ct_valide} label={t("Contrôle technique valide")} />
                <VRow ok={!verification.doublon_detecte} label={t("Aucun doublon")} />
              </div>
              <JaugeRisque
                score={verification.score_fraude}
                libelle={t(verification.niveau_risque_libelle)}
              />
            </Panel>
          )}
        </div>
      </div>
    </Layout>
  );
}

/* ── Héro : pastille de statut adaptée au fond navy ── */
function HeroPill({ statut, libelle }: { statut: Dossier["statut"]; libelle: string }) {
  const { t } = useLang();
  const ok = ["VALIDE", "IMMATRICULE", "CERTIFIE"].includes(statut);
  const rejete = statut === "REJETE";
  const tone = rejete
    ? "bg-destructive/20 text-[#ffb4b4] border-[#ffb4b4]/30"
    : ok
      ? "bg-success/20 text-[#7ee0aa] border-[#7ee0aa]/30"
      : "bg-accent/20 text-accent-soft border-accent-soft/30";
  const dot = rejete ? "bg-[#ff6b6b]" : ok ? "bg-[#37c07a]" : "bg-accent-soft";
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-[12.5px] font-bold tracking-wide ${tone}`}
    >
      <span className={`size-2 rounded-full ${dot} shadow-[0_0_0_3px_rgba(255,255,255,.12)]`} />
      {t(libelle)}
    </span>
  );
}

/* ── Panneau premium (en-tête serif + icône dorée) ── */
function Panel({ icon, titre, children }: { icon: ReactNode; titre: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
      <header className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <span className="text-accent">{icon}</span>
        <h2 className="font-serif text-[16.5px] font-bold text-navy">{titre}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ── Ligne de spécification véhicule ── */
function Spec({ label, valeur, mono = false }: { label: string; valeur: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-t border-border/70 py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="text-[13px] text-faint">{label}</dt>
      <dd className={`text-right text-[13px] font-semibold ${mono ? "font-mono tnum" : ""}`}>{valeur}</dd>
    </div>
  );
}

/* ── Ligne de vérification ── */
function VRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-[13.5px]">
      {ok ? (
        <CheckCircle2 className="size-4 text-success" />
      ) : (
        <AlertTriangle className="size-4 text-warning" />
      )}
      <span>{label}</span>
    </div>
  );
}

/* ── Jauge de risque de fraude ── */
function JaugeRisque({ score, libelle }: { score: number; libelle: string }) {
  const { t } = useLang();
  const pct = Math.min(100, Math.max(0, score));
  const couleur = score < 30 ? "text-success" : score < 60 ? "text-warning" : "text-destructive";
  return (
    <div className="mt-3 border-t border-border pt-3.5">
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{t("Niveau de risque de fraude")}</span>
        <span className={`font-bold ${couleur}`}>{libelle}</span>
      </div>
      <div
        className="relative h-2 rounded-full opacity-90"
        style={{ background: "linear-gradient(90deg, #2f9e63 0%, #e6c34d 55%, #d0654f 100%)" }}
      >
        <span
          className="absolute -top-[3px] size-3.5 -translate-x-1/2 rounded-full border-[3px] border-navy bg-white"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Pièce justificative (avec téléversement en brouillon) ── */
function DocRow({
  label,
  present,
  document,
  withDates,
  estBrouillon,
  dossierId,
  type,
  onDone,
}: {
  label: string;
  present: boolean;
  document?: DocumentItem;
  withDates: boolean;
  estBrouillon: boolean;
  dossierId: string;
  type: string;
  onDone: () => Promise<void>;
}) {
  const { t } = useLang();
  const [ouvre, setOuvre] = useState(false);
  const [errVoir, setErrVoir] = useState<string | null>(null);
  const sousTitre =
    present && document
      ? document.date_fin
        ? `${t("Valable jusqu'au")} ${formatDate(document.date_fin)}`
        : document.date_debut
          ? `${t("Émis le")} ${formatDate(document.date_debut)}`
          : null
      : null;

  async function voir() {
    if (!document) return;
    setOuvre(true);
    setErrVoir(null);
    try {
      await ouvrirDocument(document.id);
    } catch {
      setErrVoir(t("Pièce momentanément indisponible."));
    } finally {
      setOuvre(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-3.5">
      <div className="flex items-center gap-3">
        {present ? (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e7f2ec] text-success">
            <CheckCircle2 className="size-[18px]" />
          </span>
        ) : (
          <span className="size-7 shrink-0 rounded-full border-2 border-input" />
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold">{label}</div>
          {sousTitre && <div className="text-[12px] text-faint">{sousTitre}</div>}
        </div>
        {present && document && (
          <button
            type="button"
            onClick={voir}
            disabled={ouvre}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-navy hover:bg-muted disabled:opacity-60"
          >
            {ouvre ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
            {t("Voir")}
          </button>
        )}
        {present && !document && (
          <span className="ml-auto rounded-full bg-[#e7f2ec] px-2.5 py-1 text-[11px] font-bold text-success">
            {t("Déposé")}
          </span>
        )}
      </div>
      {errVoir && <p className="mt-2 text-[12px] text-destructive">{errVoir}</p>}
      {!present && estBrouillon && (
        <UploadRow dossierId={dossierId} type={type} withDates={withDates} onDone={onDone} />
      )}
    </div>
  );
}

function CarteCertificatUsager({
  immat,
  certificat,
}: {
  immat: Immatriculation | null;
  certificat: Certificat | null;
}) {
  const { t } = useLang();
  const [tel, setTel] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const revoque = certificat?.statut === "REVOQUE";

  async function telecharger() {
    if (!certificat) return;
    setTel(true);
    setErreur(null);
    try {
      await telechargerCertificatPdf(certificat.id);
    } catch {
      setErreur(t("PDF momentanément indisponible."));
    } finally {
      setTel(false);
    }
  }

  return (
    <Panel
      icon={<ShieldCheck className={`size-[17px] ${revoque ? "text-destructive" : "text-success"}`} />}
      titre={certificat ? (revoque ? t("Certificat révoqué") : t("Certificat délivré")) : t("Immatriculation")}
    >
      {immat && <PlaqueImmatriculation numero={immat.numero} />}

      {certificat && (
        <>
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/40 p-4">
            <div className={revoque ? "opacity-40 grayscale" : ""}>
              <QRCodeSVG value={certificat.qr_payload} size={150} level="M" />
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              {t("Présentez ce QR lors d'un contrôle")}
            </p>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-faint">{t("Valable jusqu'au")}</dt>
              <dd className="text-right font-medium tnum">{formatDate(certificat.date_expiration)}</dd>
            </div>
          </dl>
          <Button variant="outline" className="mt-4 w-full" onClick={telecharger} disabled={tel}>
            {tel ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t("Télécharger le certificat")}
          </Button>
          {erreur && <p className="mt-2 text-[12.5px] text-destructive">{erreur}</p>}
          {revoque && certificat.motif_revocation && (
            <p className="mt-3 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">
              {certificat.motif_revocation}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function UploadRow({
  dossierId,
  type,
  withDates,
  onDone,
}: {
  dossierId: string;
  type: string;
  withDates: boolean;
  onDone: () => Promise<void>;
}) {
  const { t } = useLang();
  const [fichier, setFichier] = useState<File | null>(null);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    if (!fichier) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const fd = new FormData();
      fd.append("type_document", type);
      fd.append("fichier", fichier);
      if (withDates && dateDebut) fd.append("date_debut", dateDebut);
      if (withDates && dateFin) fd.append("date_fin", dateFin);
      await api.post(`/dossiers/${dossierId}/documents/`, fd);
      await onDone();
    } catch (err) {
      setErreur(messageErreur(err, t("Envoi impossible (format PDF/JPG/PNG, 5 Mo max).")));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <Input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
        className="cursor-pointer"
      />
      {withDates && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${type}-deb`}>{t("Début / émission")}</Label>
            <Input
              id={`${type}-deb`}
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${type}-fin`}>{t("Échéance")}</Label>
            <Input
              id={`${type}-fin`}
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
        </div>
      )}
      {erreur && <p className="text-[12.5px] text-destructive">{erreur}</p>}
      <Button size="sm" onClick={envoyer} disabled={!fichier || envoi}>
        {envoi ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {t("Téléverser")}
      </Button>
    </div>
  );
}

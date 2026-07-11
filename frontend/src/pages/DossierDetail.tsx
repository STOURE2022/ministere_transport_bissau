import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileCheck2,
  Loader2,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { api, messageErreur, telechargerCertificatPdf } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  DOCUMENTS_REQUIS,
  TYPE_VEHICULE_LABEL,
  type Certificat,
  type DossierDetail as Dossier,
  type Immatriculation,
  type Verification,
} from "@/lib/types";
import { Layout } from "@/components/Layout";
import { Stepper } from "@/components/Stepper";
import { StatutBadge } from "@/components/StatutBadge";
import { PlaqueImmatriculation } from "@/components/PlaqueImmatriculation";
import { CertificatPremium } from "@/components/CertificatPremium";
import { SignalerVehiculeCard } from "@/components/SignalerVehiculeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const manquants = dossier.documents_requis_manquants;

  return (
    <Layout>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("Mes dossiers")}
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight tnum">{dossier.numero_dossier}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dossier.vehicule.marque} {dossier.vehicule.modele} · {dossier.vehicule.annee}
          </p>
        </div>
        <StatutBadge statut={dossier.statut} className="px-3 py-1.5 text-[12.5px]" />
      </div>

      <div className="mb-5">
        <Stepper statut={dossier.statut} />
      </div>

      {certificat && (
        <div className="mb-5">
          <div className="eyebrow mb-2">{t("Certificat délivré")}</div>
          <CertificatPremium certificat={certificat} />
        </div>
      )}

      {dossier.statut === "REJETE" && dossier.motif_rejet && (
        <div className="mb-5 flex gap-3 rounded-xl border border-[#F1CFCF] bg-[#FBE7E7] p-4">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-[#9a2f2f]">{t("Dossier rejeté")}</p>
            <p className="mt-0.5 text-[13px] text-[#9a2f2f]">{dossier.motif_rejet}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Documents */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>{t("Pièces justificatives")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="space-y-3">
                {DOCUMENTS_REQUIS.map((doc) => {
                  const present = typesPresents.has(doc.value);
                  return (
                    <div
                      key={doc.value}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-2">
                        {present ? (
                          <CheckCircle2 className="size-5 text-success" />
                        ) : (
                          <span className="size-5 rounded-full border-2 border-input" />
                        )}
                        <span className="text-sm font-medium">{t(doc.label)}</span>
                        {present && (
                          <span className="ml-auto text-[12px] font-medium text-success">
                            {t("Déposé")}
                          </span>
                        )}
                      </div>
                      {!present && estBrouillon && (
                        <UploadRow
                          dossierId={dossier.id}
                          type={doc.value}
                          withDates={doc.withDates}
                          onDone={charger}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {estBrouillon && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
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
                  {soumission ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {t("Soumettre le dossier")}
                </Button>
              </CardContent>
              {(problemes.length > 0 || erreur) && (
                <div className="mx-5 mb-5 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">
                  {erreur && <p>{erreur}</p>}
                  {problemes.map((p, i) => (
                    <p key={i}>• {p}</p>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Panneau latéral : certificat + véhicule + vérification */}
        <div className="space-y-5">
          {immat && !certificat && (
            <CarteCertificatUsager immat={immat} certificat={null} />
          )}

          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>{t("Véhicule")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <dl className="space-y-2.5 text-sm">
                <Ligne label="VIN" valeur={dossier.vehicule.vin} />
                <Ligne label={t("Marque / Modèle")} valeur={`${dossier.vehicule.marque} ${dossier.vehicule.modele}`} />
                <Ligne label={t("Année")} valeur={String(dossier.vehicule.annee)} />
                <Ligne
                  label={t("Type")}
                  valeur={t(TYPE_VEHICULE_LABEL[dossier.vehicule.type_vehicule] ?? dossier.vehicule.type_vehicule)}
                />
                <Ligne label={t("Déposé le")} valeur={formatDate(dossier.date_soumission)} />
              </dl>
            </CardContent>
          </Card>

          {immat && (
            <SignalerVehiculeCard
              contexte="usager"
              immatriculation={immat.numero}
              vin={dossier.vehicule.vin}
              onDeclare={charger}
            />
          )}

          {verification && (
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="size-4 text-primary" />
                  {t("Vérification automatique")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-5 text-sm">
                <Check ok={verification.vin_valide} label={t("VIN valide")} />
                <Check ok={verification.assurance_valide} label={t("Assurance valide")} />
                <Check ok={verification.ct_valide} label={t("Contrôle technique valide")} />
                <Check ok={!verification.doublon_detecte} label={t("Aucun doublon")} />
                <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-muted-foreground">{t("Niveau de risque")}</span>
                  <span className="font-semibold">{t(verification.niveau_risque_libelle)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-faint">{label}</dt>
      <dd className="text-right font-medium">{valeur}</dd>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-success" />
      ) : (
        <AlertTriangle className="size-4 text-warning" />
      )}
      <span>{label}</span>
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
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className={`size-4 ${revoque ? "text-destructive" : "text-success"}`} />
          {certificat ? (revoque ? t("Certificat révoqué") : t("Certificat délivré")) : t("Immatriculation")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
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
                <dd className="text-right font-medium tnum">
                  {formatDate(certificat.date_expiration)}
                </dd>
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
      </CardContent>
    </Card>
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

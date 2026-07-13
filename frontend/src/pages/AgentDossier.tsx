import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Hash,
  Loader2,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Stamp,
  User,
  XCircle,
} from "lucide-react";
import { api, messageErreur, ouvrirDocument, telechargerCertificatPdf } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import {
  DOCUMENTS_REQUIS,
  TYPE_VEHICULE_LABEL,
  type Certificat,
  type DocumentItem,
  type DossierDetail as Dossier,
  type Immatriculation,
  type ValidationDecision,
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

const DOC_LABEL: Record<string, string> = Object.fromEntries(
  DOCUMENTS_REQUIS.map((d) => [d.value, d.label])
);

export default function AgentDossier() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLang();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [historique, setHistorique] = useState<ValidationDecision[]>([]);
  const [immat, setImmat] = useState<Immatriculation | null>(null);
  const [certificat, setCertificat] = useState<Certificat | null>(null);
  const [chargement, setChargement] = useState(true);
  const [busyRevoke, setBusyRevoke] = useState(false);

  const recharger = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get<Dossier>(`/dossiers/${id}/`);
    setDossier(data);

    const taches: Promise<unknown>[] = [];
    if (data.statut !== "BROUILLON") {
      taches.push(
        api
          .get<Verification>(`/dossiers/${id}/verification/`)
          .then((r) => setVerification(r.data))
          .catch(() => setVerification(null))
      );
    }
    taches.push(
      api
        .get(`/dossiers/${id}/historique/`)
        .then((r) => setHistorique(Array.isArray(r.data) ? r.data : r.data.results ?? []))
        .catch(() => setHistorique([]))
    );
    if (["IMMATRICULE", "CERTIFIE", "ARCHIVE"].includes(data.statut)) {
      taches.push(
        api
          .get<Immatriculation>(`/dossiers/${id}/immatriculation/`)
          .then((r) => setImmat(r.data))
          .catch(() => setImmat(null))
      );
    }
    if (["CERTIFIE", "ARCHIVE"].includes(data.statut)) {
      taches.push(
        api
          .get<Certificat>(`/dossiers/${id}/certificat/`)
          .then((r) => setCertificat(r.data))
          .catch(() => setCertificat(null))
      );
    }
    await Promise.all(taches);
  }, [id]);

  useEffect(() => {
    recharger().finally(() => setChargement(false));
  }, [recharger]);

  async function revoquer(motif: string) {
    if (!certificat) return;
    setBusyRevoke(true);
    try {
      await api.post(`/certificats/${certificat.id}/revoquer/`, { motif });
      await recharger();
    } catch {
      /* l'erreur reste silencieuse ici ; le statut ne change pas */
    } finally {
      setBusyRevoke(false);
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

  return (
    <Layout>
      <Link
        to="/agent"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("File de validation")}
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

      {dossier.statut === "REJETE" && dossier.motif_rejet && (
        <div className="mb-5 flex gap-3 rounded-xl border border-[#F1CFCF] bg-[#FBE7E7] p-4">
          <AlertTriangle className="size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-[#9a2f2f]">{t("Dossier rejeté")}</p>
            <p className="mt-0.5 text-[13px] text-[#9a2f2f]">{dossier.motif_rejet}</p>
          </div>
        </div>
      )}

      {certificat && (
        <div className="mb-5">
          <div className="eyebrow mb-2">{t("Certificat délivré")}</div>
          <CertificatPremium
            certificat={certificat}
            revocable={user?.role === "ADMIN" && certificat.statut !== "REVOQUE"}
            onRevoquer={revoquer}
            busyRevoke={busyRevoke}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Colonne principale */}
        <div className="space-y-5">
          {/* Demandeur */}
          {dossier.usager && (
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <User className="size-4 text-primary" />
                  {t("Demandeur")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2.5 pt-5 text-sm sm:grid-cols-2">
                <div className="font-semibold">
                  {dossier.usager.prenom} {dossier.usager.nom}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground sm:justify-end">
                  <Mail className="size-3.5" />
                  {dossier.usager.email}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="size-3.5" />
                  {dossier.usager.telephone}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Véhicule */}
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>{t("Véhicule")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5 pt-5 text-sm sm:grid-cols-2">
              <Ligne label="VIN" valeur={dossier.vehicule.vin} />
              <Ligne
                label={t("Marque / Modèle")}
                valeur={`${dossier.vehicule.marque} ${dossier.vehicule.modele}`}
              />
              <Ligne label={t("Année")} valeur={String(dossier.vehicule.annee)} />
              <Ligne
                label={t("Type")}
                valeur={t(
                  TYPE_VEHICULE_LABEL[dossier.vehicule.type_vehicule] ??
                  dossier.vehicule.type_vehicule
                )}
              />
              <Ligne label={t("Énergie")} valeur={t(dossier.vehicule.energie.charAt(0) + dossier.vehicule.energie.slice(1).toLowerCase())} />
              <Ligne label={t("Couleur")} valeur={dossier.vehicule.couleur || "—"} />
            </CardContent>
          </Card>

          {/* Pièces */}
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                {t("Pièces justificatives")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {dossier.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("Aucune pièce déposée.")}</p>
              ) : (
                <ul className="space-y-2.5">
                  {dossier.documents.map((doc) => (
                    <PieceLigne key={doc.id} doc={doc} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Historique des décisions */}
          {historique.length > 0 && (
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  {t("Historique des décisions")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <ol className="space-y-4">
                  {historique.map((h) => (
                    <li key={h.id} className="flex gap-3">
                      <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold">{t(h.action_libelle)}</span>
                          <span className="text-[11.5px] text-faint tnum">
                            {formatDateTime(h.date_creation)}
                          </span>
                        </div>
                        {h.agent_nom && (
                          <p className="text-[12px] text-muted-foreground">{t("par")} {h.agent_nom}</p>
                        )}
                        {h.commentaire && (
                          <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-[13px]">
                            {h.commentaire}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne latérale : vérif + panneau d'action */}
        <div className="space-y-5">
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
                <div className="mt-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("Score de fraude")}</span>
                    <span className="font-bold tnum">{verification.score_fraude} / 100</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        verification.niveau_risque === "ELEVE"
                          ? "bg-destructive"
                          : verification.niveau_risque === "MOYEN"
                            ? "bg-warning"
                            : "bg-success"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(4, verification.score_fraude))}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("Niveau de risque")}</span>
                  <NiveauRisque niveau={verification.niveau_risque} libelle={verification.niveau_risque_libelle} />
                </div>
              </CardContent>
            </Card>
          )}

          <PanneauAction
            dossier={dossier}
            immat={immat}
            certificat={certificat}
            estAdmin={user?.role === "ADMIN"}
            onDone={recharger}
          />

          {immat && (
            <SignalerVehiculeCard
              contexte="agent"
              immatriculation={immat.numero}
              vin={dossier.vehicule.vin}
              onDeclare={recharger}
            />
          )}
        </div>
      </div>

      <ChaineTraitement statut={dossier.statut} />
    </Layout>
  );
}

/* ─────────────────────────── Suite du traitement ─────────────────────────── */

const CHAINE = [
  { statuts: ["EN_VALIDATION"], titre: "1 · Validation", desc: "Valider, rejeter ou demander un complément." },
  { statuts: ["VALIDE"], titre: "2 · Immatriculation", desc: "Attribuer une plaque officielle." },
  { statuts: ["IMMATRICULE"], titre: "3 · Certificat", desc: "Émettre le certificat signé RSA-2048 + QR." },
] as const;

function ChaineTraitement({ statut }: { statut: string }) {
  const { t } = useLang();
  if (["BROUILLON", "SOUMIS", "VERIF_AUTO", "REJETE"].includes(statut)) return null;
  return (
    <div className="mt-6">
      <div className="eyebrow mb-2">{t("Suite du traitement")}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {CHAINE.map((c) => {
          const actif = (c.statuts as readonly string[]).includes(statut);
          return (
            <div
              key={c.titre}
              className={`rounded-xl border p-4 ${
                actif ? "border-accent bg-card" : "border-dashed border-border bg-muted/30"
              }`}
            >
              <div className="eyebrow" style={{ color: actif ? undefined : "var(--color-faint)" }}>
                {actif ? t("Étape en cours") : t("Étape")}
              </div>
              <div className="mt-1 font-semibold">{t(c.titre)}</div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">{t(c.desc)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Panneau d'action adaptatif ─────────────────────────── */

function PanneauAction({
  dossier,
  immat,
  certificat,
  estAdmin,
  onDone,
}: {
  dossier: Dossier;
  immat: Immatriculation | null;
  certificat: Certificat | null;
  estAdmin: boolean;
  onDone: () => Promise<void>;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [motif, setMotif] = useState("");
  const [mode, setMode] = useState<"valider" | "rejeter" | "complement">("valider");

  async function agir(cle: string, requete: () => Promise<{ data: { message?: string } }>) {
    setBusy(cle);
    setErreur(null);
    setSucces(null);
    try {
      const r = await requete();
      setSucces(r.data?.message ?? t("Action effectuée."));
      setCommentaire("");
      setMotif("");
      await onDone();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setBusy(null);
    }
  }

  const id = dossier.id;

  // ── Étape 4 : validation ──
  if (dossier.statut === "EN_VALIDATION") {
    return (
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>{t("Décision")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                ["valider", "Valider"],
                ["rejeter", "Rejeter"],
                ["complement", "Complément"],
              ] as const
            ).map(([val, lib]) => (
              <button
                key={val}
                onClick={() => setMode(val)}
                className={
                  "rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors " +
                  (mode === val ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
                }
              >
                {t(lib)}
              </button>
            ))}
          </div>

          {mode === "valider" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="c-val">{t("Commentaire (facultatif)")}</Label>
                <textarea
                  id="c-val"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("Observation éventuelle…")}
                />
              </div>
              <Button
                variant="success"
                className="w-full"
                disabled={busy !== null}
                onClick={() =>
                  agir("valider", () =>
                    api.post(`/dossiers/${id}/valider/`, { commentaire })
                  )
                }
              >
                {busy === "valider" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BadgeCheck className="size-4" />
                )}
                {t("Valider le dossier")}
              </Button>
            </div>
          )}

          {mode === "rejeter" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="c-rej">{t("Motif du rejet (obligatoire)")}</Label>
                <textarea
                  id="c-rej"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("Ex. : attestation d'assurance expirée.")}
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                disabled={busy !== null || !motif.trim()}
                onClick={() =>
                  agir("rejeter", () => api.post(`/dossiers/${id}/rejeter/`, { motif }))
                }
              >
                {busy === "rejeter" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <XCircle className="size-4" />
                )}
                {t("Rejeter le dossier")}
              </Button>
            </div>
          )}

          {mode === "complement" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="c-comp">{t("Pièce / information demandée (obligatoire)")}</Label>
                <textarea
                  id="c-comp"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("Ex. : merci de redéposer un contrôle technique lisible.")}
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                {t("Le dossier repassera en brouillon pour que l'usager le complète.")}
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy !== null || !commentaire.trim()}
                onClick={() =>
                  agir("complement", () =>
                    api.post(`/dossiers/${id}/demander-complement/`, { commentaire })
                  )
                }
              >
                {busy === "complement" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mail className="size-4" />
                )}
                {t("Demander un complément")}
              </Button>
            </div>
          )}

          <Retour erreur={erreur} succes={succes} />
        </CardContent>
      </Card>
    );
  }

  // ── Étape 5 : attribution d'immatriculation ──
  if (dossier.statut === "VALIDE") {
    return (
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>{t("Immatriculation")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <p className="mb-4 text-sm text-muted-foreground">
            {t("Le dossier est validé. Attribuez un numéro de plaque officiel pour poursuivre.")}
          </p>
          <Button
            className="w-full"
            disabled={busy !== null}
            onClick={() =>
              agir("immat", () => api.post(`/dossiers/${id}/immatriculer/`, {}))
            }
          >
            {busy === "immat" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Hash className="size-4" />
            )}
            {t("Attribuer une immatriculation")}
          </Button>
          <Retour erreur={erreur} succes={succes} />
        </CardContent>
      </Card>
    );
  }

  // ── Étape 6 : émission du certificat ──
  if (dossier.statut === "IMMATRICULE") {
    return (
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>{t("Certificat QR")}</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          {immat && (
            <div className="mb-4">
              <PlaqueImmatriculation numero={immat.numero} />
              <p className="mt-2 text-center text-[12px] text-muted-foreground tnum">
                {t("Attribuée le")} {formatDate(immat.date_attribution)}
              </p>
            </div>
          )}
          <p className="mb-4 text-sm text-muted-foreground">
            {t("Générez le certificat signé (RSA-2048) et son QR de vérification.")}
          </p>
          <Button
            className="w-full"
            disabled={busy !== null}
            onClick={() =>
              agir("cert", () => api.post(`/dossiers/${id}/certificat/`, {}))
            }
          >
            {busy === "cert" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Stamp className="size-4" />
            )}
            {t("Émettre le certificat")}
          </Button>
          <Retour erreur={erreur} succes={succes} />
        </CardContent>
      </Card>
    );
  }

  // ── Étapes 6/7 : certificat émis (la carte complète est affichée au-dessus) ──
  if (certificat) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[#E4F3EC] text-success">
            <ShieldCheck className="size-6" />
          </span>
          <p className="text-sm font-semibold">{t("Cycle terminé")}</p>
          <p className="text-[13px] text-muted-foreground">
            {t("Le certificat est délivré et vérifiable par QR. Voir le détail ci-dessus.")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Brouillon / soumis / vérif auto : rien à faire côté agent.
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Clock className="size-6 text-faint" />
        <p className="text-sm font-medium">{t("Aucune action requise")}</p>
        <p className="text-[13px] text-muted-foreground">
          {t("Ce dossier n'est pas encore parvenu à une étape nécessitant un agent.")}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── Carte certificat (émis) ─────────────────────────── */

function CarteCertificat({
  certificat,
  immat,
  estAdmin,
  busy,
  onRevoquer,
  erreur,
  succes,
}: {
  certificat: Certificat;
  immat: Immatriculation | null;
  estAdmin: boolean;
  busy: string | null;
  onRevoquer: (motif: string) => void;
  erreur: string | null;
  succes: string | null;
}) {
  const [motif, setMotif] = useState("");
  const [tel, setTel] = useState(false);
  const [erreurPdf, setErreurPdf] = useState<string | null>(null);
  const revoque = certificat.statut === "REVOQUE";

  async function telecharger() {
    setTel(true);
    setErreurPdf(null);
    try {
      await telechargerCertificatPdf(certificat.id);
    } catch {
      setErreurPdf("PDF indisponible (régénérer le certificat si nécessaire).");
    } finally {
      setTel(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2">
          {revoque ? (
            <ShieldAlert className="size-4 text-destructive" />
          ) : (
            <ShieldCheck className="size-4 text-success" />
          )}
          Certificat {revoque ? "révoqué" : "émis"}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {immat && <PlaqueImmatriculation numero={immat.numero} />}

        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <div className={revoque ? "opacity-40 grayscale" : ""}>
            <QRCodeSVG value={certificat.qr_payload} size={168} level="M" />
          </div>
          <p className="text-center text-[11.5px] text-muted-foreground">
            Scan public → vérification temps réel
          </p>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <Ligne label="Statut" valeur={certificat.statut_libelle} />
          <Ligne label="Émis le" valeur={formatDate(certificat.date_emission)} />
          <Ligne label="Expire le" valeur={formatDate(certificat.date_expiration)} />
        </dl>
        <p className="mt-2 break-all font-mono text-[10px] text-faint">
          #{certificat.id}
        </p>

        <Button variant="outline" className="mt-4 w-full" onClick={telecharger} disabled={tel}>
          {tel ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Télécharger le PDF
        </Button>
        {erreurPdf && <p className="mt-2 text-[12.5px] text-destructive">{erreurPdf}</p>}

        {estAdmin && !revoque && (
          <div className="mt-5 border-t border-border pt-4">
            <Label htmlFor="motif-rev">Révocation (admin)</Label>
            <Input
              id="motif-rev"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif de révocation"
              className="mt-1"
            />
            <Button
              variant="destructive"
              className="mt-3 w-full"
              disabled={busy !== null}
              onClick={() => onRevoquer(motif)}
            >
              {busy === "revoquer" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldAlert className="size-4" />
              )}
              Révoquer le certificat
            </Button>
          </div>
        )}

        {revoque && certificat.motif_revocation && (
          <p className="mt-4 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">
            Motif : {certificat.motif_revocation}
          </p>
        )}

        <Retour erreur={erreur} succes={succes} />
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── Petits composants ─────────────────────────── */

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

function NiveauRisque({ niveau, libelle }: { niveau: string; libelle: string }) {
  const { t } = useLang();
  const cls =
    niveau === "ELEVE"
      ? "bg-[#FBE7E7] text-[#9a2f2f]"
      : niveau === "MOYEN"
        ? "bg-[#FBF0DD] text-[#96631a]"
        : "bg-[#E4F3EC] text-[#166b44]";
  return (
    <span className={"rounded-full px-2.5 py-0.5 text-[12px] font-semibold " + cls}>{t(libelle)}</span>
  );
}

function Retour({ erreur, succes }: { erreur: string | null; succes: string | null }) {
  if (!erreur && !succes) return null;
  return (
    <div
      className={
        "mt-4 rounded-lg px-3 py-2 text-[13px] " +
        (erreur ? "bg-[#FBE7E7] text-[#9a2f2f]" : "bg-[#E4F3EC] text-[#166b44]")
      }
    >
      {erreur ?? succes}
    </div>
  );
}

/** Pièce justificative avec consultation du fichier (l'agent l'ouvre pour valider). */
function PieceLigne({ doc }: { doc: DocumentItem }) {
  const { t } = useLang();
  const [ouvre, setOuvre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function voir() {
    setOuvre(true);
    setErreur(null);
    try {
      await ouvrirDocument(doc.id);
    } catch {
      setErreur(t("Pièce momentanément indisponible."));
    } finally {
      setOuvre(false);
    }
  }

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border p-3">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {t(DOC_LABEL[doc.type_document] ?? doc.type_document)}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold uppercase text-faint">
            {doc.format}
          </span>
        </div>
        {(doc.date_debut || doc.date_fin) && (
          <p className="mt-0.5 text-[12px] text-muted-foreground tnum">
            {formatDate(doc.date_debut)} → {formatDate(doc.date_fin)}
          </p>
        )}
        <p className="mt-0.5 truncate font-mono text-[10.5px] text-faint">
          SHA-256 : {doc.hash_fichier}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <Button size="sm" variant="outline" className="h-8" onClick={voir} disabled={ouvre}>
            {ouvre ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
            {t("Voir la pièce")}
          </Button>
          {erreur && <span className="text-[12px] text-destructive">{erreur}</span>}
        </div>
      </div>
    </li>
  );
}

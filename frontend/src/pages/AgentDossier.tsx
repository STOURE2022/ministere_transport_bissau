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
import { api, messageErreur, telechargerCertificatPdf } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  DOCUMENTS_REQUIS,
  TYPE_VEHICULE_LABEL,
  type Certificat,
  type DossierDetail as Dossier,
  type Immatriculation,
  type ValidationDecision,
  type Verification,
} from "@/lib/types";
import { Layout } from "@/components/Layout";
import { Stepper } from "@/components/Stepper";
import { StatutBadge } from "@/components/StatutBadge";
import { PlaqueImmatriculation } from "@/components/PlaqueImmatriculation";
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
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [historique, setHistorique] = useState<ValidationDecision[]>([]);
  const [immat, setImmat] = useState<Immatriculation | null>(null);
  const [certificat, setCertificat] = useState<Certificat | null>(null);
  const [chargement, setChargement] = useState(true);

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
        <p className="text-muted-foreground">Dossier introuvable.</p>
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
        File de validation
      </Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight tnum">{dossier.numero_dossier}</h1>
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
            <p className="font-semibold text-[#9a2f2f]">Dossier rejeté</p>
            <p className="mt-0.5 text-[13px] text-[#9a2f2f]">{dossier.motif_rejet}</p>
          </div>
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
                  Demandeur
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
              <CardTitle>Véhicule</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5 pt-5 text-sm sm:grid-cols-2">
              <Ligne label="VIN" valeur={dossier.vehicule.vin} />
              <Ligne
                label="Marque / Modèle"
                valeur={`${dossier.vehicule.marque} ${dossier.vehicule.modele}`}
              />
              <Ligne label="Année" valeur={String(dossier.vehicule.annee)} />
              <Ligne
                label="Type"
                valeur={
                  TYPE_VEHICULE_LABEL[dossier.vehicule.type_vehicule] ??
                  dossier.vehicule.type_vehicule
                }
              />
              <Ligne label="Énergie" valeur={dossier.vehicule.energie} />
              <Ligne label="Couleur" valeur={dossier.vehicule.couleur || "—"} />
            </CardContent>
          </Card>

          {/* Pièces */}
          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Pièces justificatives
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {dossier.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune pièce déposée.</p>
              ) : (
                <ul className="space-y-2.5">
                  {dossier.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {DOC_LABEL[doc.type_document] ?? doc.type_document}
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
                      </div>
                    </li>
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
                  Historique des décisions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <ol className="space-y-4">
                  {historique.map((h) => (
                    <li key={h.id} className="flex gap-3">
                      <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-semibold">{h.action_libelle}</span>
                          <span className="text-[11.5px] text-faint tnum">
                            {formatDateTime(h.date_creation)}
                          </span>
                        </div>
                        {h.agent_nom && (
                          <p className="text-[12px] text-muted-foreground">par {h.agent_nom}</p>
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
                  Vérification automatique
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-5 text-sm">
                <Check ok={verification.vin_valide} label="VIN valide" />
                <Check ok={verification.assurance_valide} label="Assurance valide" />
                <Check ok={verification.ct_valide} label="Contrôle technique valide" />
                <Check ok={!verification.doublon_detecte} label="Aucun doublon" />
                <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-muted-foreground">Score de fraude</span>
                  <span className="font-bold tnum">{verification.score_fraude}/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Niveau de risque</span>
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
        </div>
      </div>
    </Layout>
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
      setSucces(r.data?.message ?? "Action effectuée.");
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
          <CardTitle>Décision</CardTitle>
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
                {lib}
              </button>
            ))}
          </div>

          {mode === "valider" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="c-val">Commentaire (facultatif)</Label>
                <textarea
                  id="c-val"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Observation éventuelle…"
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
                Valider le dossier
              </Button>
            </div>
          )}

          {mode === "rejeter" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="c-rej">Motif du rejet (obligatoire)</Label>
                <textarea
                  id="c-rej"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Ex. : attestation d'assurance expirée."
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
                Rejeter le dossier
              </Button>
            </div>
          )}

          {mode === "complement" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="c-comp">Pièce / information demandée (obligatoire)</Label>
                <textarea
                  id="c-comp"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Ex. : merci de redéposer un contrôle technique lisible."
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Le dossier repassera en brouillon pour que l'usager le complète.
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
                Demander un complément
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
          <CardTitle>Immatriculation</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <p className="mb-4 text-sm text-muted-foreground">
            Le dossier est validé. Attribuez un numéro de plaque officiel pour poursuivre.
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
            Attribuer une immatriculation
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
          <CardTitle>Certificat QR</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          {immat && (
            <div className="mb-4">
              <PlaqueImmatriculation numero={immat.numero} />
              <p className="mt-2 text-center text-[12px] text-muted-foreground tnum">
                Attribuée le {formatDate(immat.date_attribution)}
              </p>
            </div>
          )}
          <p className="mb-4 text-sm text-muted-foreground">
            Générez le certificat signé (RSA-2048) et son QR de vérification.
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
            Émettre le certificat
          </Button>
          <Retour erreur={erreur} succes={succes} />
        </CardContent>
      </Card>
    );
  }

  // ── Étapes 6/7 : certificat émis ──
  if (certificat) {
    return (
      <CarteCertificat
        certificat={certificat}
        immat={immat}
        estAdmin={estAdmin}
        busy={busy}
        onRevoquer={(m) =>
          agir("revoquer", () =>
            api.post(`/certificats/${certificat.id}/revoquer/`, { motif: m })
          )
        }
        erreur={erreur}
        succes={succes}
      />
    );
  }

  // Brouillon / soumis / vérif auto : rien à faire côté agent.
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <Clock className="size-6 text-faint" />
        <p className="text-sm font-medium">Aucune action requise</p>
        <p className="text-[13px] text-muted-foreground">
          Ce dossier n'est pas encore parvenu à une étape nécessitant un agent.
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
  const cls =
    niveau === "ELEVE"
      ? "bg-[#FBE7E7] text-[#9a2f2f]"
      : niveau === "MOYEN"
        ? "bg-[#FBF0DD] text-[#96631a]"
        : "bg-[#E4F3EC] text-[#166b44]";
  return (
    <span className={"rounded-full px-2.5 py-0.5 text-[12px] font-semibold " + cls}>{libelle}</span>
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

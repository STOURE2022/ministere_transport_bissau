import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Info, Loader2, QrCode, ScanLine, Search, ShieldCheck, WifiOff } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  type Paginated,
  type ResultatScan,
  type ScanLog,
  type VerificationResult,
} from "@/lib/types";
import { Layout } from "@/components/Layout";
import { ResultatVerification } from "@/components/ResultatVerification";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const BADGE: Record<ResultatScan, string> = {
  AUTHENTIQUE: "bg-[#e4f3ec] text-[#166b44]",
  REVOQUE: "bg-[#fbe7e7] text-[#9a2f2f]",
  EXPIRE: "bg-[#fbf0dd] text-[#96631a]",
  FALSIFIE: "bg-[#fbe7e7] text-[#9a2f2f]",
  INTROUVABLE: "bg-muted text-muted-foreground",
};

export default function ControleForceOrdre() {
  const { t } = useLang();
  const [plaque, setPlaque] = useState("");
  const [qr, setQr] = useState("");
  const [res, setRes] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState<"plaque" | "qr" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [historique, setHistorique] = useState<ScanLog[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  const chargerHistorique = useCallback(() => {
    api
      .get<Paginated<ScanLog>>("/scans/", { params: { page_size: 8 } })
      .then((r) => setHistorique(r.data.results.slice(0, 8)))
      .catch(() => setHistorique([]));
  }, []);

  useEffect(() => {
    chargerHistorique();
  }, [chargerHistorique]);

  function apresResultat(data: VerificationResult) {
    setRes(data);
    chargerHistorique();
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  async function verifierPlaque(e: React.FormEvent) {
    e.preventDefault();
    if (!plaque.trim()) return;
    setBusy("plaque");
    setErreur(null);
    try {
      const { data } = await api.get<VerificationResult>("/verify-plaque/", {
        params: { immatriculation: plaque },
      });
      apresResultat(data);
    } catch (err) {
      setErreur(messageErreur(err, t("Vérification impossible.")));
    } finally {
      setBusy(null);
    }
  }

  async function verifierQr(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const uuid = qr.match(RE_UUID)?.[0];
    if (!uuid) {
      setErreur(t("QR non reconnu : collez l'URL complète lue par le lecteur."));
      return;
    }
    let h: string | undefined;
    try {
      h = new URL(qr.trim()).searchParams.get("h") ?? undefined;
    } catch {
      h = qr.match(/[?&]h=([^&\s]+)/)?.[1];
    }
    setBusy("qr");
    try {
      const { data } = await api.get<VerificationResult>(`/verify/${uuid}/`, { params: { h } });
      apresResultat({ ...data, methode: "QR" });
    } catch (err) {
      setErreur(messageErreur(err, t("Vérification impossible.")));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">{t("Forces de l'ordre · Vérification terrain")}</div>
          <h1 className="mt-1.5 font-serif text-2xl font-bold tracking-tight">{t("Contrôle routier")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Scannez le QR du certificat ou saisissez la plaque — même QR abîmé.")}
          </p>
        </div>
        <Link
          to="/verify-offline"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] font-semibold text-primary-deep transition hover:border-primary hover:bg-secondary"
        >
          <WifiOff className="size-4" />
          {t("Mode hors-ligne")}
        </Link>
      </div>

      {/* Deux méthodes */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* QR */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary-deep text-white">
                <QrCode className="size-4" />
              </span>
              {t("Scanner le QR")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <p className="mb-3 text-[13px] text-muted-foreground">
              {t("Méthode recommandée : l'empreinte encodée prouve l'intégrité des données.")}
            </p>
            <form onSubmit={verifierQr} className="space-y-3">
              <textarea
                value={qr}
                onChange={(e) => setQr(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="https://…/verify/xxxxxxxx-…?h=…"
              />
              <Button type="submit" className="w-full bg-primary-deep hover:bg-navy" disabled={busy !== null}>
                {busy === "qr" ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                {t("Vérifier le QR")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Plaque — mise en avant */}
        <Card className="ring-2 ring-accent/40">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-accent text-white">
                <ScanLine className="size-4" />
              </span>
              {t("Rechercher par immatriculation")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <p className="mb-3 text-[13px] text-muted-foreground">
              {t("QR illisible ou absent ? Saisissez la plaque : le certificat actif du véhicule est retrouvé.")}
            </p>
            <form onSubmit={verifierPlaque} className="space-y-3">
              <div className="flex h-16 items-stretch overflow-hidden rounded-lg border-[2.5px] border-[#0f1b2d]">
                <span className="grid w-14 place-items-center bg-primary-deep text-white">
                  <span className="text-[9px] leading-none text-accent-soft">★</span>
                  <b className="text-base leading-tight">GW</b>
                </span>
                <input
                  value={plaque}
                  onChange={(e) => setPlaque(e.target.value.toUpperCase())}
                  spellCheck={false}
                  placeholder="AB 4821 BS"
                  className="flex-1 border-0 text-center text-[26px] font-extrabold uppercase tracking-[0.12em] text-[#0f1b2d] outline-none tnum placeholder:text-[#c4cedd]"
                />
              </div>
              <Label className="text-faint">
                {t("Format : deux lettres · quatre chiffres · suffixe régional (BS = Bissau).")}
              </Label>
              <Button type="submit" className="w-full bg-accent hover:opacity-90" disabled={busy !== null}>
                {busy === "plaque" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                {t("Vérifier la plaque")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {erreur && (
        <p className="mt-4 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">{erreur}</p>
      )}

      {/* Résultat */}
      {res && (
        <div ref={resultRef} className="mt-6">
          <div className="eyebrow mb-2">{t("Résultat de la vérification")}</div>
          <ResultatVerification res={res} />
        </div>
      )}

      {/* Détection automatique des véhicules signalés */}
      <div className="mt-8">
        <Card className="border-l-4 border-l-accent">
          <CardContent className="flex items-start gap-3 py-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary-deep">
              <Info className="size-[18px]" />
            </span>
            <div>
              <p className="text-[14.5px] font-semibold text-foreground">
                {t("Les véhicules volés sont détectés automatiquement")}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {t("Un véhicule déclaré volé ou recherché (par son propriétaire ou par un agent du ministère) déclenche une")}{" "}
                <b>{t("alerte rouge")}</b>{" "}
                {t("dès qu'il est vérifié ici, par QR ou par plaque. Vous n'avez rien à saisir : contrôlez, l'alerte apparaît.")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historique des contrôles */}
      <div className="mt-8">
        <div className="eyebrow mb-2">{t("Historique des contrôles")}</div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-3 font-bold">{t("Immatriculation")}</th>
                  <th className="px-4 py-3 font-bold">{t("Méthode")}</th>
                  <th className="px-4 py-3 font-bold">{t("Résultat")}</th>
                  <th className="px-4 py-3 font-bold">{t("Lieu")}</th>
                  <th className="px-4 py-3 font-bold">{t("Horodatage")}</th>
                </tr>
              </thead>
              <tbody>
                {historique.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      {t("Aucun contrôle enregistré pour le moment.")}
                    </td>
                  </tr>
                ) : (
                  historique.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-semibold">
                        {s.immatriculation ?? <span className="text-faint">{t("— inconnue —")}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{t(s.methode_libelle)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", BADGE[s.resultat])}>
                          {t(s.resultat_libelle)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.localisation || "—"}</td>
                      <td className="px-4 py-3 tnum text-muted-foreground">{formatDateTime(s.date_scan)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12px] text-faint">
        <ShieldCheck className="size-3.5" />
        {t("Le QR reste la méthode de référence : lui seul prouve l'intégrité cryptographique du certificat.")}
      </p>
    </Layout>
  );
}

import { useEffect, useRef, useState } from "react";
import { CloudOff, Loader2, ShieldCheck, WifiOff } from "lucide-react";
import type { CertificatPublic, ResultatScan, VerificationResult } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { ResultatVerification } from "@/components/ResultatVerification";
import { Button } from "@/components/ui/button";
import {
  importerCle,
  obtenirClePem,
  verifierJetonHorsLigne,
  type ResultatHorsLigne,
} from "@/lib/offline";

type EtatCle = "chargement" | "en-ligne" | "cache" | "absente";

const MESSAGES: Record<"AUTHENTIQUE" | "EXPIRE" | "FALSIFIE", string> = {
  AUTHENTIQUE: "Signature valide. Certificat authentique (vérifié hors-ligne).",
  EXPIRE: "Signature valide, mais le certificat a expiré.",
  FALSIFIE: "Signature invalide : ce jeton ne provient pas du SNICV.",
};

function construireResultat(r: ResultatHorsLigne): VerificationResult {
  let resultat: ResultatScan;
  if (!r.valide) resultat = "FALSIFIE";
  else if (r.exp && new Date(r.exp).getTime() < Date.now()) resultat = "EXPIRE";
  else resultat = "AUTHENTIQUE";

  const s = r.snapshot;
  const cert: CertificatPublic | null = r.valide
    ? {
        immatriculation: s.immatriculation ?? null,
        proprietaire: s.proprietaire ?? null,
        marque_modele: [s.marque, s.modele].filter(Boolean).join(" ") || null,
        annee: s.annee ?? null,
        statut: "Vérifié hors-ligne",
        assurance_echeance: s.assurance_echeance ?? null,
        ct_echeance: s.ct_echeance ?? null,
        date_emission: s.date_emission ?? "",
        date_expiration: r.exp ?? "",
      }
    : null;

  return {
    resultat,
    message: MESSAGES[resultat as keyof typeof MESSAGES],
    verifie_le: new Date().toISOString(),
    certificat: cert,
  };
}

export default function VerifyOffline() {
  const { t } = useLang();
  const [etatCle, setEtatCle] = useState<EtatCle>("chargement");
  const cle = useRef<CryptoKey | null>(null);
  const [jeton, setJeton] = useState("");
  const [res, setRes] = useState<VerificationResult | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [verif, setVerif] = useState(false);

  // Provisionne la clé publique : en ligne si possible, sinon depuis le cache.
  useEffect(() => {
    let annule = false;
    const dejaEnCache = !!localStorage.getItem("snicv_cle_publique_pem");
    obtenirClePem().then(async (pem) => {
      if (annule) return;
      if (!pem) {
        setEtatCle("absente");
        return;
      }
      try {
        cle.current = await importerCle(pem);
        setEtatCle(dejaEnCache ? "cache" : "en-ligne");
      } catch {
        setEtatCle("absente");
      }
    });
    return () => {
      annule = true;
    };
  }, []);

  async function verifier() {
    setErreur(null);
    setRes(null);
    if (!cle.current) {
      setErreur(t("Clé publique indisponible. Connectez-vous une fois à Internet pour la provisionner."));
      return;
    }
    if (!jeton.trim()) {
      setErreur(t("Collez le jeton hors-ligne du certificat."));
      return;
    }
    setVerif(true);
    try {
      const r = await verifierJetonHorsLigne(jeton, cle.current);
      setRes(construireResultat(r));
    } catch {
      setErreur(t("Jeton illisible ou malformé. Vérifiez le contenu scanné."));
    } finally {
      setVerif(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-navy px-4 py-8">
      {/* En-tête institutionnel */}
      <div className="mb-6 flex items-center gap-3 text-white">
        <span className="grid size-10 place-items-center rounded-xl border border-white/20 bg-white/10">
          <ShieldCheck className="size-5 text-[#EBCB6A]" />
        </span>
        <div>
          <div className="font-serif text-base font-bold leading-tight tracking-wide">SNICV</div>
          <div className="text-[11px] text-[#B9CBE6]">{t("Vérification hors-ligne · Guinée-Bissau")}</div>
        </div>
      </div>

      <div className="w-full max-w-md space-y-5">
        {/* Console de saisie */}
        <div className="rounded-2xl border border-white/10 bg-card p-6 shadow-[0_20px_50px_rgba(13,39,72,.35)]">
          <div className="mb-1 flex items-center gap-2">
            <WifiOff className="size-5 text-primary" />
            <h1 className="font-serif text-lg font-bold tracking-tight text-primary-deep">
              {t("Contrôle hors réseau")}
            </h1>
          </div>
          <p className="mb-4 text-[13px] text-muted-foreground">
            {t("Validez la signature d'un certificat localement, sans connexion. Collez le jeton hors-ligne encodé dans le QR du certificat.")}
          </p>

          <EtatCleBadge etat={etatCle} />

          <textarea
            value={jeton}
            onChange={(e) => setJeton(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder="eyJ2IjoxLCJjIjoie1wiYW5uZWVcIjoy…"
            className="mt-4 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-[12px] leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />

          {erreur && <p className="mt-2 text-[13px] font-medium text-destructive">{erreur}</p>}

          <Button onClick={verifier} disabled={verif || etatCle === "chargement"} className="mt-4 w-full">
            {verif ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {t("Vérifier hors-ligne")}
          </Button>
        </div>

        {/* Résultat */}
        {res && (
          <div className="space-y-3">
            <ResultatVerification res={res} />
            <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-[#B9CBE6]">
              <CloudOff className="mt-0.5 size-4 shrink-0" />
              <span>
                {t("Mode hors-ligne : l'authenticité de la signature est garantie, mais une éventuelle révocation récente n'est vérifiable qu'en ligne.")}
              </span>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-[#8ea6c9]">
          {t("Ministère des Transports — République de Guinée-Bissau")}
          <br />
          {t("Vérification cryptographique RSA-2048 · SHA-256")}
        </p>
      </div>
    </div>
  );
}

function EtatCleBadge({ etat }: { etat: EtatCle }) {
  const { t } = useLang();
  const map: Record<EtatCle, { texte: string; classe: string }> = {
    chargement: { texte: "Provisionnement de la clé…", classe: "bg-muted text-muted-foreground" },
    "en-ligne": { texte: "Clé publique à jour (en ligne)", classe: "bg-[#e6f4ec] text-[#1e8e5a]" },
    cache: { texte: "Clé publique en cache — prêt hors-ligne", classe: "bg-[#e6f4ec] text-[#1e8e5a]" },
    absente: { texte: "Clé absente — connectez-vous une fois", classe: "bg-[#fbe9e7] text-[#a1201f]" },
  };
  const { texte, classe } = map[etat];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${classe}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {t(texte)}
    </span>
  );
}

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { telechargerCertificatPdf } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Certificat } from "@/lib/types";
import { PlaqueImmatriculation } from "@/components/PlaqueImmatriculation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Lecture typée d'un champ du snapshot du certificat. */
function champ(snap: Record<string, unknown>, cle: string): string {
  const v = snap?.[cle];
  return v == null || v === "" ? "—" : String(v);
}

/**
 * Carte certificat « officielle » à l'écran — reprend le design du PDF
 * (en-tête ministériel, plaque, QR, sceau doré, bandeau de sécurité).
 * Pensée pleine largeur.
 */
export function CertificatPremium({
  certificat,
  className,
  revocable = false,
  onRevoquer,
  busyRevoke = false,
}: {
  certificat: Certificat;
  className?: string;
  revocable?: boolean;
  onRevoquer?: (motif: string) => void;
  busyRevoke?: boolean;
}) {
  const snap = certificat.donnees_snapshot || {};
  const revoque = certificat.statut === "REVOQUE";
  const [tel, setTel] = useState(false);
  const [errPdf, setErrPdf] = useState<string | null>(null);
  const [motif, setMotif] = useState("");

  async function telecharger() {
    setTel(true);
    setErrPdf(null);
    try {
      await telechargerCertificatPdf(certificat.id);
    } catch {
      setErrPdf("PDF momentanément indisponible.");
    } finally {
      setTel(false);
    }
  }

  const marqueModele = `${champ(snap, "marque")} ${champ(snap, "modele")}`.replace(/—/g, "").trim() || "—";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#e8e0cf] bg-gradient-to-b from-[#fdfcf9] to-paper",
        "shadow-[0_2px_6px_rgba(15,27,45,.05),0_24px_60px_rgba(13,39,72,.14)]",
        className
      )}
    >
      {/* En-tête ministériel */}
      <div
        className={cn(
          "flex items-center gap-3.5 px-6 py-5 text-white",
          revoque ? "bg-destructive" : "bg-navy"
        )}
      >
        <span className="grid size-11 place-items-center rounded-xl border border-[#d8b45e]/60 bg-white/10">
          <Star />
        </span>
        <div className="flex-1">
          <div className="font-serif text-lg font-bold leading-tight">Certificat d'immatriculation</div>
          <div className="text-[11px] text-[#b9cbe6]">République de Guinée-Bissau · SNICV</div>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11.5px] font-bold",
            revoque ? "bg-white/15 text-white" : "bg-white/15 text-white"
          )}
        >
          {certificat.statut_libelle}
        </span>
      </div>
      <div className="h-[3px] bg-accent" />

      {/* Corps */}
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto]">
        {/* Colonne données */}
        <div>
          <PlaqueImmatriculation numero={champ(snap, "immatriculation")} className="mx-0 max-w-[260px]" />
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3.5 text-sm">
            <Bloc label="Titulaire" valeur={champ(snap, "proprietaire")} />
            <Bloc label="Véhicule" valeur={marqueModele} />
            <Bloc label="Année · Énergie" valeur={`${champ(snap, "annee")} · ${champ(snap, "energie")}`} />
            <Bloc label="Type" valeur={champ(snap, "type")} />
            <Bloc label="Assurance — échéance" valeur={formatDate((snap.assurance_echeance as string) || null)} />
            <Bloc label="Contrôle technique" valeur={formatDate((snap.ct_echeance as string) || null)} />
            <Bloc label="Émis le" valeur={formatDate(certificat.date_emission)} />
            <Bloc label="Valable jusqu'au" valeur={formatDate(certificat.date_expiration)} />
          </dl>
        </div>

        {/* Colonne QR + sceau */}
        <div className="flex flex-col items-center justify-start gap-3 md:w-52">
          <div className="rounded-xl border border-[#e8e0cf] bg-white p-3">
            <div className={revoque ? "opacity-40 grayscale" : ""}>
              <QRCodeSVG value={certificat.qr_payload} size={150} level="M" fgColor="#12386e" />
            </div>
          </div>
          <div className="text-center">
            <div className="text-[12.5px] font-bold text-primary-deep">Scannez pour vérifier</div>
            <div className="text-[11px] text-muted-foreground">authenticité en temps réel</div>
          </div>
          <Sceau />
        </div>
      </div>

      {/* Bandeau de sécurité */}
      <div className="mx-6 mb-2 rounded-xl border border-[#e8e0cf] border-l-4 border-l-accent bg-white/70 px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-primary-deep">
          Empreinte SHA-256
        </div>
        <div className="break-all font-mono text-[11.5px] text-foreground">{certificat.hash_sha256}</div>
        <div className="mt-1 text-[12px] italic text-muted-foreground">
          Document signé numériquement par le SNICV (RSA-2048). Toute altération invalide la signature.
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[#e8e0cf] bg-paper-deep/50 px-6 py-4">
        <Button variant="outline" onClick={telecharger} disabled={tel}>
          {tel ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Télécharger le PDF officiel
        </Button>
        {errPdf && <span className="text-[12.5px] text-destructive">{errPdf}</span>}

        {revocable && onRevoquer && (
          <div className="ml-auto flex items-end gap-2">
            <div>
              <Label htmlFor="motif-rev" className="text-faint">Révocation (admin)</Label>
              <Input
                id="motif-rev"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Motif"
                className="h-9 w-48"
              />
            </div>
            <Button variant="destructive" className="h-9" disabled={busyRevoke} onClick={() => onRevoquer(motif)}>
              {busyRevoke ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
              Révoquer
            </Button>
          </div>
        )}
      </div>

      {revoque && certificat.motif_revocation && (
        <div className="mx-6 mb-5 flex items-start gap-2 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>Certificat révoqué — {certificat.motif_revocation}</span>
        </div>
      )}
    </div>
  );
}

function Bloc({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-foreground">{valeur}</dd>
    </div>
  );
}

function Star() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.7 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2z"
        fill="#d8b45e"
      />
    </svg>
  );
}

/** Sceau doré « CERTIFIÉ » (léger effet tampon incliné). */
function Sceau() {
  return (
    <div className="relative mt-1 grid size-[92px] -rotate-[8deg] place-items-center rounded-full border-[2.5px] border-accent text-accent">
      <div className="absolute inset-[6px] rounded-full border border-accent" />
      <ShieldCheck className="size-7" />
      <span className="absolute bottom-2.5 text-[8px] font-extrabold tracking-[0.12em]">CERTIFIÉ</span>
    </div>
  );
}

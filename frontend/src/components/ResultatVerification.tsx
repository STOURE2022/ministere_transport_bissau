import {
  CalendarClock,
  HelpCircle,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Siren,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ResultatScan, VerificationResult } from "@/lib/types";
import { PlaqueImmatriculation } from "@/components/PlaqueImmatriculation";

interface ConfigResultat {
  icone: typeof ShieldCheck;
  titre: string;
  bandeau: string;
  fiable: boolean;
}

export const CONFIG_RESULTAT: Record<ResultatScan, ConfigResultat> = {
  AUTHENTIQUE: { icone: ShieldCheck, titre: "Certificat authentique", bandeau: "bg-[#1e8e5a]", fiable: true },
  REVOQUE: { icone: ShieldAlert, titre: "Certificat révoqué", bandeau: "bg-[#c43d3d]", fiable: true },
  EXPIRE: { icone: CalendarClock, titre: "Certificat expiré", bandeau: "bg-[#c6841a]", fiable: true },
  FALSIFIE: { icone: ShieldX, titre: "Certificat falsifié", bandeau: "bg-[#a1201f]", fiable: false },
  INTROUVABLE: { icone: HelpCircle, titre: "Certificat introuvable", bandeau: "bg-[#5a6b82]", fiable: false },
};

/** Carte de résultat d'une vérification (QR ou plaque), réutilisable. */
export function ResultatVerification({ res }: { res: VerificationResult }) {
  const cfg = CONFIG_RESULTAT[res.resultat] ?? CONFIG_RESULTAT.INTROUVABLE;
  const Icone = cfg.icone;
  const cert = res.certificat;
  const parPlaque = res.methode === "PLAQUE";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_50px_rgba(13,39,72,.16)]">
      {/* Alerte véhicule signalé (volé / recherché / opposition) — priorité maximale */}
      {res.alerte && (
        <div className="flex items-center gap-3 bg-[#a1201f] px-6 py-4 text-white">
          <Siren className="size-7 shrink-0 animate-pulse" />
          <div className="min-w-0">
            <div className="font-serif text-lg font-bold tracking-tight">
              ⚠ {res.alerte.type_libelle.toUpperCase()}
            </div>
            <div className="text-[13px] opacity-95">
              {res.alerte.motif || "Ce véhicule fait l'objet d'un signalement actif."}
              {res.alerte.reference ? ` · Réf. ${res.alerte.reference}` : ""}
            </div>
          </div>
        </div>
      )}

      {/* Bandeau de résultat */}
      <div className={`flex items-center gap-4 px-6 py-6 text-white ${cfg.bandeau}`}>
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/15">
          <Icone className="size-8" />
        </span>
        <div>
          <h2 className="font-serif text-xl font-bold tracking-tight">{cfg.titre}</h2>
          <p className="mt-0.5 text-[13.5px] opacity-90">{res.message}</p>
        </div>
      </div>

      {/* Corps */}
      {cert ? (
        <div className="p-6">
          {parPlaque && res.immatriculation && (
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[12px] font-semibold text-primary-deep">
              <ScanLine className="size-3.5" />
              Trouvé via immatriculation · {res.immatriculation}
            </span>
          )}

          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
            {cert.immatriculation && (
              <PlaqueImmatriculation numero={cert.immatriculation} className="max-w-[220px]" />
            )}
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5">
              {cert.proprietaire && <Info label="Titulaire" valeur={cert.proprietaire} />}
              {cert.marque_modele && <Info label="Véhicule" valeur={cert.marque_modele} />}
              {cert.annee != null && <Info label="Année" valeur={String(cert.annee)} />}
              <Info label="Statut" valeur={cert.statut} />
              <Info label="Assurance" valeur={formatDate(cert.assurance_echeance)} />
              <Info label="Contrôle technique" valeur={formatDate(cert.ct_echeance)} />
              <Info label="Émis le" valeur={formatDate(cert.date_emission)} />
              <Info label="Valable jusqu'au" valeur={formatDate(cert.date_expiration)} />
            </dl>
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 text-center text-sm text-muted-foreground">
          {cfg.fiable
            ? "Aucune donnée à afficher."
            : "Aucune donnée véhicule n'est communiquée pour ce résultat."}
        </div>
      )}

      {/* Pied : horodatage */}
      <div className="border-t border-border bg-muted/40 px-6 py-3 text-center text-[11.5px] text-muted-foreground tnum">
        Vérifié le {formatDateTime(res.verifie_le)}
        {parPlaque ? " · méthode : immatriculation" : ""}
      </div>
    </div>
  );
}

function Info({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
      <div className="truncate font-medium">{valeur}</div>
    </div>
  );
}

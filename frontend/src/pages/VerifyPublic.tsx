import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  CalendarClock,
  Car,
  HelpCircle,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ResultatScan, VerificationResult } from "@/lib/types";
import { PlaqueImmatriculation } from "@/components/PlaqueImmatriculation";

interface ConfigResultat {
  icone: typeof ShieldCheck;
  titre: string;
  bandeau: string; // fond du bandeau
  texte: string; // couleur du texte du bandeau
  anneau: string; // halo derrière l'icône
  fiable: boolean;
}

const CONFIG: Record<ResultatScan, ConfigResultat> = {
  AUTHENTIQUE: {
    icone: ShieldCheck,
    titre: "Certificat authentique",
    bandeau: "bg-[#1e8e5a]",
    texte: "text-white",
    anneau: "bg-white/15",
    fiable: true,
  },
  REVOQUE: {
    icone: ShieldAlert,
    titre: "Certificat révoqué",
    bandeau: "bg-[#c43d3d]",
    texte: "text-white",
    anneau: "bg-white/15",
    fiable: true,
  },
  EXPIRE: {
    icone: CalendarClock,
    titre: "Certificat expiré",
    bandeau: "bg-[#c6841a]",
    texte: "text-white",
    anneau: "bg-white/15",
    fiable: true,
  },
  FALSIFIE: {
    icone: ShieldX,
    titre: "Certificat falsifié",
    bandeau: "bg-[#a1201f]",
    texte: "text-white",
    anneau: "bg-white/15",
    fiable: false,
  },
  INTROUVABLE: {
    icone: HelpCircle,
    titre: "Certificat introuvable",
    bandeau: "bg-[#5a6b82]",
    texte: "text-white",
    anneau: "bg-white/15",
    fiable: false,
  },
};

export default function VerifyPublic() {
  const { uuid } = useParams<{ uuid: string }>();
  const [params] = useSearchParams();
  const [res, setRes] = useState<VerificationResult | null>(null);
  const [chargement, setChargement] = useState(true);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    if (!uuid) return;
    const h = params.get("h") ?? undefined;
    const loc = params.get("loc") ?? undefined;
    api
      .get<VerificationResult>(`/verify/${uuid}/`, { params: { h, loc } })
      .then((r) => setRes(r.data))
      .catch(() => setEchec(true))
      .finally(() => setChargement(false));
  }, [uuid, params]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-primary-deep px-4 py-8">
      {/* En-tête institutionnel */}
      <div className="mb-6 flex items-center gap-3 text-white">
        <span className="grid size-10 place-items-center rounded-xl border border-white/20 bg-white/10">
          <ShieldCheck className="size-5 text-[#EBCB6A]" />
        </span>
        <div>
          <div className="text-base font-bold leading-tight tracking-wide">SNICV</div>
          <div className="text-[11px] text-[#B9CBE6]">
            Vérification de certificat · Guinée-Bissau
          </div>
        </div>
      </div>

      <div className="w-full max-w-md">
        {chargement ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-muted-foreground">
            <Loader2 className="size-7 animate-spin" />
            <p className="text-sm">Vérification en cours…</p>
          </div>
        ) : echec || !res ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center">
            <ShieldX className="size-8 text-destructive" />
            <p className="font-semibold">Vérification impossible</p>
            <p className="text-sm text-muted-foreground">
              Le service est momentanément indisponible. Réessayez dans un instant.
            </p>
          </div>
        ) : (
          <Resultat res={res} />
        )}

        <p className="mt-6 text-center text-[11px] text-[#8ea6c9]">
          Ministère des Transports — République de Guinée-Bissau
          <br />
          Système National d'Immatriculation et de Contrôle des Véhicules
        </p>
      </div>
    </div>
  );
}

function Resultat({ res }: { res: VerificationResult }) {
  const cfg = CONFIG[res.resultat] ?? CONFIG.INTROUVABLE;
  const Icone = cfg.icone;
  const cert = res.certificat;

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
      {/* Bandeau de résultat */}
      <div className={`flex flex-col items-center gap-3 px-6 py-8 ${cfg.bandeau} ${cfg.texte}`}>
        <span className={`grid size-16 place-items-center rounded-full ${cfg.anneau}`}>
          <Icone className="size-9" />
        </span>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">{cfg.titre}</h1>
          <p className="mt-1 text-[13px] opacity-90">{res.message}</p>
        </div>
      </div>

      {/* Données véhicule (si fiables) */}
      {cert ? (
        <div className="p-6">
          {cert.immatriculation && (
            <div className="mb-5">
              <PlaqueImmatriculation numero={cert.immatriculation} />
            </div>
          )}

          <dl className="space-y-3 text-sm">
            {cert.proprietaire && (
              <InfoLigne icone={User} label="Titulaire" valeur={cert.proprietaire} />
            )}
            {cert.marque_modele && (
              <InfoLigne icone={Car} label="Véhicule" valeur={cert.marque_modele} />
            )}
            {cert.annee != null && (
              <InfoLigne icone={CalendarClock} label="Année" valeur={String(cert.annee)} />
            )}
          </dl>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
            <Bloc label="Assurance" valeur={formatDate(cert.assurance_echeance)} />
            <Bloc label="Contrôle technique" valeur={formatDate(cert.ct_echeance)} />
            <Bloc label="Émis le" valeur={formatDate(cert.date_emission)} />
            <Bloc label="Expire le" valeur={formatDate(cert.date_expiration)} />
          </div>
        </div>
      ) : (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {cfg.fiable
              ? "Aucune donnée à afficher."
              : "Aucune donnée véhicule n'est communiquée pour ce résultat."}
          </p>
        </div>
      )}

      {/* Pied : horodatage */}
      <div className="border-t border-border bg-muted/40 px-6 py-3 text-center text-[11.5px] text-muted-foreground tnum">
        Vérifié le {formatDateTime(res.verifie_le)}
      </div>
    </div>
  );
}

function InfoLigne({
  icone: Icone,
  label,
  valeur,
}: {
  icone: typeof User;
  label: string;
  valeur: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary-deep">
        <Icone className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div className="truncate font-medium">{valeur}</div>
      </div>
    </div>
  );
}

function Bloc({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-0.5 font-medium tnum">{valeur}</div>
    </div>
  );
}

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatutDossier } from "@/lib/types";

const ETAPES = ["Dépôt", "Vérification", "Validation", "Immatriculation", "Certificat"];

// Associe un statut de dossier à l'index d'étape atteint (0-4).
function statutVersEtape(statut: StatutDossier): number {
  switch (statut) {
    case "BROUILLON":
      return 0;
    case "SOUMIS":
    case "VERIF_AUTO":
      return 1;
    case "EN_VALIDATION":
    case "REJETE":
      return 2;
    case "VALIDE":
    case "IMMATRICULE":
      return 3;
    case "CERTIFIE":
    case "ARCHIVE":
      return 4;
    default:
      return 0;
  }
}

export function Stepper({ statut }: { statut: StatutDossier }) {
  const courant = statutVersEtape(statut);
  const rejete = statut === "REJETE";

  return (
    <div className="flex overflow-x-auto rounded-xl border border-border bg-card p-4 shadow-sm">
      {ETAPES.map((etape, i) => {
        const done = i < courant;
        const active = i === courant;
        return (
          <div key={etape} className="flex flex-1 items-center gap-3 min-w-[130px]">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold",
                  done && "border-success bg-success text-white",
                  active && !rejete && "border-primary bg-primary text-white ring-4 ring-secondary",
                  active && rejete && "border-destructive bg-destructive text-white",
                  !done && !active && "border-input bg-card text-faint"
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[13px] font-medium",
                  done || active ? "text-foreground" : "text-faint"
                )}
              >
                {etape}
              </span>
            </div>
            {i < ETAPES.length - 1 && (
              <div className={cn("mx-2 h-0.5 flex-1 rounded", done ? "bg-success" : "bg-input")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

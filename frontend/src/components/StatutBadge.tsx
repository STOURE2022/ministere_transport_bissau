import { cn } from "@/lib/utils";
import type { StatutDossier } from "@/lib/types";

const CONFIG: Record<StatutDossier, { label: string; className: string }> = {
  BROUILLON: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
  SOUMIS: { label: "Soumis", className: "bg-secondary text-secondary-foreground" },
  VERIF_AUTO: { label: "Vérification auto", className: "bg-secondary text-secondary-foreground" },
  EN_VALIDATION: { label: "En validation", className: "bg-[#FBF0DD] text-[#96631a]" },
  VALIDE: { label: "Validé", className: "bg-[#E4F3EC] text-[#166b44]" },
  REJETE: { label: "Rejeté", className: "bg-[#FBE7E7] text-[#9a2f2f]" },
  IMMATRICULE: { label: "Immatriculé", className: "bg-[#E4F3EC] text-[#166b44]" },
  CERTIFIE: { label: "Certifié", className: "bg-[#E4F3EC] text-[#166b44]" },
  ARCHIVE: { label: "Archivé", className: "bg-muted text-muted-foreground" },
};

export function StatutBadge({ statut, className }: { statut: StatutDossier; className?: string }) {
  const cfg = CONFIG[statut] ?? CONFIG.BROUILLON;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
        cfg.className,
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

import { cn } from "@/lib/utils";

/**
 * Une plaque moto/tricycle se reconnaît à son suffixe dédié « SB »
 * (les plaques standard finissent par « BS »).
 */
function estPlaqueMoto(numero: string): boolean {
  return /\sSB$/i.test((numero || "").trim());
}

/**
 * Plaque minéralogique stylisée (Guinée-Bissau).
 *
 * - Standard (voiture, utilitaire…) : rectangulaire, fond blanc, bande pays
 *   « GW » bleue, numéro sur une ligne (ex. « AA 1234 BS »).
 * - Moto / tricycle : carrée, fond jaune, bandeau « GW · MOTO », numéro sur
 *   deux lignes (ex. « M 1234 » puis « SB »).
 *
 * Le type est déduit du numéro (suffixe) ; on peut le forcer via `estMoto`.
 */
export function PlaqueImmatriculation({
  numero,
  estMoto,
  className,
}: {
  numero: string;
  estMoto?: boolean;
  className?: string;
}) {
  const moto = estMoto ?? estPlaqueMoto(numero);

  if (moto) {
    const parts = (numero || "").trim().split(/\s+/);
    const suffixe = parts.length > 1 ? parts[parts.length - 1] : "";
    const corps = parts.length > 1 ? parts.slice(0, -1).join(" ") : numero;
    return (
      <div
        className={cn(
          "flex h-32 w-32 shrink-0 flex-col overflow-hidden rounded-md border-[3px] border-[#11284a] bg-[#f5c518] shadow-sm",
          className
        )}
      >
        <div className="flex h-7 shrink-0 items-center justify-center gap-1.5 bg-[#11284a] text-white">
          <span className="text-[8px] leading-none text-[#f5c518]">★</span>
          <span className="text-[10px] font-bold leading-none tracking-[0.14em]">
            GW · MOTO
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-[#11284a]">
          <span className="whitespace-nowrap font-mono text-[26px] font-extrabold leading-none tracking-[0.04em] tnum">
            {corps}
          </span>
          <span className="mt-1 font-mono text-[18px] font-extrabold leading-none tracking-[0.22em]">
            {suffixe}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-14 w-fit max-w-full items-stretch overflow-hidden rounded-md border-2 border-[#11284a] bg-white shadow-sm",
        className
      )}
    >
      <div className="flex w-9 shrink-0 flex-col items-center justify-center bg-[#11284a] px-1 text-white">
        <span className="text-[9px] leading-none">★</span>
        <span className="mt-0.5 text-[13px] font-bold leading-none">GW</span>
      </div>
      <div className="flex flex-1 items-center justify-center px-3">
        <span className="whitespace-nowrap font-mono text-[19px] font-bold tracking-[0.1em] text-[#11284a] tnum sm:text-[24px]">
          {numero}
        </span>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

/**
 * Plaque minéralogique stylisée (Guinée-Bissau) : bande latérale bleue avec le
 * code pays « GW », numéro en noir sur fond blanc. La plaque s'ajuste à la
 * longueur du numéro et le garde toujours sur une seule ligne.
 */
export function PlaqueImmatriculation({
  numero,
  className,
}: {
  numero: string;
  className?: string;
}) {
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

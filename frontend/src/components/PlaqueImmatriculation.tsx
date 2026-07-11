import { cn } from "@/lib/utils";

/**
 * Plaque minéralogique stylisée (Guinée-Bissau) : bande latérale bleue
 * avec le code pays « GW », numéro en noir sur fond blanc.
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
        "mx-auto flex h-14 w-full max-w-[280px] items-stretch overflow-hidden rounded-md border-2 border-[#11284a] bg-white shadow-sm",
        className
      )}
    >
      <div className="flex w-9 flex-col items-center justify-center bg-[#11284a] text-white">
        <span className="text-[9px] leading-none">★</span>
        <span className="mt-0.5 text-[13px] font-bold leading-none">GW</span>
      </div>
      <div className="flex flex-1 items-center justify-center px-2">
        <span className="font-mono text-[26px] font-bold tracking-[0.12em] text-[#11284a] tnum">
          {numero}
        </span>
      </div>
    </div>
  );
}

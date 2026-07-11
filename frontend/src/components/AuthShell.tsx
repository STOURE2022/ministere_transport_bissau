import { ShieldCheck } from "lucide-react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-deep px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3 text-white">
          <span className="grid size-11 place-items-center rounded-xl border border-white/20 bg-white/10">
            <ShieldCheck className="size-6 text-[#EBCB6A]" />
          </span>
          <div>
            <div className="text-lg font-bold tracking-wide">SNICV</div>
            <div className="text-[12px] text-[#B9CBE6]">
              Immatriculation des véhicules · Guinée-Bissau
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-card p-7 shadow-[0_8px_40px_rgba(0,0,0,0.25)]">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-[#B9CBE6]">{footer}</div>}
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-3 rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">{message}</p>;
}

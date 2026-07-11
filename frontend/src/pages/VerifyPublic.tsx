import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { VerificationResult } from "@/lib/types";
import { ResultatVerification } from "@/components/ResultatVerification";

export default function VerifyPublic() {
  const { t } = useLang();
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
    <div className="flex min-h-screen flex-col items-center bg-navy px-4 py-8">
      {/* En-tête institutionnel */}
      <div className="mb-6 flex items-center gap-3 text-white">
        <span className="grid size-10 place-items-center rounded-xl border border-white/20 bg-white/10">
          <ShieldCheck className="size-5 text-[#EBCB6A]" />
        </span>
        <div>
          <div className="font-serif text-base font-bold leading-tight tracking-wide">SNICV</div>
          <div className="text-[11px] text-[#B9CBE6]">{t("Vérification de certificat · Guinée-Bissau")}</div>
        </div>
      </div>

      <div className="w-full max-w-md">
        {chargement ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-muted-foreground">
            <Loader2 className="size-7 animate-spin" />
            <p className="text-sm">{t("Vérification en cours…")}</p>
          </div>
        ) : echec || !res ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center">
            <ShieldX className="size-8 text-destructive" />
            <p className="font-semibold">{t("Vérification impossible")}</p>
            <p className="text-sm text-muted-foreground">
              {t("Le service est momentanément indisponible. Réessayez dans un instant.")}
            </p>
          </div>
        ) : (
          <ResultatVerification res={res} />
        )}

        <p className="mt-6 text-center text-[11px] text-[#8ea6c9]">
          {t("Ministère des Transports — République de Guinée-Bissau")}
          <br />
          {t("Système National d'Immatriculation et de Contrôle des Véhicules")}
        </p>
      </div>
    </div>
  );
}

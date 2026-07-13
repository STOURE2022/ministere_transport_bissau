import { Check, Clock, ShieldX } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Layout } from "@/components/Layout";

export default function HabilitationEnAttente() {
  const { user } = useAuth();
  const { t } = useLang();
  const hab = user?.habilitation;
  const rejete = hab?.statut === "REJETE";

  return (
    <Layout>
      <div className="mx-auto max-w-lg py-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
          <div className="flex flex-col items-center px-6 py-9 text-center">
            <span
              className={`grid size-[74px] place-items-center rounded-full border-2 ${
                rejete
                  ? "border-[#e6cbc8] bg-[#fdf4f3] text-[#a3312f]"
                  : "border-accent/50 bg-[#fbefd2] text-accent"
              }`}
            >
              {rejete ? <ShieldX className="size-8" /> : <Clock className="size-8" />}
            </span>
            <h1 className="mt-5 font-serif text-2xl font-bold text-navy">
              {rejete ? t("Demande refusée") : t("Demande transmise")}
            </h1>
            <p className="mt-2 max-w-[42ch] text-[14px] text-muted-foreground">
              {rejete
                ? t("Votre demande d'accès n'a pas été retenue par le service. Voir le motif ci-dessous.")
                : t("Votre inscription est en cours de vérification par un agent SNICV. Vous recevrez une notification dès la décision.")}
            </p>
            {hab?.corps && (
              <div className="mt-3 rounded-full bg-muted px-3.5 py-1.5 text-[12.5px] font-semibold text-navy">
                {t(hab.corps)}
              </div>
            )}

            {!rejete && (
              <div className="mt-7 flex w-full max-w-sm items-start justify-between">
                <Etape etat="ok" label={t("Demande déposée")} />
                <Trait actif />
                <Etape etat="now" label={t("Examen agent")} />
                <Trait />
                <Etape etat="next" label={t("Accès habilité")} num="3" />
              </div>
            )}

            {rejete && hab?.motif_decision && (
              <div className="mt-6 w-full rounded-xl border border-[#e6cbc8] bg-[#fdf4f3] px-4 py-3 text-left text-[13px] text-[#8f2f2c]">
                <b className="mb-0.5 block">{t("Motif du refus")}</b>
                {hab.motif_decision}
              </div>
            )}

            {hab?.reference && (
              <p className="mt-6 text-[12.5px] text-faint">
                {t("Référence de la demande")} :{" "}
                <span className="font-mono font-semibold text-navy tnum">{hab.reference}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Etape({ etat, label, num }: { etat: "ok" | "now" | "next"; label: string; num?: string }) {
  const cls =
    etat === "ok"
      ? "bg-[#1e8e5a] text-white"
      : etat === "now"
      ? "bg-accent text-white ring-4 ring-accent/20"
      : "border-2 border-border bg-card text-faint";
  return (
    <div className="flex w-[92px] flex-col items-center gap-2">
      <span className={`grid size-8 place-items-center rounded-full text-[13px] font-bold ${cls}`}>
        {etat === "ok" ? <Check className="size-4" /> : etat === "now" ? "•" : num}
      </span>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function Trait({ actif }: { actif?: boolean }) {
  return <span className={`mt-4 h-0.5 flex-1 ${actif ? "bg-[#1e8e5a]" : "bg-border"}`} />;
}

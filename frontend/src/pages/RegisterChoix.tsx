import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { AuthShell } from "@/components/AuthShell";

export default function RegisterChoix() {
  const { t } = useLang();
  return (
    <AuthShell
      title={t("Créer un compte")}
      subtitle={t("Quel est votre profil ?")}
      footer={
        <>
          {t("Déjà inscrit ?")}{" "}
          <Link to="/login" className="font-semibold text-white underline underline-offset-4">
            {t("Se connecter")}
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        <ProfilCard
          to="/register/usager"
          icon={<UserRound className="size-5" />}
          tint="bg-[#e8f3ec] text-[#1e8e5a]"
          titre={t("Je suis un usager")}
          desc={t("Je possède un ou plusieurs véhicules et je gère mes démarches d'immatriculation.")}
          meta={t("Accès immédiat")}
          metaClass="text-[#1e8e5a]"
        />
        <ProfilCard
          to="/register/controle"
          icon={<ShieldCheck className="size-5" />}
          tint="bg-navy text-[#EBCB6A]"
          titre={t("Je représente un corps de contrôle")}
          desc={t("J'appartiens à une force de l'ordre habilitée à contrôler les véhicules.")}
          meta={t("Soumis à validation")}
          metaClass="text-accent"
        />
      </div>
    </AuthShell>
  );
}

function ProfilCard({
  to,
  icon,
  tint,
  titre,
  desc,
  meta,
  metaClass,
}: {
  to: string;
  icon: React.ReactNode;
  tint: string;
  titre: string;
  desc: string;
  meta: string;
  metaClass: string;
}) {
  return (
    <Link
      to={to}
      className="group block rounded-2xl border border-border bg-card p-4 transition hover:border-accent hover:shadow-[0_0_0_3px_rgba(184,137,31,.14)]"
    >
      <div className="flex items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tint}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif text-[16px] font-bold text-navy">{titre}</h3>
            <ArrowRight className="size-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
          </div>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{desc}</p>
          <div className={`mt-2 text-[11px] font-bold uppercase tracking-[0.04em] ${metaClass}`}>
            → {meta}
          </div>
        </div>
      </div>
    </Link>
  );
}

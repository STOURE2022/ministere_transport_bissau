import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Home, LogOut, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { accueilPourRole, habilitationEnAttente, ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLang, LangSwitcher } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/** Cloche de notifications (usager) avec pastille de non-lues. */
function NotificationBell() {
  const { t } = useLang();
  const location = useLocation();
  const [nb, setNb] = useState(0);

  useEffect(() => {
    let vivant = true;
    const charger = () =>
      api
        .get<{ non_lues: number }>("/notifications/compteur/")
        .then((r) => vivant && setNb(r.data.non_lues))
        .catch(() => {});
    charger();
    const timer = setInterval(charger, 60_000);
    return () => {
      vivant = false;
      clearInterval(timer);
    };
  }, [location.pathname]);

  return (
    <Link
      to="/notifications"
      title={t("Notifications")}
      className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-[#B9CBE6] transition-colors hover:bg-white/15 hover:text-white"
    >
      <Bell className="size-4" />
      {nb > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full border-2 border-navy bg-[#e5484d] px-1 text-[10px] font-extrabold text-white">
          {nb > 9 ? "9+" : nb}
        </span>
      )}
    </Link>
  );
}

interface NavLink {
  to: string;
  label: string;
}

function liensPourRole(role: string): NavLink[] {
  if (role === "ADMIN") {
    return [
      { to: "/pilotage", label: "Pilotage" },
      { to: "/agent", label: "File de validation" },
      { to: "/agent/habilitations", label: "Habilitations" },
      { to: "/paiements", label: "Paiements" },
      { to: "/infractions", label: "Infractions" },
    ];
  }
  if (role === "AGENT") {
    return [
      { to: "/agent", label: "File de validation" },
      { to: "/agent/habilitations", label: "Habilitations" },
      { to: "/paiements", label: "Paiements" },
      { to: "/infractions", label: "Infractions" },
    ];
  }
  if (role === "FORCE_ORDRE") {
    return [
      { to: "/controle", label: "Contrôle" },
      { to: "/infractions", label: "Infractions" },
    ];
  }
  return [
    { to: "/", label: "Mes dossiers" },
    { to: "/dossiers/nouveau", label: "Nouveau dossier" },
    { to: "/amendes", label: "Mes amendes" },
  ];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const staff = user?.role === "AGENT" || user?.role === "ADMIN";
  const [habEnAttente, setHabEnAttente] = useState(0);

  useEffect(() => {
    if (!staff) return;
    let vivant = true;
    const charger = () =>
      api
        .get<{ en_attente: number }>("/habilitations/stats/")
        .then((r) => vivant && setHabEnAttente(r.data.en_attente))
        .catch(() => {});
    charger();
    const timer = setInterval(charger, 60_000);
    return () => {
      vivant = false;
      clearInterval(timer);
    };
  }, [staff, location.pathname]);

  const initiales = user ? `${user.prenom[0] ?? ""}${user.nom[0] ?? ""}`.toUpperCase() : "";
  const accueil = user ? accueilPourRole(user.role) : "/";
  // Un agent de contrôle non habilité ne voit aucune navigation (écran d'attente seul).
  const liens = user && !habilitationEnAttente(user) ? liensPourRole(user.role) : [];

  // Lien actif : le plus spécifique gagne (évite que /agent et /agent/habilitations
  // soient surlignés simultanément).
  function estActif(to: string) {
    if (to === accueil) return location.pathname === to;
    const match = location.pathname === to || location.pathname.startsWith(to + "/");
    if (!match) return false;
    return !liens.some(
      (o) =>
        o.to !== to &&
        o.to.length > to.length &&
        o.to.startsWith(to) &&
        (location.pathname === o.to || location.pathname.startsWith(o.to + "/")),
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex h-15 items-center gap-2 bg-navy px-3 text-white shadow-sm sm:gap-4 sm:px-5">
        <Link to={accueil} className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/10">
            <ShieldCheck className="size-5 text-[#EBCB6A]" />
          </span>
          <span className="min-w-0 font-serif font-bold tracking-wide leading-tight">
            SNICV
            <span className="block truncate text-[11px] font-normal text-[#B9CBE6] max-[420px]:hidden">
              {t("Ministère des Transports · Guinée-Bissau")}
            </span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {liens.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                estActif(l.to) ? "bg-white/15 text-white" : "text-[#B9CBE6] hover:bg-white/10 hover:text-white"
              )}
            >
              {t(l.label)}
              {l.to === "/agent/habilitations" && habEnAttente > 0 && (
                <span className="ml-1.5 inline-grid min-w-4 place-items-center rounded-full bg-[#e5484d] px-1 text-[10px] font-extrabold text-white">
                  {habEnAttente > 9 ? "9+" : habEnAttente}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />
        {user?.role === "USAGER" && <NotificationBell />}
        <LangSwitcher className="text-white" />
        <Link
          to="/accueil"
          title={t("Page d'accueil")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-[13px] font-medium text-[#B9CBE6] transition-colors hover:bg-white/15 hover:text-white"
        >
          <Home className="size-4" />
          <span className="max-sm:hidden">{t("Accueil")}</span>
        </Link>
        {user && (
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="text-right text-[13px] leading-tight max-md:hidden">
              <b className="font-semibold">
                {user.prenom} {user.nom}
              </b>
              <span className="block text-[11px] text-[#B9CBE6]">{t(ROLE_LABEL[user.role])}</span>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-[#3a2c07]">
              {initiales}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="shrink-0 text-white hover:bg-white/10"
              title={t("Se déconnecter")}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </header>

      {/* Navigation par rôle sur mobile (les liens du header sont masqués < md) */}
      {liens.length > 0 && (
        <nav className="sticky top-15 z-10 flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {liens.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "relative shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                estActif(l.to) ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t(l.label)}
              {l.to === "/agent/habilitations" && habEnAttente > 0 && (
                <span className="ml-1.5 inline-grid min-w-4 place-items-center rounded-full bg-[#e5484d] px-1 text-[10px] font-extrabold text-white">
                  {habEnAttente > 9 ? "9+" : habEnAttente}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

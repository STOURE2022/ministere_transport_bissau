import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Home, LogOut, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { accueilPourRole, ROLE_LABEL } from "@/lib/types";
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
    ];
  }
  if (role === "AGENT") {
    return [{ to: "/agent", label: "File de validation" }];
  }
  if (role === "FORCE_ORDRE") {
    return [{ to: "/controle", label: "Contrôle" }];
  }
  return [
    { to: "/", label: "Mes dossiers" },
    { to: "/dossiers/nouveau", label: "Nouveau dossier" },
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

  const initiales = user ? `${user.prenom[0] ?? ""}${user.nom[0] ?? ""}`.toUpperCase() : "";
  const accueil = user ? accueilPourRole(user.role) : "/";
  const liens = user ? liensPourRole(user.role) : [];

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
          {liens.map((l) => {
            const actif =
              l.to === accueil ? location.pathname === l.to : location.pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                  actif ? "bg-white/15 text-white" : "text-[#B9CBE6] hover:bg-white/10 hover:text-white"
                )}
              >
                {t(l.label)}
              </Link>
            );
          })}
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
          {liens.map((l) => {
            const actif =
              l.to === accueil ? location.pathname === l.to : location.pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                  actif ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t(l.label)}
              </Link>
            );
          })}
        </nav>
      )}

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

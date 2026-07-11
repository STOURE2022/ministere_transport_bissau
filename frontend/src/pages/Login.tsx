import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { messageErreur } from "@/lib/api";
import { accueilPourRole } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { AuthShell, FieldError } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { message?: string } };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      const u = await login(email, password);
      navigate(accueilPourRole(u.role));
    } catch (err) {
      setErreur(messageErreur(err, t("E-mail ou mot de passe incorrect.")));
    } finally {
      setChargement(false);
    }
  }

  return (
    <AuthShell
      title={t("Connexion")}
      subtitle={t("Accédez à votre espace de suivi de dossier.")}
      footer={
        <>
          {t("Pas encore de compte ?")}{" "}
          <Link to="/register" className="font-semibold text-white underline underline-offset-4">
            {t("Créer un compte")}
          </Link>
        </>
      }
    >
      {location.state?.message && (
        <p className="mb-4 rounded-lg bg-[#E4F3EC] px-3 py-2 text-[13px] text-[#166b44]">
          {location.state.message}
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">{t("Adresse e-mail")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.gw"
          />
        </div>
        <div>
          <Label htmlFor="password">{t("Mot de passe")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <FieldError message={erreur} />
        <Button type="submit" className="w-full" disabled={chargement}>
          {chargement && <Loader2 className="size-4 animate-spin" />}
          {t("Se connecter")}
        </Button>
      </form>
    </AuthShell>
  );
}

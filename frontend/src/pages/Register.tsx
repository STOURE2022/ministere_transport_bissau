import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { AuthShell, FieldError } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Register() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    password: "",
    password2: "",
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  function set(champ: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [champ]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      await api.post("/auth/register/", form);
      navigate(`/verify-otp?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setErreur(messageErreur(err, t("Inscription impossible. Vérifiez vos informations.")));
    } finally {
      setChargement(false);
    }
  }

  return (
    <AuthShell
      title={t("Créer un compte")}
      subtitle={t("Un code de vérification vous sera envoyé par SMS.")}
      footer={
        <>
          {t("Déjà inscrit ?")}{" "}
          <Link to="/login" className="font-semibold text-white underline underline-offset-4">
            {t("Se connecter")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="prenom">{t("Prénom")}</Label>
            <Input id="prenom" required value={form.prenom} onChange={set("prenom")} />
          </div>
          <div>
            <Label htmlFor="nom">{t("Nom")}</Label>
            <Input id="nom" required value={form.nom} onChange={set("nom")} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">{t("Adresse e-mail")}</Label>
          <Input id="email" type="email" required value={form.email} onChange={set("email")} />
        </div>
        <div>
          <Label htmlFor="telephone">{t("Téléphone")}</Label>
          <Input
            id="telephone"
            required
            value={form.telephone}
            onChange={set("telephone")}
            placeholder="+245955123456"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="password">{t("Mot de passe")}</Label>
            <Input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={set("password")}
            />
          </div>
          <div>
            <Label htmlFor="password2">{t("Confirmation")}</Label>
            <Input
              id="password2"
              type="password"
              required
              value={form.password2}
              onChange={set("password2")}
            />
          </div>
        </div>
        <FieldError message={erreur} />
        <Button type="submit" className="w-full" disabled={chargement}>
          {chargement && <Loader2 className="size-4 animate-spin" />}
          {t("Créer mon compte")}
        </Button>
      </form>
    </AuthShell>
  );
}

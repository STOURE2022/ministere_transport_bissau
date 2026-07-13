import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Upload } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { CorpsControle } from "@/lib/types";
import { AuthShell, FieldError } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterControle() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [corps, setCorps] = useState<CorpsControle[]>([]);
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    password: "",
    password2: "",
    corps: "",
    matricule: "",
    grade: "",
    unite: "",
    region: "",
  });
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    api
      .get<CorpsControle[]>("/corps/")
      .then((r) => {
        setCorps(r.data);
        if (r.data[0]) setForm((f) => ({ ...f, corps: r.data[0].code }));
      })
      .catch(() => {});
  }, []);

  function set(champ: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [champ]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!fichier) {
      setErreur(t("Joignez votre pièce justificative (carte professionnelle ou ordre de mission)."));
      return;
    }
    setChargement(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("justificatif", fichier);
      await api.post("/inscription-controle/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/verify-otp?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setErreur(messageErreur(err, t("Inscription impossible. Vérifiez vos informations.")));
    } finally {
      setChargement(false);
    }
  }

  return (
    <AuthShell
      title={t("Inscription — corps de contrôle")}
      subtitle={t("Votre accès sera activé après validation par un agent SNICV.")}
      footer={
        <>
          {t("Vous êtes un usager ?")}{" "}
          <Link to="/register/usager" className="font-semibold text-white underline underline-offset-4">
            {t("Inscription usager")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>{t("Corps d'appartenance")}</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {corps.map((c) => {
              const on = form.corps === c.code;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setForm((f) => ({ ...f, corps: c.code }))}
                  className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                    on ? "border-navy bg-navy/5 shadow-[0_0_0_2px_rgba(13,39,72,.12)]" : "border-border hover:bg-muted"
                  }`}
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg font-serif text-[11px] font-extrabold text-white"
                    style={{ background: c.couleur }}
                  >
                    {c.sigle}
                  </span>
                  <span className="min-w-0 text-[12px] font-semibold leading-tight text-foreground">
                    {c.nom_court || c.nom}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="matricule">{t("Matricule / N° de service")}</Label>
            <Input id="matricule" required value={form.matricule} onChange={set("matricule")} />
          </div>
          <div>
            <Label htmlFor="grade">{t("Grade")}</Label>
            <Input id="grade" value={form.grade} onChange={set("grade")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="unite">{t("Unité / Brigade")}</Label>
            <Input id="unite" value={form.unite} onChange={set("unite")} />
          </div>
          <div>
            <Label htmlFor="region">{t("Région")}</Label>
            <Input id="region" value={form.region} onChange={set("region")} />
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
            <Input id="password" type="password" required value={form.password} onChange={set("password")} />
          </div>
          <div>
            <Label htmlFor="password2">{t("Confirmation")}</Label>
            <Input id="password2" type="password" required value={form.password2} onChange={set("password2")} />
          </div>
        </div>

        <div>
          <Label>{t("Pièce justificative")}</Label>
          <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-3 transition hover:border-navy">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eef3fb] text-[#1e5aa8]">
              <Upload className="size-4" />
            </span>
            <span className="min-w-0 text-[12.5px]">
              <b className="block truncate text-foreground">
                {fichier ? fichier.name : t("Carte professionnelle ou ordre de mission")}
              </b>
              <span className="text-faint">{t("PDF ou image — max 5 Mo")}</span>
            </span>
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <FieldError message={erreur} />
        <Button type="submit" className="w-full" disabled={chargement}>
          {chargement && <Loader2 className="size-4 animate-spin" />}
          {t("Soumettre pour validation")}
        </Button>
      </form>
    </AuthShell>
  );
}

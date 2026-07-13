import { useEffect, useState } from "react";
import { Check, Clock, Loader2, RotateCcw, ShieldX, Upload } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { CorpsControle } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function HabilitationEnAttente() {
  const { user } = useAuth();
  const { t } = useLang();
  const hab = user?.habilitation;
  const rejete = hab?.statut === "REJETE";
  const [refaire, setRefaire] = useState(false);

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

            {rejete && !refaire && (
              <Button className="mt-6 w-full max-w-xs" onClick={() => setRefaire(true)}>
                <RotateCcw className="size-4" />
                {t("Refaire ma demande")}
              </Button>
            )}
          </div>

          {rejete && refaire && <ReSoumettreForm onAnnuler={() => setRefaire(false)} />}
        </div>
      </div>
    </Layout>
  );
}

function ReSoumettreForm({ onAnnuler }: { onAnnuler: () => void }) {
  const { t } = useLang();
  const { reloadUser } = useAuth();
  const [corps, setCorps] = useState<CorpsControle[]>([]);
  const [form, setForm] = useState({ corps: "", matricule: "", grade: "", unite: "", region: "" });
  const [fichier, setFichier] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

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

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!fichier) {
      setErreur(t("Joignez votre pièce justificative (carte professionnelle ou ordre de mission)."));
      return;
    }
    setEnvoi(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("justificatif", fichier);
      await api.post("/habilitations/resoumettre/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await reloadUser(); // repasse l'écran en « en attente »
    } catch (err) {
      setErreur(messageErreur(err, t("Envoi impossible. Vérifiez vos informations.")));
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4 border-t border-border bg-muted/20 px-6 py-6">
      <h2 className="font-serif text-[15px] font-bold text-navy">{t("Nouvelle demande")}</h2>
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
                  on ? "border-navy bg-navy/5 shadow-[0_0_0_2px_rgba(13,39,72,.12)]" : "border-border bg-card hover:bg-muted"
                }`}
              >
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg font-serif text-[11px] font-extrabold text-white"
                  style={{ background: c.couleur }}
                >
                  {c.sigle}
                </span>
                <span className="min-w-0 text-[12px] font-semibold leading-tight text-foreground">
                  {t(c.nom_court || c.nom)}
                </span>
              </button>
            );
          })}
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
        <Label>{t("Pièce justificative")}</Label>
        <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-card p-3 transition hover:border-navy">
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

      {erreur && <p className="rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">{erreur}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onAnnuler} disabled={envoi}>
          {t("Annuler")}
        </Button>
        <Button type="submit" className="flex-1" disabled={envoi}>
          {envoi ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {t("Soumettre à nouveau")}
        </Button>
      </div>
    </form>
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

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { CorpsControle } from "@/lib/types";
import { Layout } from "@/components/Layout";

export default function HabilitationsCorps() {
  const { t } = useLang();
  const [corps, setCorps] = useState<CorpsControle[]>([]);
  const [chargement, setChargement] = useState(true);
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState({ nom: "", nom_court: "", code: "", sigle: "", couleur: "#0d2748" });
  const [enreg, setEnreg] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function charger() {
    const { data } = await api.get<CorpsControle[]>("/habilitations/corps/");
    setCorps(data);
  }

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, []);

  async function creer() {
    if (!form.nom.trim() || !form.code.trim() || !form.sigle.trim()) return;
    setEnreg(true);
    setErreur(null);
    try {
      await api.post("/habilitations/corps/", {
        nom: form.nom.trim(),
        nom_court: form.nom_court.trim() || form.nom.trim(),
        code: form.code.trim().toUpperCase().replace(/\s+/g, "_"),
        sigle: form.sigle.trim().toUpperCase(),
        couleur: form.couleur,
        ordre: corps.length + 1,
      });
      setForm({ nom: "", nom_court: "", code: "", sigle: "", couleur: "#0d2748" });
      setAjout(false);
      await charger();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnreg(false);
    }
  }

  async function basculerActif(c: CorpsControle) {
    await api.patch(`/habilitations/corps/${c.id}/`, { actif: !c.actif });
    await charger();
  }
  async function majCouleur(c: CorpsControle, couleur: string) {
    await api.patch(`/habilitations/corps/${c.id}/`, { couleur });
    await charger();
  }
  async function supprimer(c: CorpsControle) {
    await api.delete(`/habilitations/corps/${c.id}/`);
    await charger();
  }

  return (
    <Layout>
      <Link
        to="/agent/habilitations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("Habilitations")}
      </Link>

      <div className="mb-6">
        <div className="eyebrow">{t("Administration")} · SNICV</div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-navy">{t("Corps de contrôle")}</h1>
        <p className="mt-1 max-w-[62ch] text-[14.5px] text-muted-foreground">
          {t("Définissez les corps proposés à l'inscription — rien n'est codé en dur, tout se règle ici.")}
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
        <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-[17px] text-accent" />
            <h2 className="font-serif text-[16px] font-bold text-navy">{t("Corps habilités")}</h2>
          </div>
          <button onClick={() => setAjout((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary">
            <Plus className="size-3.5" /> {t("Ajouter")}
          </button>
        </header>

        <div className="p-5">
          {ajout && (
            <div className="mb-4 grid gap-2.5 rounded-xl border border-dashed border-border p-3.5 sm:grid-cols-[1.4fr_1fr_.7fr_auto_auto]">
              <input
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                placeholder={t("Nom (ex. Police maritime)")}
                className="rounded-lg border-[1.5px] border-border px-3 py-2 text-[13px] outline-none focus:border-navy"
              />
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder={t("Code (ex. MARITIME)")}
                className="rounded-lg border-[1.5px] border-border px-3 py-2 font-mono text-[13px] outline-none focus:border-navy"
              />
              <input
                value={form.sigle}
                onChange={(e) => setForm((f) => ({ ...f, sigle: e.target.value.toUpperCase().slice(0, 4) }))}
                placeholder={t("Sigle")}
                className="rounded-lg border-[1.5px] border-border px-3 py-2 text-center font-mono text-[13px] outline-none focus:border-navy"
              />
              <input
                type="color"
                value={form.couleur}
                onChange={(e) => setForm((f) => ({ ...f, couleur: e.target.value }))}
                className="h-full w-12 cursor-pointer rounded-lg border-[1.5px] border-border"
                title={t("Couleur")}
              />
              <button
                onClick={creer}
                disabled={enreg || !form.nom.trim() || !form.code.trim() || !form.sigle.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {enreg ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {t("Créer")}
              </button>
              {erreur && <p className="text-[12.5px] text-destructive sm:col-span-5">{erreur}</p>}
            </div>
          )}

          {chargement ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : corps.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">{t("Aucun corps configuré.")}</p>
          ) : (
            <div className="space-y-2.5">
              {corps.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-[10px] font-serif text-[12px] font-extrabold text-white"
                    style={{ background: c.couleur }}
                  >
                    {c.sigle}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold text-navy">{t(c.nom)}</div>
                    <div className="font-mono text-[11.5px] text-faint">
                      {c.code} · {c.nb_membres ?? 0} {t("membre(s)")}
                    </div>
                  </div>
                  <input
                    type="color"
                    defaultValue={c.couleur}
                    onBlur={(e) => e.target.value !== c.couleur && majCouleur(c, e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded-lg border-[1.5px] border-border"
                    title={t("Couleur")}
                  />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.actif}
                    onClick={() => basculerActif(c)}
                    title={c.actif ? t("Actif") : t("Inactif")}
                    className={`relative h-6 w-[42px] shrink-0 rounded-full transition ${c.actif ? "bg-success" : "bg-[#cdd5df]"}`}
                  >
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${c.actif ? "left-5" : "left-0.5"}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => supprimer(c)}
                    title={t("Supprimer")}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-[#fbe7e7] hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-faint">
            {t("Seuls les corps actifs sont proposés lors de l'inscription. Un corps rattaché à des membres ne peut être supprimé.")}
          </p>
        </div>
      </section>
    </Layout>
  );
}

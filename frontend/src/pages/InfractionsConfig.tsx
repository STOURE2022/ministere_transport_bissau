import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Loader2, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { TypeInfraction } from "@/lib/types";
import { Layout } from "@/components/Layout";

export default function InfractionsConfig() {
  const { t } = useLang();
  const [types, setTypes] = useState<TypeInfraction[]>([]);
  const [chargement, setChargement] = useState(true);
  const [ajout, setAjout] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [code, setCode] = useState("");
  const [montant, setMontant] = useState(0);
  const [enreg, setEnreg] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function charger() {
    const { data } = await api.get<{ results: TypeInfraction[] }>("/infractions/types/");
    setTypes(data.results);
  }

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, []);

  async function creer() {
    if (!libelle.trim() || !code.trim() || montant <= 0) return;
    setEnreg(true);
    setErreur(null);
    try {
      await api.post("/infractions/types/", {
        libelle: libelle.trim(),
        code: code.trim().toUpperCase().replace(/\s+/g, "_"),
        montant,
        ordre: types.length + 1,
      });
      setLibelle("");
      setCode("");
      setMontant(0);
      setAjout(false);
      await charger();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnreg(false);
    }
  }

  async function basculerActif(tp: TypeInfraction) {
    await api.patch(`/infractions/types/${tp.id}/`, { actif: !tp.actif });
    await charger();
  }
  async function majMontant(tp: TypeInfraction, valeur: number) {
    await api.patch(`/infractions/types/${tp.id}/`, { montant: valeur });
    await charger();
  }
  async function supprimer(tp: TypeInfraction) {
    await api.delete(`/infractions/types/${tp.id}/`);
    await charger();
  }

  return (
    <Layout>
      <Link
        to="/infractions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("Journal des infractions")}
      </Link>

      <div className="mb-6">
        <div className="eyebrow">{t("Administration")} · SNICV</div>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-navy">{t("Barème des infractions")}</h1>
        <p className="mt-1 max-w-[62ch] text-[14.5px] text-muted-foreground">
          {t("Définissez les types d'infraction et leurs montants — rien n'est codé en dur, tout se règle ici.")}
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_0_rgba(13,39,72,.03),0_22px_46px_-34px_rgba(13,39,72,.5)]">
        <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="size-[17px] text-accent" />
            <h2 className="font-serif text-[16px] font-bold text-navy">{t("Types & montants")}</h2>
          </div>
          <button onClick={() => setAjout((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary">
            <Plus className="size-3.5" /> {t("Ajouter")}
          </button>
        </header>

        <div className="p-5">
          {ajout && (
            <div className="mb-4 grid gap-2.5 rounded-xl border border-dashed border-border p-3.5 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
              <input
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder={t("Libellé (ex. Feu rouge)")}
                className="rounded-lg border-[1.5px] border-border px-3 py-2 text-[13px] outline-none focus:border-navy"
              />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder={t("Code (ex. FEU_ROUGE)")}
                className="rounded-lg border-[1.5px] border-border px-3 py-2 font-mono text-[13px] outline-none focus:border-navy"
              />
              <div className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-border px-3 py-2 focus-within:border-navy">
                <input
                  type="number"
                  min={0}
                  value={montant || ""}
                  onChange={(e) => setMontant(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="20000"
                  className="w-full bg-transparent font-mono text-[13px] tabular-nums outline-none"
                />
                <span className="text-[11px] font-bold text-faint">XOF</span>
              </div>
              <button
                onClick={creer}
                disabled={enreg || !libelle.trim() || !code.trim() || montant <= 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {enreg ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {t("Créer")}
              </button>
              {erreur && <p className="text-[12.5px] text-destructive sm:col-span-4">{erreur}</p>}
            </div>
          )}

          {chargement ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : types.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">{t("Aucun type d'infraction configuré.")}</p>
          ) : (
            <div className="space-y-2.5">
              {types.map((tp) => (
                <div key={tp.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#fbe7e7] text-[#a3312f]">
                    <AlertTriangle className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold text-navy">{tp.libelle}</div>
                    <div className="font-mono text-[11.5px] text-faint">{tp.code}</div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-border px-2.5 py-1.5 focus-within:border-navy">
                    <input
                      type="number"
                      min={0}
                      defaultValue={tp.montant}
                      onBlur={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        if (v !== tp.montant) majMontant(tp, v);
                      }}
                      className="w-24 bg-transparent text-right font-mono text-[13px] font-semibold text-navy tabular-nums outline-none"
                    />
                    <span className="text-[11px] font-bold text-faint">XOF</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={tp.actif}
                    onClick={() => basculerActif(tp)}
                    title={tp.actif ? t("Actif") : t("Inactif")}
                    className={`relative h-6 w-[42px] shrink-0 rounded-full transition ${tp.actif ? "bg-success" : "bg-[#cdd5df]"}`}
                  >
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${tp.actif ? "left-5" : "left-0.5"}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => supprimer(tp)}
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
            {t("Modifiez un montant en cliquant sur sa valeur. Seuls les types actifs sont proposés au moment de dresser un PV.")}
          </p>
        </div>
      </section>
    </Layout>
  );
}

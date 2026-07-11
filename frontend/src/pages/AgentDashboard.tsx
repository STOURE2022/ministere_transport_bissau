import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Car,
  ClipboardCheck,
  FileText,
  Hash,
  Loader2,
  Search,
  ShieldCheck,
  Stamp,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { DossierListItem, Paginated, StatutDossier } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { StatutBadge } from "@/components/StatutBadge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface Filtre {
  statut: StatutDossier;
  titre: string;
  sousTitre: string;
  icone: typeof ClipboardCheck;
  accent: string; // classes de la pastille d'icône
}

const FILTRES: Filtre[] = [
  {
    statut: "EN_VALIDATION",
    titre: "À valider",
    sousTitre: "En attente de décision",
    icone: ClipboardCheck,
    accent: "bg-[#FBF0DD] text-[#96631a]",
  },
  {
    statut: "VALIDE",
    titre: "À immatriculer",
    sousTitre: "Validés",
    icone: Hash,
    accent: "bg-secondary text-primary-deep",
  },
  {
    statut: "IMMATRICULE",
    titre: "À certifier",
    sousTitre: "Immatriculés",
    icone: Stamp,
    accent: "bg-[#EAF1FB] text-primary",
  },
  {
    statut: "CERTIFIE",
    titre: "Certifiés",
    sousTitre: "Cycle terminé",
    icone: ShieldCheck,
    accent: "bg-[#E4F3EC] text-[#166b44]",
  },
];

export default function AgentDashboard() {
  const [compteurs, setCompteurs] = useState<Record<string, number>>({});
  const [actif, setActif] = useState<StatutDossier>("EN_VALIDATION");
  const [recherche, setRecherche] = useState("");
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);

  // Compteurs KPI (une fois au montage).
  useEffect(() => {
    Promise.all(
      FILTRES.map((f) =>
        api
          .get<Paginated<DossierListItem>>("/dossiers/", { params: { statut: f.statut } })
          .then((r) => [f.statut, r.data.count] as const)
          .catch(() => [f.statut, 0] as const)
      )
    ).then((paires) => setCompteurs(Object.fromEntries(paires)));
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const { data } = await api.get<Paginated<DossierListItem>>("/dossiers/", {
        params: { statut: actif, q: recherche || undefined },
      });
      setDossiers(data.results);
      setTotal(data.count);
    } finally {
      setChargement(false);
    }
  }, [actif, recherche]);

  // Recherche différée (debounce) + rechargement au changement de filtre.
  useEffect(() => {
    const t = setTimeout(charger, recherche ? 300 : 0);
    return () => clearTimeout(t);
  }, [charger, recherche]);

  const filtreActif = useMemo(() => FILTRES.find((f) => f.statut === actif)!, [actif]);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">File de validation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Traitez les demandes d'immatriculation à chaque étape du cycle.
        </p>
      </div>

      {/* KPIs cliquables */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FILTRES.map((f) => {
          const Icone = f.icone;
          const selectionne = f.statut === actif;
          return (
            <button
              key={f.statut}
              onClick={() => setActif(f.statut)}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all",
                selectionne
                  ? "border-primary ring-2 ring-secondary"
                  : "border-border hover:border-primary/40"
              )}
            >
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-lg", f.accent)}>
                <Icone className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="text-2xl font-bold leading-none tnum">
                  {compteurs[f.statut] ?? "—"}
                </div>
                <div className="mt-1 truncate text-[12.5px] font-medium">{f.titre}</div>
                <div className="truncate text-[11px] text-faint">{f.sousTitre}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Barre de recherche */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher : n° dossier, VIN, nom du demandeur…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Liste */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <filtreActif.icone className="size-4 text-primary" />
            {filtreActif.titre}
          </div>
          <span className="text-[12px] text-muted-foreground tnum">
            {total} dossier{total > 1 ? "s" : ""}
          </span>
        </div>

        {chargement ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : dossiers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-faint">
              <ClipboardCheck className="size-6" />
            </span>
            <p className="text-sm font-medium">Aucun dossier à cette étape</p>
            <p className="text-[13px] text-muted-foreground">
              Rien à traiter dans « {filtreActif.titre} » pour l'instant.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {dossiers.map((d) => (
              <li key={d.id}>
                <Link
                  to={`/agent/dossiers/${d.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/60"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary-deep">
                    <Car className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold tnum">
                      <FileText className="size-3.5 text-faint" />
                      {d.numero_dossier}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {d.vehicule.marque} {d.vehicule.modele} · {d.vehicule.annee}
                    </div>
                  </div>
                  <div className="hidden min-w-0 text-right sm:block">
                    {d.usager && (
                      <div className="flex items-center justify-end gap-1.5 text-[13px] font-medium">
                        <User className="size-3.5 text-faint" />
                        <span className="truncate">
                          {d.usager.prenom} {d.usager.nom}
                        </span>
                      </div>
                    )}
                    <div className="mt-0.5 text-[11.5px] text-faint tnum">
                      Déposé le {formatDate(d.date_soumission ?? d.date_creation)}
                    </div>
                  </div>
                  <StatutBadge statut={d.statut} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Layout>
  );
}

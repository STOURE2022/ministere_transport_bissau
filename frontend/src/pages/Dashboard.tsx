import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Car, FileText, Loader2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { DossierListItem, Paginated } from "@/lib/types";
import { Layout } from "@/components/Layout";
import { StatutBadge } from "@/components/StatutBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Dashboard() {
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api
      .get<Paginated<DossierListItem>>("/dossiers/")
      .then((r) => setDossiers(r.data.results))
      .finally(() => setChargement(false));
  }, []);

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Espace usager</div>
          <h1 className="mt-1.5 font-serif text-2xl font-bold tracking-tight">Mes dossiers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivez vos demandes d'immatriculation en temps réel.
          </p>
        </div>
        <Button asChild>
          <Link to="/dossiers/nouveau">
            <Plus className="size-4" />
            Nouveau dossier
          </Link>
        </Button>
      </div>

      {chargement ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : dossiers.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-secondary text-primary-deep">
            <Car className="size-7" />
          </span>
          <div>
            <p className="font-semibold">Aucun dossier pour le moment</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez votre première demande d'immatriculation.
            </p>
          </div>
          <Button asChild className="mt-1">
            <Link to="/dossiers/nouveau">
              <Plus className="size-4" />
              Créer un dossier
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {dossiers.map((d) => (
            <Link key={d.id} to={`/dossiers/${d.id}`}>
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold tnum">
                    <FileText className="size-4 text-muted-foreground" />
                    {d.numero_dossier}
                  </div>
                  <StatutBadge statut={d.statut} />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary-deep">
                    <Car className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {d.vehicule.marque} {d.vehicule.modele}
                    </p>
                    <p className="truncate text-[12px] text-faint">
                      {d.vehicule.annee} · {d.vehicule.vin}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[12px] text-muted-foreground">
                  <span>{d.nb_documents} pièce(s)</span>
                  <span className="tnum">Créé le {formatDate(d.date_creation)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { ENERGIES, TYPES_VEHICULE, TYPE_VEHICULE_LABEL } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { Layout } from "@/components/Layout";
import { FieldError } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NouveauDossier() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [vehicule, setVehicule] = useState({
    vin: "",
    marque: "",
    modele: "",
    annee: new Date().getFullYear(),
    couleur: "",
    energie: "ESSENCE",
    type_vehicule: "VP",
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  function set<K extends keyof typeof vehicule>(champ: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setVehicule((v) => ({
        ...v,
        [champ]: champ === "annee" ? Number(e.target.value) : e.target.value,
      }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      const { data } = await api.post("/dossiers/", { vehicule });
      navigate(`/dossiers/${data.id}`);
    } catch (err) {
      setErreur(messageErreur(err, t("Création impossible. Vérifiez les informations du véhicule.")));
    } finally {
      setChargement(false);
    }
  }

  return (
    <Layout>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        {t("Retour à mes dossiers")}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("Nouveau dossier — véhicule")}</CardTitle>
          <CardDescription>
            {t("Renseignez les caractéristiques du véhicule. Vous ajouterez les pièces à l'étape suivante.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="vin">{t("Numéro de châssis (VIN)")}</Label>
              <Input
                id="vin"
                required
                maxLength={17}
                value={vehicule.vin}
                onChange={set("vin")}
                placeholder={t("17 caractères")}
                className="uppercase"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="marque">{t("Marque")}</Label>
                <Input id="marque" required value={vehicule.marque} onChange={set("marque")} />
              </div>
              <div>
                <Label htmlFor="modele">{t("Modèle")}</Label>
                <Input id="modele" required value={vehicule.modele} onChange={set("modele")} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="annee">{t("Année")}</Label>
                <Input
                  id="annee"
                  type="number"
                  required
                  min={1950}
                  max={new Date().getFullYear() + 1}
                  value={vehicule.annee}
                  onChange={set("annee")}
                />
              </div>
              <div>
                <Label htmlFor="couleur">{t("Couleur")}</Label>
                <Input id="couleur" value={vehicule.couleur} onChange={set("couleur")} />
              </div>
              <div>
                <Label htmlFor="energie">{t("Énergie")}</Label>
                <Select id="energie" value={vehicule.energie} onChange={set("energie")}>
                  {ENERGIES.map((e) => (
                    <option key={e} value={e}>
                      {t(e.charAt(0) + e.slice(1).toLowerCase())}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="type_vehicule">{t("Type de véhicule")}</Label>
              <Select
                id="type_vehicule"
                value={vehicule.type_vehicule}
                onChange={set("type_vehicule")}
              >
                {TYPES_VEHICULE.map((tv) => (
                  <option key={tv} value={tv}>
                    {t(TYPE_VEHICULE_LABEL[tv])}
                  </option>
                ))}
              </Select>
            </div>
            <FieldError message={erreur} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" asChild>
                <Link to="/">{t("Annuler")}</Link>
              </Button>
              <Button type="submit" disabled={chargement}>
                {chargement && <Loader2 className="size-4 animate-spin" />}
                {t("Continuer")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}

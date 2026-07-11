import { useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Siren } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TYPES_SIGNALEMENT, type TypeSignalement } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Déclaration d'un véhicule volé / recherché.
 * - Contexte « usager » : uniquement SON véhicule (plaque verrouillée), type « volé ».
 * - Contexte « agent »  : peut choisir le type de signalement.
 * L'alerte n'apparaîtra ensuite qu'aux forces de l'ordre lors d'un contrôle.
 */
export function SignalerVehiculeCard({
  immatriculation,
  vin,
  contexte,
  onDeclare,
  className,
}: {
  immatriculation?: string | null;
  vin?: string | null;
  contexte: "usager" | "agent";
  onDeclare?: () => void | Promise<void>;
  className?: string;
}) {
  const estUsager = contexte === "usager";
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState<TypeSignalement>("VOLE");
  const [reference, setReference] = useState("");
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cible = immatriculation || vin || "";

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.post("/signalements/", {
        immatriculation: immatriculation ?? "",
        vin: immatriculation ? "" : vin ?? "",
        type: estUsager ? "VOLE" : type,
        reference,
        motif,
      });
      setMsg({
        ok: true,
        text: "Déclaration enregistrée. Le véhicule sera signalé aux forces de l'ordre lors d'un contrôle.",
      });
      setReference("");
      setMotif("");
      await onDeclare?.();
    } catch (err) {
      setMsg({ ok: false, text: messageErreur(err, "Déclaration impossible.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("overflow-hidden border-l-4 border-l-destructive", className)}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#FBE7E7] text-destructive">
          <Siren className="size-[18px]" />
        </span>
        <span className="flex-1">
          <span className="block text-[14.5px] font-semibold text-foreground">
            {estUsager ? "Déclarer ce véhicule volé" : "Signaler ce véhicule"}
          </span>
          <span className="block text-[12.5px] text-muted-foreground">
            {estUsager
              ? "En cas de vol, alertez immédiatement les autorités."
              : "Déclarer volé, recherché ou en opposition administrative."}
          </span>
        </span>
        <ChevronDown className={cn("size-5 text-faint transition-transform", ouvert && "rotate-180")} />
      </button>

      {ouvert && (
        <CardContent className="border-t border-border pt-5">
          {cible ? (
            <form onSubmit={envoyer} className="space-y-3">
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-[13px]">
                <span className="text-faint">Véhicule concerné : </span>
                <span className="font-semibold tnum">{cible}</span>
                {!immatriculation && vin && <span className="text-faint"> (VIN)</span>}
              </div>

              {!estUsager && (
                <div>
                  <Label htmlFor="sig-type">Type de signalement</Label>
                  <Select
                    id="sig-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as TypeSignalement)}
                    className="mt-1"
                  >
                    {TYPES_SIGNALEMENT.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="sig-ref">Référence (dépôt de plainte / PV)</Label>
                <Input
                  id="sig-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="PV-2026-0142"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sig-motif">Circonstances</Label>
                <Input
                  id="sig-motif"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder={estUsager ? "Volé cette nuit à Bissau" : "Motif du signalement"}
                  className="mt-1"
                />
              </div>

              <Button type="submit" variant="destructive" disabled={busy} className="w-full">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Siren className="size-4" />}
                {estUsager ? "Déclarer le vol" : "Enregistrer le signalement"}
              </Button>

              {msg && (
                <p
                  className={cn(
                    "flex items-start gap-2 rounded-lg px-3 py-2 text-[13px]",
                    msg.ok ? "bg-[#E4F3EC] text-[#166b44]" : "bg-[#FBE7E7] text-[#9a2f2f]"
                  )}
                >
                  {msg.ok && <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
                  {msg.text}
                </p>
              )}
            </form>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Ce véhicule n'est pas encore identifiable (ni plaque ni VIN) — déclaration indisponible.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

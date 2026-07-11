import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, ScanLine, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Extrait l'UUID du certificat et l'empreinte h d'un contenu de QR (URL) ou d'un ID brut. */
function analyser(saisie: string): { uuid: string; h: string | null } | null {
  const texte = saisie.trim();
  if (!texte) return null;

  const uuid = texte.match(RE_UUID)?.[0];
  if (!uuid) return null;

  let h: string | null = null;
  try {
    const url = new URL(texte);
    h = url.searchParams.get("h");
  } catch {
    // pas une URL : on tente d'isoler ?h=... manuellement
    const m = texte.match(/[?&]h=([^&\s]+)/);
    if (m) h = decodeURIComponent(m[1]);
  }
  return { uuid, h };
}

export default function ControleForceOrdre() {
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const navigate = useNavigate();

  function verifier(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const r = analyser(saisie);
    if (!r) {
      setErreur("Contenu non reconnu. Collez l'URL complète du QR ou l'identifiant du certificat.");
      return;
    }
    const suffixe = r.h ? `?h=${encodeURIComponent(r.h)}` : "";
    navigate(`/verify/${r.uuid}/${suffixe}`);
  }

  return (
    <Layout>
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-secondary text-primary-deep">
            <ScanLine className="size-7" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Contrôle routier</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vérifiez l'authenticité d'un certificat véhicule en temps réel.
          </p>
        </div>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" />
              Vérifier un certificat
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={verifier} className="space-y-4">
              <div>
                <Label htmlFor="qr">Contenu du QR ou identifiant</Label>
                <textarea
                  id="qr"
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="https://…/verify/xxxxxxxx-…?h=…"
                />
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  Collez l'URL complète lue par le lecteur QR. L'empreinte (h) est indispensable
                  pour garantir l'authenticité.
                </p>
              </div>
              {erreur && (
                <p className="rounded-lg bg-[#FBE7E7] px-3 py-2 text-[13px] text-[#9a2f2f]">
                  {erreur}
                </p>
              )}
              <Button type="submit" className="w-full">
                <ShieldCheck className="size-4" />
                Vérifier
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-5 rounded-xl border border-border bg-secondary/50 p-4 text-[13px] text-primary-deep">
          <p className="font-semibold">Sur le terrain</p>
          <p className="mt-1 text-muted-foreground">
            Scannez directement le QR du certificat avec l'appareil photo : la page de vérification
            s'ouvre automatiquement. Ce formulaire sert de secours en cas de saisie manuelle.
          </p>
        </div>
      </div>
    </Layout>
  );
}

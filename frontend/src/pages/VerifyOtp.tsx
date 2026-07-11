import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, messageErreur } from "@/lib/api";
import { AuthShell, FieldError } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VerifyOtp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      await api.post("/auth/verify-otp/", { email, code, canal: "SMS" });
      navigate("/login", {
        state: { message: "Compte vérifié ! Vous pouvez maintenant vous connecter." },
      });
    } catch (err) {
      setErreur(messageErreur(err, "Code invalide ou expiré."));
    } finally {
      setChargement(false);
    }
  }

  async function renvoyer() {
    setErreur(null);
    setInfo(null);
    try {
      await api.post("/auth/resend-otp/", { email, canal: "SMS" });
      setInfo("Un nouveau code a été envoyé.");
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <AuthShell
      title="Vérification du compte"
      subtitle="Saisissez le code reçu par SMS."
      footer={
        <Link to="/login" className="font-semibold text-white underline underline-offset-4">
          Retour à la connexion
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Adresse e-mail</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="code">Code de vérification</Label>
          <Input
            id="code"
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="tracking-[0.4em] text-center text-lg"
          />
        </div>
        {info && (
          <p className="rounded-lg bg-[#E4F3EC] px-3 py-2 text-[13px] text-[#166b44]">{info}</p>
        )}
        <FieldError message={erreur} />
        <Button type="submit" className="w-full" disabled={chargement}>
          {chargement && <Loader2 className="size-4 animate-spin" />}
          Vérifier
        </Button>
        <button
          type="button"
          onClick={renvoyer}
          className="w-full text-center text-[13px] font-medium text-primary hover:underline"
        >
          Renvoyer le code
        </button>
      </form>
    </AuthShell>
  );
}

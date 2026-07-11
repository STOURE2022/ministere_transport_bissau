import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Loader2, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/**
 * Scanner QR par caméra (plein écran). Ouvre la caméra arrière du téléphone,
 * décode le QR en continu avec jsQR (pur JS, compatible iOS/Android) et renvoie
 * le contenu décodé via `onScan`. Repli manuel si la caméra est indisponible.
 */
export function ScannerQR({
  onScan,
  onClose,
}: {
  onScan: (texte: string) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function demarrer() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (annule) {
          stream.getTracks().forEach((x) => x.stop());
          return;
        }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        setPret(true);
        scan();
      } catch {
        if (!annule) {
          setErreur(t("Caméra indisponible. Autorisez l'accès ou saisissez le QR manuellement."));
        }
      }
    }

    function scan() {
      const v = videoRef.current;
      if (annule || !v || !ctx) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          onScan(code.data);
          return;
        }
      }
      raf = requestAnimationFrame(scan);
    }

    demarrer();
    return () => {
      annule = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((x) => x.stop());
    };
  }, [onScan, t]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="font-serif text-base font-semibold">{t("Scanner le QR")}</span>
        <button
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
          aria-label={t("Fermer")}
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        {!pret && !erreur && <Loader2 className="absolute size-8 animate-spin text-white" />}
        {pret && (
          <div className="pointer-events-none absolute size-56 max-w-[72vw] rounded-2xl border-4 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,.45)]" />
        )}
      </div>

      <div className="px-6 py-6 text-center text-white">
        {erreur ? (
          <p className="text-[14px] text-[#ffb3ab]">{erreur}</p>
        ) : (
          <p className="text-[14px] text-white/85">{t("Visez le QR du certificat")}</p>
        )}
        <Button variant="ghost" className="mt-3 text-white hover:bg-white/10" onClick={onClose}>
          {t("Fermer")}
        </Button>
      </div>
    </div>
  );
}

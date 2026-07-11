/**
 * Vérification HORS-LIGNE d'un certificat SNICV.
 *
 * Le jeton (contenu du QR hors-ligne) embarque la chaîne canonique signée `c`
 * et la signature RSA `s`. Muni de la clé publique du SNICV (récupérée une fois
 * puis mise en cache), l'appareil valide la signature localement — sans réseau.
 * Schéma identique au serveur : RSASSA-PKCS1-v1_5 + SHA-256.
 */
import { api } from "./api";

const CLE_CACHE = "snicv_cle_publique_pem";

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToBytes(b64url: string): Uint8Array {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return b64ToBytes(s);
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  return b64ToBytes(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
}

/** Récupère la clé publique (en ligne) et la met en cache ; repli sur le cache hors-ligne. */
export async function obtenirClePem(): Promise<string | null> {
  try {
    const { data } = await api.get<{ cle_publique_pem: string }>("/cle-publique/");
    localStorage.setItem(CLE_CACHE, data.cle_publique_pem);
    return data.cle_publique_pem;
  } catch {
    return localStorage.getItem(CLE_CACHE);
  }
}

export function clePemEnCache(): string | null {
  return localStorage.getItem(CLE_CACHE);
}

export async function importerCle(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    pemToDer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

export interface JetonSnapshot {
  immatriculation?: string;
  proprietaire?: string;
  marque?: string;
  modele?: string;
  annee?: number;
  energie?: string;
  type?: string;
  assurance_echeance?: string | null;
  ct_echeance?: string | null;
  date_emission?: string;
}

export interface ResultatHorsLigne {
  valide: boolean;
  snapshot: JetonSnapshot;
  exp: string | null;
  id: string | null;
}

/** Décode et vérifie localement un jeton. Lève une erreur si le jeton est illisible. */
export async function verifierJetonHorsLigne(token: string, key: CryptoKey): Promise<ResultatHorsLigne> {
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(token.trim())));
  const valide = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    b64ToBytes(payload.s),
    new TextEncoder().encode(payload.c),
  );
  return {
    valide,
    snapshot: JSON.parse(payload.c) as JetonSnapshot,
    exp: payload.exp ?? null,
    id: payload.id ?? null,
  };
}

import axios, { AxiosError } from "axios";

const BASE =
  import.meta.env.VITE_API_URL ??
  "https://ministeretransportbissau-production.up.railway.app/api/v1";

const ACCESS = "snicv_access";
const REFRESH = "snicv_refresh";

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const t = tokens.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Rafraîchissement automatique du token d'accès sur 401 (une seule tentative).
let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry && tokens.refresh) {
      original._retry = true;
      try {
        if (!refreshing) {
          refreshing = axios
            .post(`${BASE}/auth/refresh/`, { refresh: tokens.refresh })
            .then((r) => {
              localStorage.setItem(ACCESS, r.data.access);
              if (r.data.refresh) localStorage.setItem(REFRESH, r.data.refresh);
              return r.data.access as string;
            })
            .finally(() => {
              refreshing = null;
            });
        }
        const access = await refreshing;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        tokens.clear();
      }
    }
    return Promise.reject(error);
  }
);

/** Extrait un message d'erreur lisible d'une réponse DRF. */
export function messageErreur(error: unknown, defaut = "Une erreur est survenue."): string {
  const err = error as AxiosError<Record<string, unknown>>;
  const data = err.response?.data;
  if (!data) return err.message || defaut;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray((data as { problemes?: string[] }).problemes)) {
    return (data as { problemes: string[] }).problemes.join(" ");
  }
  // Erreurs de validation par champ → première erreur.
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return String(first[0]);
  if (typeof first === "string") return first;
  return defaut;
}

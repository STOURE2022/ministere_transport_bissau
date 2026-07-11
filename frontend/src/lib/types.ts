export type Role = "USAGER" | "AGENT" | "FORCE_ORDRE" | "ADMIN";

export const ROLE_LABEL: Record<Role, string> = {
  USAGER: "Espace usager",
  AGENT: "Espace agent",
  FORCE_ORDRE: "Contrôle routier",
  ADMIN: "Administration",
};

/** Page d'accueil selon le rôle (après connexion). */
export function accueilPourRole(role: Role): string {
  if (role === "AGENT" || role === "ADMIN") return "/agent";
  if (role === "FORCE_ORDRE") return "/controle";
  return "/";
}

export interface User {
  id: string;
  email: string;
  telephone: string;
  nom: string;
  prenom: string;
  role: Role;
  is_active: boolean;
  is_email_verifie?: boolean;
  is_telephone_verifie?: boolean;
}

export type StatutDossier =
  | "BROUILLON"
  | "SOUMIS"
  | "VERIF_AUTO"
  | "EN_VALIDATION"
  | "VALIDE"
  | "REJETE"
  | "IMMATRICULE"
  | "CERTIFIE"
  | "ARCHIVE";

export interface UsagerMini {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

export interface Vehicule {
  id?: string;
  vin: string;
  marque: string;
  modele: string;
  annee: number;
  couleur?: string;
  energie: string;
  type_vehicule: string;
}

export interface DossierListItem {
  id: string;
  numero_dossier: string;
  statut: StatutDossier;
  statut_libelle: string;
  vehicule: Vehicule;
  usager?: UsagerMini;
  nb_documents: number;
  date_creation: string;
  date_soumission: string | null;
}

export interface DocumentItem {
  id: string;
  type_document: string;
  format: string;
  hash_fichier: string;
  date_debut: string | null;
  date_fin: string | null;
  statut_verif: string;
  date_creation: string;
}

export interface DossierDetail {
  id: string;
  numero_dossier: string;
  statut: StatutDossier;
  statut_libelle: string;
  motif_rejet: string;
  vehicule: Vehicule;
  usager?: UsagerMini;
  documents: DocumentItem[];
  documents_requis_manquants: string[];
  date_creation: string;
  date_soumission: string | null;
}

export interface Verification {
  vin_valide: boolean;
  assurance_valide: boolean;
  ct_valide: boolean;
  doublon_detecte: boolean;
  score_fraude: number;
  niveau_risque: string;
  niveau_risque_libelle: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/* ── Étape 4 : décisions agent ── */
export interface ValidationDecision {
  id: string;
  action: string;
  action_libelle: string;
  agent: string | null;
  agent_nom: string | null;
  commentaire: string;
  date_creation: string;
}

/* ── Étape 5 : immatriculation ── */
export interface Immatriculation {
  numero: string;
  serie_plaque: string;
  vehicule_uuid: string;
  agent_nom: string | null;
  date_attribution: string;
}

/* ── Étape 6 : certificat QR ── */
export type StatutCertificat = "ACTIF" | "SUSPENDU" | "REVOQUE" | "EXPIRE";

export interface Certificat {
  id: string;
  dossier: string;
  statut: StatutCertificat;
  statut_libelle: string;
  est_valide: boolean;
  donnees_snapshot: Record<string, unknown>;
  hash_sha256: string;
  signature_rsa: string;
  qr_payload: string;
  pdf_url: string | null;
  date_emission: string;
  date_expiration: string;
  motif_revocation: string;
}

/* ── Étape 7 : vérification QR temps réel ── */
export type ResultatScan =
  | "AUTHENTIQUE"
  | "FALSIFIE"
  | "REVOQUE"
  | "EXPIRE"
  | "INTROUVABLE";

export interface CertificatPublic {
  immatriculation: string | null;
  proprietaire: string | null;
  marque_modele: string | null;
  annee: number | null;
  statut: string;
  assurance_echeance: string | null;
  ct_echeance: string | null;
  date_emission: string;
  date_expiration: string;
}

export type TypeSignalement = "VOLE" | "RECHERCHE" | "OPPOSITION";

export interface Alerte {
  type: TypeSignalement;
  type_libelle: string;
  reference: string;
  motif: string;
  date_signalement: string;
}

export const TYPES_SIGNALEMENT: { value: TypeSignalement; label: string }[] = [
  { value: "VOLE", label: "Véhicule volé" },
  { value: "RECHERCHE", label: "Véhicule recherché" },
  { value: "OPPOSITION", label: "Opposition administrative" },
];

export interface VerificationResult {
  resultat: ResultatScan;
  message: string;
  verifie_le: string;
  certificat: CertificatPublic | null;
  methode?: "QR" | "PLAQUE";
  immatriculation?: string;
  alerte?: Alerte | null;
}

export interface ScanLog {
  id: string;
  resultat: ResultatScan;
  resultat_libelle: string;
  methode: "QR" | "PLAQUE";
  methode_libelle: string;
  immatriculation: string | null;
  scanne_par: string | null;
  scanne_par_nom: string | null;
  ip: string | null;
  localisation: string;
  date_scan: string;
}

export const ENERGIES = ["ESSENCE", "DIESEL", "ELECTRIQUE", "HYBRIDE", "GPL"] as const;
export const TYPES_VEHICULE = ["VP", "UTILITAIRE", "MOTO", "POIDS_LOURD", "BUS"] as const;

export const TYPE_VEHICULE_LABEL: Record<string, string> = {
  VP: "Voiture particulière",
  UTILITAIRE: "Utilitaire",
  MOTO: "Moto / tricycle",
  POIDS_LOURD: "Poids lourd",
  BUS: "Bus / transport en commun",
};

export const DOCUMENTS_REQUIS = [
  { value: "ASSURANCE", label: "Attestation d'assurance", withDates: true },
  { value: "CONTROLE_TECHNIQUE", label: "Contrôle technique", withDates: true },
  { value: "FACTURE", label: "Facture d'achat", withDates: false },
] as const;

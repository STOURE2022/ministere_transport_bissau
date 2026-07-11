export type Role = "USAGER" | "AGENT" | "FORCE_ORDRE" | "ADMIN";

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

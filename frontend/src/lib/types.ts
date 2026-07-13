export type Role = "USAGER" | "AGENT" | "FORCE_ORDRE" | "ADMIN";

export const ROLE_LABEL: Record<Role, string> = {
  USAGER: "Espace usager",
  AGENT: "Espace agent",
  FORCE_ORDRE: "Contrôle routier",
  ADMIN: "Administration",
};

/** Page d'accueil selon le rôle (après connexion). */
export function accueilPourRole(role: Role): string {
  if (role === "ADMIN") return "/pilotage";
  if (role === "AGENT") return "/agent";
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

/* ── Tableau de bord national (pilotage) ── */
export interface StatStatut {
  statut: string;
  libelle: string;
  count: number;
}
export interface StatResultat {
  resultat: string;
  libelle: string;
  count: number;
}
export interface StatCle {
  cle: string;
  libelle: string;
  count: number;
}
export interface StatMois {
  mois: string;
  label: string;
  count: number;
}
export interface DashboardStats {
  vehicules: number;
  immatriculations: number;
  certificats_actifs: number;
  certificats_total: number;
  signalements_actifs: number;
  controles_total: number;
  controles_aujourdhui: number;
  taux_fraude: number;
  dossiers_par_statut: StatStatut[];
  scans_par_resultat: StatResultat[];
  repartition_type: StatCle[];
  repartition_energie: StatCle[];
  certificats_par_mois: StatMois[];
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
  jeton_hors_ligne?: string;
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

export interface Signalement {
  id: string;
  type: TypeSignalement;
  type_libelle: string;
  statut: "ACTIF" | "LEVE";
  statut_libelle: string;
  reference: string;
  motif: string;
  immatriculation: string | null;
  vin: string;
  signale_par_nom: string | null;
  date_signalement: string;
  date_levee: string | null;
  motif_levee: string;
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

/* ── Notifications & alertes d'échéance ── */
export type NiveauNotification = "SUCCES" | "INFO" | "ALERTE" | "ACTION" | "NEUTRE";

export interface Notification {
  id: string;
  niveau: NiveauNotification;
  niveau_libelle: string;
  categorie: string;
  titre: string;
  message: string;
  lien: string;
  cta_label: string;
  lu: boolean;
  date_creation: string;
}

export interface Echeance {
  categorie: "ASSURANCE" | "CT" | "CERTIFICAT";
  label: string;
  immatriculation: string | null;
  echeance: string;
  jours_restants: number;
  niveau: NiveauNotification;
  lien: string;
}

export interface PreferencesNotification {
  canal_email: boolean;
  canal_sms: boolean;
  canal_push: boolean;
  delais_relance: number[];
  delais_disponibles: number[];
}

/* ── Étape 8 : dossier de vie (historique + archivage) ── */
export type TypeEvenement =
  | "CREATION" | "PIECES" | "VERIFICATION" | "VALIDATION" | "REJET" | "COMPLEMENT"
  | "IMMATRICULATION" | "CERTIFICAT" | "CERTIFICAT_REVOQUE" | "CONTROLE"
  | "SIGNALEMENT" | "SIGNALEMENT_LEVE" | "ARCHIVAGE";

export interface EvenementVie {
  type: TypeEvenement;
  categorie: string;
  titre: string;
  description: string;
  acteur: string | null;
  date: string;
  tag: string;
  tag_niveau: "success" | "warning" | "danger" | "gold" | "";
}

export interface ResumeVie {
  statut: StatutDossier;
  statut_libelle: string;
  evenements: number;
  controles: number;
  controles_authentiques: number;
  signalements_actifs: number;
  signalements_leves: number;
  certificat_actif: boolean;
  premier_evenement: string | null;
  dernier_controle: string | null;
  anciennete_mois: number;
}

export interface DossierDeVie {
  dossier: { id: string; numero_dossier: string; statut: StatutDossier; statut_libelle: string };
  vehicule: {
    vin: string; marque: string; modele: string; annee: number; energie: string;
    immatriculation: string | null; titulaire: string;
  };
  certificat: { statut: string; date_expiration: string } | null;
  immatricule_le: string | null;
  resume: ResumeVie;
  evenements: EvenementVie[];
}

/* ── Paiement de la taxe d'immatriculation (mobile money) ── */
export type StatutPaiement = "EN_ATTENTE" | "PAYE" | "ECHOUE";

export interface LignePaiement {
  libelle: string;
  montant: number;
}

export interface OperateurPaiement {
  id: string;
  nom: string;
  code: string;
  code_ussd: string;
  couleur: string;
  actif: boolean;
  ordre: number;
}

/** Réponse de l'endpoint « montant » : ce que la page de paiement affiche. */
export interface MontantPaiement {
  devise: string;
  lignes: LignePaiement[];
  total: number;
  operateurs: OperateurPaiement[];
  deja_paye: boolean;
}

export interface Paiement {
  id: string;
  reference: string;
  devise: string;
  montant_total: number;
  detail: LignePaiement[];
  operateur: string;
  code_ussd: string;
  numero_telephone: string;
  reference_transaction: string;
  statut: StatutPaiement;
  statut_libelle: string;
  paye_le: string | null;
  date_creation: string;
  numero_dossier: string;
  immatriculation: string | null;
  usager_nom: string;
  a_recu: boolean;
}

/** Configuration facturable, éditable depuis le tableau de bord admin. */
export interface ConfigurationPaiement {
  devise: string;
  montant_taxe: number;
  montant_timbre: number;
  frais_service: number;
  paiement_requis: boolean;
  total: number;
  lignes: LignePaiement[];
}

export interface PaiementStats {
  nombre_payes: number;
  montant_total: number;
  en_attente: number;
  devise: string;
}

/* ── Amendes & procès-verbaux (infractions) ── */
export type StatutInfraction = "A_REGLER" | "PAYEE" | "CONTESTEE" | "ANNULEE";

export interface TypeInfraction {
  id: string;
  libelle: string;
  code: string;
  montant: number;
  actif: boolean;
  ordre: number;
}

export interface Infraction {
  id: string;
  reference: string;
  libelle: string;
  montant: number;
  devise: string;
  lieu: string;
  observations: string;
  date_infraction: string;
  statut: StatutInfraction;
  statut_libelle: string;
  motif_contestation: string;
  motif_annulation: string;
  operateur: string;
  numero_telephone: string;
  reference_transaction: string;
  quittance_reference: string;
  paye_le: string | null;
  date_creation: string;
  immatriculation: string | null;
  vin: string;
  marque: string;
  modele: string;
  titulaire: string;
  dressee_par_nom: string | null;
  a_quittance: boolean;
}

export interface InfractionStats {
  total: number;
  a_regler: number;
  contestees: number;
  payees: number;
  recettes: number;
  devise: string;
}

/** Véhicule résolu par sa plaque pour pré-remplir un PV. */
export interface InfractionCible {
  vehicule_id: string;
  immatriculation: string | null;
  titulaire: string;
  marque: string;
  modele: string;
  annee: number;
  types: TypeInfraction[];
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

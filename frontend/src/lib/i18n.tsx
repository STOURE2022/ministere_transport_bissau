import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type Lang = "fr" | "pt";
const STORAGE = "snicv_lang";

/**
 * i18n minimaliste. Le **français est la langue source** : `t()` renvoie la
 * chaîne française telle quelle si `lang === "fr"` (identité → aucune régression),
 * et sa traduction portugaise sinon (repli sur le français si absente).
 */
interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (fr: string) => string;
  n: (valeur: number) => string;
}

const LangContext = createContext<Ctx>({ lang: "fr", setLang: () => {}, t: (s) => s, n: (v) => String(v) });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const s = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE) : null;
    return s === "pt" || s === "fr" ? s : "fr";
  });

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE, l);
    document.documentElement.lang = l === "pt" ? "pt" : "fr";
    setLangState(l);
  }, []);

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang,
    t: (fr: string) => (lang === "pt" ? PT[fr] ?? fr : fr),
    n: (valeur: number) => new Intl.NumberFormat(lang === "pt" ? "pt-PT" : "fr-FR").format(valeur),
  }), [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** Bascule PT · FR (pensée pour les en-têtes sombres ; `className` pour ajuster). */
export function LangSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={cn("inline-flex items-center gap-1 text-[12px] font-semibold tracking-[0.06em]", className)}>
      <button
        type="button"
        onClick={() => setLang("pt")}
        aria-pressed={lang === "pt"}
        className={cn("rounded px-1 transition-opacity", lang === "pt" ? "opacity-100" : "opacity-55 hover:opacity-90")}
      >
        PT
      </button>
      <span className="opacity-40">·</span>
      <button
        type="button"
        onClick={() => setLang("fr")}
        aria-pressed={lang === "fr"}
        className={cn("rounded px-1 transition-opacity", lang === "fr" ? "opacity-100" : "opacity-55 hover:opacity-90")}
      >
        FR
      </button>
    </div>
  );
}

/** Dictionnaire français → portugais (Guiné-Bissau / português europeu). */
const PT: Record<string, string> = {
  /* ── Commun / navigation / rôles ── */
  "Ministère des Transports · Guinée-Bissau": "Ministério dos Transportes · Guiné-Bissau",
  "Accueil": "Início",
  "Page d'accueil": "Página inicial",
  "Se déconnecter": "Terminar sessão",
  "Pilotage": "Pilotagem",
  "File de validation": "Fila de validação",
  "Contrôle": "Controlo",
  "Mes dossiers": "Os meus processos",
  "Nouveau dossier": "Novo processo",
  "Espace usager": "Área do utente",
  "Espace agent": "Área do agente",
  "Contrôle routier": "Controlo rodoviário",
  "Administration": "Administração",
  "Chargement…": "A carregar…",
  "Annuler": "Cancelar",
  "Continuer": "Continuar",
  "Retour": "Voltar",

  /* ── Authentification ── */
  "Immatriculation des véhicules · Guinée-Bissau": "Matrícula de veículos · Guiné-Bissau",
  "Connexion": "Iniciar sessão",
  "Accédez à votre espace de suivi de dossier.": "Aceda à sua área de acompanhamento de processos.",
  "Pas encore de compte ?": "Ainda não tem conta?",
  "Créer un compte": "Criar uma conta",
  "Adresse e-mail": "Endereço de e-mail",
  "Mot de passe": "Palavra-passe",
  "Se connecter": "Iniciar sessão",
  "E-mail ou mot de passe incorrect.": "E-mail ou palavra-passe incorretos.",
  "Un code de vérification vous sera envoyé par SMS.": "Ser-lhe-á enviado um código de verificação por SMS.",
  "Déjà inscrit ?": "Já tem conta?",
  "Prénom": "Nome próprio",
  "Nom": "Apelido",
  "Téléphone": "Telefone",
  "Confirmation": "Confirmação",
  "Créer mon compte": "Criar a minha conta",
  "Inscription impossible. Vérifiez vos informations.": "Registo impossível. Verifique os seus dados.",
  "Vérification du compte": "Verificação da conta",
  "Saisissez le code reçu par SMS.": "Introduza o código recebido por SMS.",
  "Retour à la connexion": "Voltar ao início de sessão",
  "Code de vérification": "Código de verificação",
  "Vérifier": "Verificar",
  "Renvoyer le code": "Reenviar o código",
  "Code invalide ou expiré.": "Código inválido ou expirado.",
  "Un nouveau code a été envoyé.": "Foi enviado um novo código.",
  "Compte vérifié ! Vous pouvez maintenant vous connecter.": "Conta verificada! Já pode iniciar sessão.",

  /* ── Accueil public ── */
  "Espaces": "Áreas",
  "Sécurité": "Segurança",
  "Couverture": "Cobertura",
  "● EN DIRECT": "● EM DIRETO",
  "République de Guinée-Bissau": "República da Guiné-Bissau",
  "Le registre national des véhicules,": "O registo nacional de veículos,",
  "infalsifiable et vérifiable en 2 secondes.": "infalsificável e verificável em 2 segundos.",
  "Immatriculation, certificat numérique signé et contrôle routier temps réel — une plateforme souveraine du Ministère des Transports.":
    "Matrícula, certificado digital assinado e controlo rodoviário em tempo real — uma plataforma soberana do Ministério dos Transportes.",
  "✦ Vérifier un certificat": "✦ Verificar um certificado",
  "Espace agent / administration": "Área do agente / administração",
  "signature cryptographique": "assinatura criptográfica",
  "vérification terrain": "verificação no terreno",
  "hors-ligne possible": "possível offline",
  "Vérification d'un certificat": "Verificação de um certificado",
  "Certificat authentique": "Certificado autêntico",
  "Signature RSA valide · statut actif": "Assinatura RSA válida · estado ativo",
  "Titulaire": "Titular",
  "Véhicule": "Veículo",
  "Année · Énergie": "Ano · Energia",
  "Valable jusqu'au": "Válido até",
  "Vérifié le 11 juillet 2026 à 14:32 · Contrôle routier — Bissau":
    "Verificado a 11 de julho de 2026 às 14:32 · Controlo rodoviário — Bissau",
  "Empreinte SHA-256 recalculée localement — aucune donnée modifiable.":
    "Impressão SHA-256 recalculada localmente — nenhum dado alterável.",
  "Véhicules immatriculés": "Veículos matriculados",
  "au total": "no total",
  "Certificats QR actifs": "Certificados QR ativos",
  "signés RSA-2048": "assinados RSA-2048",
  "Contrôles vérifiés": "Controlos verificados",
  "forces de l'ordre": "forças da ordem",
  "Régions couvertes": "Regiões cobertas",
  "tout le territoire": "todo o território",
  "Du dépôt au certificat": "Do depósito ao certificado",
  "Un parcours dématérialisé, du dossier au QR signé": "Um percurso desmaterializado, do processo ao QR assinado",
  "Chaque véhicule suit un circuit tracé et sécurisé : le citoyen dépose, l'agent valide, l'État certifie.":
    "Cada veículo segue um circuito rastreado e seguro: o cidadão submete, o agente valida, o Estado certifica.",
  "Dépôt du dossier": "Submissão do processo",
  "Le titulaire crée son compte et téléverse assurance, contrôle technique et facture.":
    "O titular cria a sua conta e carrega seguro, inspeção técnica e fatura.",
  "Vérification & validation": "Verificação e validação",
  "Contrôle automatique anti-fraude puis validation par un agent habilité.":
    "Controlo automático antifraude e depois validação por um agente habilitado.",
  "Immatriculation": "Matrícula",
  "Attribution d'une plaque nationale format": "Atribuição de uma matrícula nacional formato",
  "et enregistrement au registre.": "e registo no cadastro nacional.",
  "Certificat QR signé": "Certificado QR assinado",
  "Génération d'un certificat numérique signé, vérifiable en ligne comme hors-ligne.":
    "Geração de um certificado digital assinado, verificável online e offline.",
  "Une plateforme, quatre métiers": "Uma plataforma, quatro profissões",
  "Chaque acteur, son espace dédié": "Cada ator, o seu espaço dedicado",
  "Usager": "Utente",
  "Déposer un dossier, suivre son traitement, télécharger son certificat officiel.":
    "Submeter um processo, acompanhar o tratamento, descarregar o certificado oficial.",
  "Créer mon dossier →": "Criar o meu processo →",
  "Agent instructeur": "Agente instrutor",
  "Instruire les dossiers, immatriculer, émettre et révoquer les certificats.":
    "Instruir os processos, matricular, emitir e revogar os certificados.",
  "File de validation →": "Fila de validação →",
  "Forces de l'ordre": "Forças da ordem",
  "Vérifier par QR ou par plaque, consulter les alertes véhicules volés.":
    "Verificar por QR ou por matrícula, consultar os alertas de veículos roubados.",
  "Console de contrôle →": "Consola de controlo →",
  "Piloter le parc national, suivre les indicateurs et la fraude en temps réel.":
    "Gerir o parque nacional, acompanhar os indicadores e a fraude em tempo real.",
  "Tableau de bord →": "Painel de controlo →",
  "Confiance par la cryptographie": "Confiança pela criptografia",
  "Un certificat que l'on ne peut ni imiter, ni altérer": "Um certificado que não se pode imitar nem alterar",
  "Signature RSA-2048": "Assinatura RSA-2048",
  "Chaque certificat est signé par la clé souveraine de l'État. Toute retouche invalide la signature.":
    "Cada certificado é assinado pela chave soberana do Estado. Qualquer alteração invalida a assinatura.",
  "Empreinte SHA-256": "Impressão SHA-256",
  "Les données sont scellées par une empreinte recalculée à chaque contrôle.":
    "Os dados são selados por uma impressão recalculada em cada controlo.",
  "Vérification hors-ligne": "Verificação offline",
  "Sur le terrain sans réseau, l'agent valide la signature localement, en toute autonomie.":
    "No terreno sem rede, o agente valida a assinatura localmente, com total autonomia.",
  "Alerte véhicules signalés": "Alerta de veículos sinalizados",
  "Un véhicule volé ou recherché déclenche une alerte immédiate au contrôle.":
    "Um veículo roubado ou procurado desencadeia um alerta imediato no controlo.",
  "Scellé numérique de l'État": "Selo digital do Estado",
  "Présence nationale": "Presença nacional",
  "Un dispositif déployé sur tout le territoire": "Um dispositivo implantado em todo o território",
  "Des centres d'immatriculation et de contrôle connectés au registre national, de la capitale aux régions.":
    "Centros de matrícula e de controlo ligados ao registo nacional, da capital às regiões.",
  "Trouver un centre": "Encontrar um centro",
  "Contacter le ministère": "Contactar o ministério",
  "Ministère des Transports": "Ministério dos Transportes",
  "Un registre moderne, au service": "Um registo moderno, ao serviço",
  "de la sécurité routière nationale": "da segurança rodoviária nacional",
  "Émettre, vérifier et sécuriser les certificats des véhicules de Guinée-Bissau — sur une plateforme conçue pour l'échelle nationale.":
    "Emitir, verificar e proteger os certificados dos veículos da Guiné-Bissau — numa plataforma concebida para a escala nacional.",
  "Accéder à mon espace": "Aceder à minha área",
  "Système National d'Immatriculation et de Contrôle des Véhicules — Ministère des Transports de la République de Guinée-Bissau.":
    "Sistema Nacional de Matrícula e Controlo de Veículos — Ministério dos Transportes da República da Guiné-Bissau.",
  "Plateforme": "Plataforma",
  "Vérifier un certificat": "Verificar um certificado",
  "Mode hors-ligne": "Modo offline",
  "Le dispositif": "O dispositivo",
  "Certificat QR": "Certificado QR",
  "Signalements": "Sinalizações",
  "Institution": "Instituição",
  "Centres régionaux": "Centros regionais",
  "Mentions légales": "Menções legais",
  "Contact": "Contacto",
  "© 2026 République de Guinée-Bissau — Ministère des Transports":
    "© 2026 República da Guiné-Bissau — Ministério dos Transportes",

  /* ── Statuts de dossier (StatutBadge) ── */
  "Brouillon": "Rascunho",
  "Soumis": "Submetido",
  "Vérification auto": "Verificação auto",
  "Vérification automatique": "Verificação automática",
  "En validation": "Em validação",
  "Validé": "Validado",
  "Rejeté": "Rejeitado",
  "Immatriculé": "Matriculado",
  "Certifié": "Certificado",
  "Archivé": "Arquivado",

  /* ── Étapes (Stepper) ── */
  "Dépôt": "Submissão",
  "Vérification": "Verificação",
  "Validation": "Validação",
  "Certificat": "Certificado",

  /* ── Résultats de vérification (ResultatScan + libellés backend) ── */
  "Certificat révoqué": "Certificado revogado",
  "Certificat expiré": "Certificado expirado",
  "Certificat falsifié": "Certificado falsificado",
  "Certificat introuvable": "Certificado não encontrado",
  "Authentique": "Autêntico",
  "Révoqué": "Revogado",
  "Expiré": "Expirado",
  "Falsifié": "Falsificado",
  "Introuvable": "Não encontrado",

  /* ── Types de véhicule ── */
  "Voiture particulière": "Automóvel ligeiro",
  "Utilitaire": "Comercial",
  "Moto / tricycle": "Mota / triciclo",
  "Poids lourd": "Pesado",
  "Bus / transport en commun": "Autocarro / transporte coletivo",
  "Type de véhicule": "Tipo de veículo",
  "Énergie": "Energia",
  "Essence": "Gasolina",
  "Diesel": "Diesel",
  "Electrique": "Elétrico",
  "Hybride": "Híbrido",
  "Gpl": "GPL",

  /* ── Types de signalement ── */
  "Véhicule volé": "Veículo roubado",
  "Véhicule recherché": "Veículo procurado",
  "Opposition administrative": "Oposição administrativa",

  /* ── Niveaux de risque ── */
  "Faible": "Baixo",
  "Moyen": "Médio",
  "Élevé": "Elevado",

  /* ── Méthodes de contrôle ── */
  "Plaque": "Matrícula",

  /* ── Dashboard usager ── */
  "Suivez vos demandes d'immatriculation en temps réel.": "Acompanhe os seus pedidos de matrícula em tempo real.",
  "Aucun dossier pour le moment": "Nenhum processo de momento",
  "Créez votre première demande d'immatriculation.": "Crie o seu primeiro pedido de matrícula.",
  "Créer un dossier": "Criar um processo",
  "Créé le": "Criado a",
  "pièce(s)": "documento(s)",

  /* ── Nouveau dossier ── */
  "Retour à mes dossiers": "Voltar aos meus processos",
  "Nouveau dossier — véhicule": "Novo processo — veículo",
  "Renseignez les caractéristiques du véhicule. Vous ajouterez les pièces à l'étape suivante.":
    "Indique as características do veículo. Adicionará os documentos na etapa seguinte.",
  "Numéro de châssis (VIN)": "Número de chassis (VIN)",
  "17 caractères": "17 caracteres",
  "Marque": "Marca",
  "Modèle": "Modelo",
  "Année": "Ano",
  "Couleur": "Cor",
  "Création impossible. Vérifiez les informations du véhicule.": "Criação impossível. Verifique os dados do veículo.",

  /* ── Vérification publique / hors-ligne ── */
  "Vérification de certificat · Guinée-Bissau": "Verificação de certificado · Guiné-Bissau",
  "Vérification en cours…": "Verificação em curso…",
  "Vérification impossible": "Verificação impossível",
  "Le service est momentanément indisponible. Réessayez dans un instant.":
    "O serviço está temporariamente indisponível. Tente novamente dentro de instantes.",
  "Ministère des Transports — République de Guinée-Bissau": "Ministério dos Transportes — República da Guiné-Bissau",
  "Système National d'Immatriculation et de Contrôle des Véhicules":
    "Sistema Nacional de Matrícula e Controlo de Veículos",
  "Vérification hors-ligne · Guinée-Bissau": "Verificação offline · Guiné-Bissau",
  "Contrôle hors réseau": "Controlo sem rede",
  "Validez la signature d'un certificat localement, sans connexion. Collez le jeton hors-ligne encodé dans le QR du certificat.":
    "Valide localmente a assinatura de um certificado, sem ligação. Cole o código offline contido no QR do certificado.",
  "Vérifier hors-ligne": "Verificar offline",
  "Provisionnement de la clé…": "A obter a chave…",
  "Clé publique à jour (en ligne)": "Chave pública atualizada (online)",
  "Clé publique en cache — prêt hors-ligne": "Chave pública em cache — pronto offline",
  "Clé absente — connectez-vous une fois": "Chave ausente — ligue-se uma vez",
  "Clé publique indisponible. Connectez-vous une fois à Internet pour la provisionner.":
    "Chave pública indisponível. Ligue-se uma vez à Internet para a obter.",
  "Collez le jeton hors-ligne du certificat.": "Cole o código offline do certificado.",
  "Jeton illisible ou malformé. Vérifiez le contenu scanné.": "Código ilegível ou malformado. Verifique o conteúdo lido.",
  "Signature valide. Certificat authentique (vérifié hors-ligne).":
    "Assinatura válida. Certificado autêntico (verificado offline).",
  "Signature valide, mais le certificat a expiré.": "Assinatura válida, mas o certificado expirou.",
  "Signature invalide : ce jeton ne provient pas du SNICV.": "Assinatura inválida: este código não provém do SNICV.",
  "Vérifié hors-ligne": "Verificado offline",
  "Mode hors-ligne : l'authenticité de la signature est garantie, mais une éventuelle révocation récente n'est vérifiable qu'en ligne.":
    "Modo offline: a autenticidade da assinatura é garantida, mas uma eventual revogação recente só é verificável online.",
  "Vérification cryptographique RSA-2048 · SHA-256": "Verificação criptográfica RSA-2048 · SHA-256",

  /* ── Résultat de vérification (carte partagée) ── */
  "Trouvé via immatriculation": "Encontrado por matrícula",
  "Ce véhicule fait l'objet d'un signalement actif.": "Este veículo é objeto de uma sinalização ativa.",
  "Statut": "Estado",
  "Assurance": "Seguro",
  "Contrôle technique": "Inspeção técnica",
  "Émis le": "Emitido a",
  "Aucune donnée à afficher.": "Sem dados a apresentar.",
  "Aucune donnée véhicule n'est communiquée pour ce résultat.":
    "Não são comunicados dados do veículo para este resultado.",
  "Vérifié le": "Verificado a",
  "méthode : immatriculation": "método: matrícula",
};

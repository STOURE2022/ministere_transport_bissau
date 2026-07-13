import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  // Portugais par défaut (langue officielle de Guinée-Bissau) ; l'utilisateur
  // peut basculer en français, choix mémorisé dans localStorage.
  const [lang, setLangState] = useState<Lang>(() => {
    const s = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE) : null;
    return s === "pt" || s === "fr" ? s : "pt";
  });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE, l);
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

  /* ── Certificat (carte premium) ── */
  "Certificat d'immatriculation": "Certificado de matrícula",
  "République de Guinée-Bissau · SNICV": "República da Guiné-Bissau · SNICV",
  "Type": "Tipo",
  "Assurance — échéance": "Seguro — validade",
  "Scannez pour vérifier": "Digitalize para verificar",
  "authenticité en temps réel": "autenticidade em tempo real",
  "Document signé numériquement par le SNICV (RSA-2048). Toute altération invalide la signature.":
    "Documento assinado digitalmente pelo SNICV (RSA-2048). Qualquer alteração invalida a assinatura.",
  "Télécharger le PDF officiel": "Descarregar o PDF oficial",
  "PDF momentanément indisponible.": "PDF temporariamente indisponível.",
  "Jeton copié": "Código copiado",
  "Jeton hors-ligne": "Código offline",
  "Révocation (admin)": "Revogação (admin)",
  "Motif": "Motivo",
  "Révoquer": "Revogar",
  "CERTIFIÉ": "CERTIFICADO",
  "Pour un contrôle sans réseau (/verify-offline)": "Para um controlo sem rede (/verify-offline)",
  "Certificat révoqué —": "Certificado revogado —",
  "Actif": "Ativo",
  "Suspendu": "Suspenso",

  /* ── Déclaration d'un véhicule (SignalerVehiculeCard) ── */
  "Déclarer ce véhicule volé": "Declarar este veículo roubado",
  "Signaler ce véhicule": "Sinalizar este veículo",
  "En cas de vol, alertez immédiatement les autorités.": "Em caso de roubo, alerte imediatamente as autoridades.",
  "Déclarer volé, recherché ou en opposition administrative.":
    "Declarar roubado, procurado ou em oposição administrativa.",
  "Véhicule concerné :": "Veículo em causa:",
  "Type de signalement": "Tipo de sinalização",
  "Référence (dépôt de plainte / PV)": "Referência (queixa / auto)",
  "Circonstances": "Circunstâncias",
  "Volé cette nuit à Bissau": "Roubado esta noite em Bissau",
  "Motif du signalement": "Motivo da sinalização",
  "Déclarer le vol": "Declarar o roubo",
  "Enregistrer le signalement": "Registar a sinalização",
  "Déclaration enregistrée. Le véhicule sera signalé aux forces de l'ordre lors d'un contrôle.":
    "Declaração registada. O veículo será sinalizado às forças da ordem durante um controlo.",
  "Déclaration impossible.": "Declaração impossível.",
  "Ce véhicule n'est pas encore identifiable (ni plaque ni VIN) — déclaration indisponible.":
    "Este veículo ainda não é identificável (sem matrícula nem VIN) — declaração indisponível.",

  /* ── Console forces de l'ordre ── */
  "Forces de l'ordre · Vérification terrain": "Forças da ordem · Verificação no terreno",
  "Scannez le QR du certificat ou saisissez la plaque — même QR abîmé.":
    "Digitalize o QR do certificado ou introduza a matrícula — mesmo com QR danificado.",
  "Scanner le QR": "Digitalizar o QR",
  "Méthode recommandée : l'empreinte encodée prouve l'intégrité des données.":
    "Método recomendado: a impressão codificada prova a integridade dos dados.",
  "Vérifier le QR": "Verificar o QR",
  "Rechercher par immatriculation": "Pesquisar por matrícula",
  "QR illisible ou absent ? Saisissez la plaque : le certificat actif du véhicule est retrouvé.":
    "QR ilegível ou ausente? Introduza a matrícula: o certificado ativo do veículo é recuperado.",
  "Format : deux lettres · quatre chiffres · suffixe régional (BS = Bissau).":
    "Formato: duas letras · quatro dígitos · sufixo regional (BS = Bissau).",
  "Vérifier la plaque": "Verificar a matrícula",
  "QR non reconnu : collez l'URL complète lue par le lecteur.":
    "QR não reconhecido: cole o URL completo lido pelo leitor.",
  "Vérification impossible.": "Verificação impossível.",
  "Résultat de la vérification": "Resultado da verificação",
  "Les véhicules volés sont détectés automatiquement": "Os veículos roubados são detetados automaticamente",
  "Un véhicule déclaré volé ou recherché (par son propriétaire ou par un agent du ministère) déclenche une":
    "Um veículo declarado roubado ou procurado (pelo proprietário ou por um agente do ministério) desencadeia um",
  "alerte rouge": "alerta vermelho",
  "dès qu'il est vérifié ici, par QR ou par plaque. Vous n'avez rien à saisir : contrôlez, l'alerte apparaît.":
    "assim que é verificado aqui, por QR ou por matrícula. Não precisa de introduzir nada: controle, o alerta aparece.",
  "Historique des contrôles": "Histórico dos controlos",
  "Méthode": "Método",
  "Résultat": "Resultado",
  "Lieu": "Local",
  "Horodatage": "Data/hora",
  "Aucun contrôle enregistré pour le moment.": "Nenhum controlo registado de momento.",
  "— inconnue —": "— desconhecida —",
  "Le QR reste la méthode de référence : lui seul prouve l'intégrité cryptographique du certificat.":
    "O QR continua a ser o método de referência: só ele prova a integridade criptográfica do certificado.",

  /* ── Tableau de bord de pilotage ── */
  "Ministère des Transports · Pilotage national": "Ministério dos Transportes · Pilotagem nacional",
  "Tableau de bord national": "Painel de controlo nacional",
  "Vue d'ensemble du parc, des certificats et de l'activité de contrôle en temps réel.":
    "Visão geral do parque, dos certificados e da atividade de controlo em tempo real.",
  "Actualiser": "Atualizar",
  "Certificats actifs": "Certificados ativos",
  "émis": "emitidos",
  "Contrôles effectués": "Controlos efetuados",
  "aujourd'hui": "hoje",
  "Véhicules signalés": "Veículos sinalizados",
  "voir le détail →": "ver o detalhe →",
  "aucun en cours": "nenhum em curso",
  "Taux de fraude": "Taxa de fraude",
  "dossiers à risque élevé": "processos de risco elevado",
  "actif(s)": "ativo(s)",
  "Aucun véhicule signalé actuellement": "Nenhum veículo sinalizado atualmente",
  "Les déclarations des usagers et des agents apparaissent ici en temps réel.":
    "As declarações dos utentes e dos agentes aparecem aqui em tempo real.",
  "Référence": "Referência",
  "Déclaré par": "Declarado por",
  "Action": "Ação",
  "Signalé le": "Sinalizado a",
  "Lever": "Levantar",
  "Motif de levée (véhicule retrouvé, erreur…)": "Motivo de levantamento (veículo recuperado, erro…)",
  "Confirmer la levée": "Confirmar o levantamento",
  "Levée impossible.": "Levantamento impossível.",
  "Cycle des dossiers": "Ciclo dos processos",
  "Certificats émis · 6 mois": "Certificados emitidos · 6 meses",
  "Contrôles par résultat": "Controlos por resultado",
  "Parc par type de véhicule": "Parque por tipo de veículo",
  "Aucun véhicule enregistré.": "Nenhum veículo registado.",
  "Activité de contrôle en direct": "Atividade de controlo em direto",
  "Contrôle public": "Controlo público",
  "Couverture nationale": "Cobertura nacional",
  "véhicules immatriculés · République de Guinée-Bissau": "veículos matriculados · República da Guiné-Bissau",
  "Centres d'immatriculation SNICV": "Centros de matrícula SNICV",

  /* ── Détail dossier (usager) ── */
  "Attestation d'assurance": "Certificado de seguro",
  "Facture d'achat": "Fatura de compra",
  "Certificat délivré": "Certificado emitido",
  "Dossier rejeté": "Processo rejeitado",
  "Pièces justificatives": "Documentos comprovativos",
  "Déposé": "Submetido",
  "Toutes les pièces obligatoires sont déposées.": "Todos os documentos obrigatórios foram submetidos.",
  "pièce(s) obligatoire(s)": "documento(s) obrigatório(s)",
  "manquante(s).": "em falta.",
  "Soumettre le dossier": "Submeter o processo",
  "Marque / Modèle": "Marca / Modelo",
  "Déposé le": "Submetido a",
  "VIN valide": "VIN válido",
  "Assurance valide": "Seguro válido",
  "Contrôle technique valide": "Inspeção técnica válida",
  "Aucun doublon": "Sem duplicado",
  "Niveau de risque": "Nível de risco",
  "Présentez ce QR lors d'un contrôle": "Apresente este QR num controlo",
  "Télécharger le certificat": "Descarregar o certificado",
  "Dossier introuvable.": "Processo não encontrado.",
  "Début / émission": "Início / emissão",
  "Échéance": "Validade",
  "Téléverser": "Carregar",
  "Envoi impossible (format PDF/JPG/PNG, 5 Mo max).": "Envio impossível (formato PDF/JPG/PNG, 5 MB máx.).",

  /* ── Détail dossier (agent) ── */
  "Demandeur": "Requerente",
  "Aucune pièce déposée.": "Nenhum documento submetido.",
  "Historique des décisions": "Histórico das decisões",
  "par": "por",
  "Score de fraude": "Pontuação de fraude",
  "Suite du traitement": "Sequência do tratamento",
  "Étape en cours": "Etapa em curso",
  "Étape": "Etapa",
  "1 · Validation": "1 · Validação",
  "Valider, rejeter ou demander un complément.": "Validar, rejeitar ou pedir um complemento.",
  "2 · Immatriculation": "2 · Matrícula",
  "Attribuer une plaque officielle.": "Atribuir uma matrícula oficial.",
  "3 · Certificat": "3 · Certificado",
  "Émettre le certificat signé RSA-2048 + QR.": "Emitir o certificado assinado RSA-2048 + QR.",
  "Décision": "Decisão",
  "Valider": "Validar",
  "Rejeter": "Rejeitar",
  "Complément": "Complemento",
  "Commentaire (facultatif)": "Comentário (facultativo)",
  "Observation éventuelle…": "Observação eventual…",
  "Valider le dossier": "Validar o processo",
  "Motif du rejet (obligatoire)": "Motivo da rejeição (obrigatório)",
  "Ex. : attestation d'assurance expirée.": "Ex.: certificado de seguro expirado.",
  "Rejeter le dossier": "Rejeitar o processo",
  "Pièce / information demandée (obligatoire)": "Documento / informação pedida (obrigatório)",
  "Ex. : merci de redéposer un contrôle technique lisible.":
    "Ex.: por favor volte a submeter uma inspeção técnica legível.",
  "Le dossier repassera en brouillon pour que l'usager le complète.":
    "O processo voltará a rascunho para que o utente o complete.",
  "Demander un complément": "Pedir um complemento",
  "Le dossier est validé. Attribuez un numéro de plaque officiel pour poursuivre.":
    "O processo está validado. Atribua uma matrícula oficial para continuar.",
  "Attribuer une immatriculation": "Atribuir uma matrícula",
  "Attribuée le": "Atribuída a",
  "Générez le certificat signé (RSA-2048) et son QR de vérification.":
    "Gere o certificado assinado (RSA-2048) e o seu QR de verificação.",
  "Émettre le certificat": "Emitir o certificado",
  "Cycle terminé": "Ciclo terminado",
  "Le certificat est délivré et vérifiable par QR. Voir le détail ci-dessus.":
    "O certificado foi emitido e é verificável por QR. Ver o detalhe acima.",
  "Aucune action requise": "Nenhuma ação necessária",
  "Ce dossier n'est pas encore parvenu à une étape nécessitant un agent.":
    "Este processo ainda não chegou a uma etapa que exija um agente.",
  "Action effectuée.": "Ação efetuada.",
  "Scan public → vérification temps réel": "Leitura pública → verificação em tempo real",
  "Certificat émis": "Certificado emitido",
  "Expire le": "Expira a",
  "Télécharger le PDF": "Descarregar o PDF",

  /* ── File de validation (agent) ── */
  "Espace agent · Instruction des dossiers": "Área do agente · Instrução dos processos",
  "Traitez les demandes d'immatriculation à chaque étape du cycle.":
    "Trate os pedidos de matrícula em cada etapa do ciclo.",
  "À valider": "A validar",
  "En attente de décision": "A aguardar decisão",
  "À immatriculer": "A matricular",
  "Validés": "Validados",
  "À certifier": "A certificar",
  "Immatriculés": "Matriculados",
  "Certifiés": "Certificados",
  "Rechercher : n° dossier, VIN, nom du demandeur…": "Pesquisar: n.º processo, VIN, nome do requerente…",
  "dossier(s)": "processo(s)",
  "Aucun dossier à cette étape": "Nenhum processo nesta etapa",
  "Rien à traiter dans": "Nada a tratar em",
  "pour l'instant.": "de momento.",

  /* ── Scanner QR par caméra ── */
  "Scanner avec la caméra": "Digitalizar com a câmara",
  "Visez le QR du certificat": "Aponte para o QR do certificado",
  "Caméra indisponible. Autorisez l'accès ou saisissez le QR manuellement.":
    "Câmara indisponível. Autorize o acesso ou introduza o QR manualmente.",
  "Fermer": "Fechar",
  "ou collez le lien lu par un autre lecteur": "ou cole a ligação lida por outro leitor",

  /* ── Paiement de la taxe (mobile money) ── */
  "Paiements": "Pagamentos",
  "Retour au dossier": "Voltar ao processo",
  "Paiement de la taxe d'immatriculation": "Pagamento da taxa de matrícula",
  "Dossier": "Processo",
  "Régler par mobile money": "Pagar por mobile money",
  "Total à payer": "Total a pagar",
  "Taxe réglée.": "Taxa paga.",
  "Votre reçu officiel est disponible ci-contre. Il débloque l'émission du certificat.":
    "O seu recibo oficial está disponível ao lado. Desbloqueia a emissão do certificado.",
  "Opérateur mobile money": "Operador mobile money",
  "Numéro mobile money": "Número mobile money",
  "Paiement sécurisé. Vous recevrez une demande de confirmation (USSD) sur votre téléphone pour valider.":
    "Pagamento seguro. Receberá um pedido de confirmação (USSD) no seu telemóvel para validar.",
  "CHIFFRÉ TLS": "CIFRADO TLS",
  "SNICV · TRÉSOR PUBLIC": "SNICV · TESOURO PÚBLICO",
  "REÇU OFFICIEL": "RECIBO OFICIAL",
  "Payer": "Pagar",
  "Paiement impossible. Réessayez.": "Pagamento impossível. Tente novamente.",
  "Reçu de paiement": "Recibo de pagamento",
  "PAYÉ": "PAGO",
  "Montant réglé": "Montante pago",
  "Reçu N°": "Recibo N.º",
  "Opérateur": "Operador",
  "Réf. transaction": "Ref. transação",
  "Date": "Data",
  "Vérifier l'authenticité du reçu": "Verificar a autenticidade do recibo",
  "Paiement confirmé.": "Pagamento confirmado.",
  "Ce reçu débloque l'émission du certificat d'immatriculation.":
    "Este recibo desbloqueia a emissão do certificado de matrícula.",
  "Télécharger le reçu (PDF)": "Descarregar o recibo (PDF)",
  "Reçu momentanément indisponible.": "Recibo temporariamente indisponível.",
  "Votre reçu apparaîtra ici": "O seu recibo aparecerá aqui",
  "Une fois le paiement confirmé, un reçu officiel signé (référence + QR de vérification) est généré instantanément.":
    "Após a confirmação do pagamento, é gerado instantaneamente um recibo oficial assinado (referência + QR de verificação).",
  "Montant": "Montante",
  "Reçu": "Recibo",

  /* ── Journal des paiements (agent / admin) ── */
  "Paiements de la taxe": "Pagamentos da taxa",
  "Suivez tous les règlements de la taxe d'immatriculation réglés par mobile money.":
    "Acompanhe todos os pagamentos da taxa de matrícula efetuados por mobile money.",
  "Configuration": "Configuração",
  "Paiements réglés": "Pagamentos efetuados",
  "Total encaissé": "Total recebido",
  "En attente": "Pendente",
  "Journal des paiements": "Registo de pagamentos",
  "Reçu, dossier, nom…": "Recibo, processo, nome…",
  "Tous": "Todos",
  "Réglés": "Pagos",
  "Aucun paiement": "Nenhum pagamento",
  "Aucun règlement ne correspond à ce filtre.": "Nenhum pagamento corresponde a este filtro.",
  "Payé": "Pago",
  "Échoué": "Falhado",

  /* ── Configuration des paiements (admin) ── */
  "Configuration des paiements": "Configuração dos pagamentos",
  "Montants, devise et opérateurs de la taxe d'immatriculation — rien n'est codé en dur, tout se règle ici.":
    "Montantes, moeda e operadores da taxa de matrícula — nada está fixo no código, tudo se define aqui.",
  "Barème & devise": "Tabela & moeda",
  "Taxe d'immatriculation": "Taxa de matrícula",
  "Timbre fiscal": "Selo fiscal",
  "Frais de service": "Taxa de serviço",
  "Devise": "Moeda",
  "Exiger le paiement avant le certificat": "Exigir o pagamento antes do certificado",
  "Si activé, l'agent ne peut émettre le certificat qu'après règlement de la taxe.":
    "Se ativado, o agente só pode emitir o certificado após o pagamento da taxa.",
  "Barème enregistré": "Tabela guardada",
  "Enregistrer le barème": "Guardar a tabela",
  "Opérateurs mobile money": "Operadores mobile money",
  "Ajouter": "Adicionar",
  "Nom (ex. Wave)": "Nome (ex. Wave)",
  "Code (ex. WAVE)": "Código (ex. WAVE)",
  "Code USSD (ex. #144#)": "Código USSD (ex. #144#)",
  "Créer l'opérateur": "Criar o operador",
  "Aucun opérateur configuré.": "Nenhum operador configurado.",
  "Inactif": "Inativo",
  "Supprimer": "Eliminar",
  "Seuls les opérateurs actifs sont proposés à l'usager au moment du paiement.":
    "Apenas os operadores ativos são propostos ao utente no momento do pagamento.",

  /* ── Carte paiement (détail dossier usager) ── */
  "Réglée": "Paga",
  "Montant à payer": "Montante a pagar",
  "Payée": "Paga",
  "Voir le reçu": "Ver o recibo",
  "Payer la taxe": "Pagar a taxa",
};

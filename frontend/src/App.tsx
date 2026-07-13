import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { accueilPourRole, habilitationEnAttente, type Role } from "@/lib/types";
import AccueilPublic from "@/pages/Accueil";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import RegisterChoix from "@/pages/RegisterChoix";
import RegisterControle from "@/pages/RegisterControle";
import VerifyOtp from "@/pages/VerifyOtp";
import HabilitationEnAttente from "@/pages/HabilitationEnAttente";
import Habilitations from "@/pages/Habilitations";
import HabilitationDetail from "@/pages/HabilitationDetail";
import HabilitationsCorps from "@/pages/HabilitationsCorps";
import Dashboard from "@/pages/Dashboard";
import NouveauDossier from "@/pages/NouveauDossier";
import DossierDetail from "@/pages/DossierDetail";
import Notifications from "@/pages/Notifications";
import Historique from "@/pages/Historique";
import Paiement from "@/pages/Paiement";
import Paiements from "@/pages/Paiements";
import PaiementsConfig from "@/pages/PaiementsConfig";
import Amendes from "@/pages/Amendes";
import Infractions from "@/pages/Infractions";
import NouveauPV from "@/pages/NouveauPV";
import InfractionsConfig from "@/pages/InfractionsConfig";
import AgentDashboard from "@/pages/AgentDashboard";
import AgentDossier from "@/pages/AgentDossier";
import PilotageDashboard from "@/pages/PilotageDashboard";
import ControleForceOrdre from "@/pages/ControleForceOrdre";
import VerifyPublic from "@/pages/VerifyPublic";
import VerifyOffline from "@/pages/VerifyOffline";

function Ecran({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      {children}
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Ecran>
        <Loader2 className="size-6 animate-spin" />
      </Ecran>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Restreint une route à certains rôles ; sinon redirige vers l'accueil du rôle. */
function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={accueilPourRole(user.role)} replace />;
  return <>{children}</>;
}

/**
 * Bloque un agent de contrôle dont l'habilitation n'est pas encore validée :
 * il voit l'écran « demande en attente » au lieu des fonctions de contrôle.
 * Les agents/admin (jamais « en attente ») passent sans changement.
 */
function ControleGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (habilitationEnAttente(user)) return <HabilitationEnAttente />;
  return <>{children}</>;
}

/**
 * Accueil « / » :
 * - visiteur anonyme → page d'accueil publique premium,
 * - usager connecté → son tableau de bord,
 * - personnel connecté → son espace dédié.
 */
function Accueil() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Ecran>
        <Loader2 className="size-6 animate-spin" />
      </Ecran>
    );
  }
  if (!user) return <AccueilPublic />;
  if (user.role !== "USAGER") return <Navigate to={accueilPourRole(user.role)} replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterChoix />} />
        <Route path="/register/usager" element={<Register />} />
        <Route path="/register/controle" element={<RegisterControle />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />

        {/* Vérification publique d'un certificat (cible du QR) — sans authentification */}
        <Route path="/verify/:uuid" element={<VerifyPublic />} />

        {/* Vérification hors-ligne (signature validée localement) — sans authentification */}
        <Route path="/verify-offline" element={<VerifyOffline />} />

        {/* Page d'accueil publique, toujours accessible (même connecté) */}
        <Route path="/accueil" element={<AccueilPublic />} />

        {/* Accueil public (anonyme) ou espace selon le rôle (connecté) */}
        <Route path="/" element={<Accueil />} />
        <Route
          path="/dossiers/nouveau"
          element={
            <Protected>
              <RequireRole roles={["USAGER"]}>
                <NouveauDossier />
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/dossiers/:id"
          element={
            <Protected>
              <RequireRole roles={["USAGER"]}>
                <DossierDetail />
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/notifications"
          element={
            <Protected>
              <RequireRole roles={["USAGER"]}>
                <Notifications />
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/dossiers/:id/cycle-de-vie"
          element={
            <Protected>
              <RequireRole roles={["USAGER"]}>
                <Historique />
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/dossiers/:id/paiement"
          element={
            <Protected>
              <RequireRole roles={["USAGER"]}>
                <Paiement />
              </RequireRole>
            </Protected>
          }
        />

        {/* Paiements de la taxe (agent / admin) + configuration (admin) */}
        <Route
          path="/paiements"
          element={
            <Protected>
              <RequireRole roles={["AGENT", "ADMIN"]}>
                <Paiements />
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/paiements/configuration"
          element={
            <Protected>
              <RequireRole roles={["ADMIN"]}>
                <PaiementsConfig />
              </RequireRole>
            </Protected>
          }
        />

        {/* Amendes (usager) */}
        <Route
          path="/amendes"
          element={
            <Protected>
              <RequireRole roles={["USAGER"]}>
                <Amendes />
              </RequireRole>
            </Protected>
          }
        />

        {/* Infractions & procès-verbaux (forces de l'ordre / agent / admin) */}
        <Route
          path="/infractions"
          element={
            <Protected>
              <RequireRole roles={["FORCE_ORDRE", "AGENT", "ADMIN"]}>
                <ControleGate>
                  <Infractions />
                </ControleGate>
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/infractions/nouveau"
          element={
            <Protected>
              <RequireRole roles={["FORCE_ORDRE", "AGENT", "ADMIN"]}>
                <ControleGate>
                  <NouveauPV />
                </ControleGate>
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/infractions/configuration"
          element={
            <Protected>
              <RequireRole roles={["ADMIN"]}>
                <InfractionsConfig />
              </RequireRole>
            </Protected>
          }
        />

        {/* Pilotage national (agent / admin) */}
        <Route
          path="/pilotage"
          element={
            <Protected>
              <RequireRole roles={["AGENT", "ADMIN"]}>
                <PilotageDashboard />
              </RequireRole>
            </Protected>
          }
        />

        {/* Espace agent / admin */}
        <Route
          path="/agent"
          element={
            <Protected>
              <RequireRole roles={["AGENT", "ADMIN"]}>
                <AgentDashboard />
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/agent/dossiers/:id"
          element={
            <Protected>
              <RequireRole roles={["AGENT", "ADMIN"]}>
                <AgentDossier />
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/agent/dossiers/:id/cycle-de-vie"
          element={
            <Protected>
              <RequireRole roles={["AGENT", "ADMIN"]}>
                <Historique />
              </RequireRole>
            </Protected>
          }
        />

        {/* Habilitations des corps de contrôle (agent / admin) */}
        <Route
          path="/agent/habilitations"
          element={
            <Protected>
              <RequireRole roles={["AGENT", "ADMIN"]}>
                <Habilitations />
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/agent/habilitations/corps"
          element={
            <Protected>
              <RequireRole roles={["ADMIN"]}>
                <HabilitationsCorps />
              </RequireRole>
            </Protected>
          }
        />
        <Route
          path="/agent/habilitations/:id"
          element={
            <Protected>
              <RequireRole roles={["AGENT", "ADMIN"]}>
                <HabilitationDetail />
              </RequireRole>
            </Protected>
          }
        />

        {/* Forces de l'ordre */}
        <Route
          path="/controle"
          element={
            <Protected>
              <RequireRole roles={["FORCE_ORDRE", "AGENT", "ADMIN"]}>
                <ControleGate>
                  <ControleForceOrdre />
                </ControleGate>
              </RequireRole>
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { accueilPourRole, type Role } from "@/lib/types";
import AccueilPublic from "@/pages/Accueil";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import VerifyOtp from "@/pages/VerifyOtp";
import Dashboard from "@/pages/Dashboard";
import NouveauDossier from "@/pages/NouveauDossier";
import DossierDetail from "@/pages/DossierDetail";
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
        <Route path="/register" element={<Register />} />
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

        {/* Forces de l'ordre */}
        <Route
          path="/controle"
          element={
            <Protected>
              <RequireRole roles={["FORCE_ORDRE", "AGENT", "ADMIN"]}>
                <ControleForceOrdre />
              </RequireRole>
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

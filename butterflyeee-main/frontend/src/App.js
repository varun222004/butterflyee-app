import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AppShell from "@/components/atmosphere/AppShell";
import ButterflyCursor from "@/components/atmosphere/ButterflyCursor";
import AuthPage from "@/pages/AuthPage";
import OnboardingPage from "@/pages/OnboardingPage";
import ConnectPage from "@/pages/ConnectPage";
import HomePage from "@/pages/HomePage";
import RoomPage from "@/pages/RoomPage";
import SettingsPage from "@/pages/SettingsPage";

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bf-script text-2xl text-[rgba(244,237,224,0.5)]">opening quietly…</div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Loading/>;
  if (user === null) return <Navigate to="/auth/login" replace state={{ from: location }}/>;
  if (!user.onboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <Loading/>;
  if (user) return <Navigate to={user.onboarded ? "/" : "/onboarding"} replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/auth/login"    element={<RedirectIfAuthed><AuthPage mode="login"/></RedirectIfAuthed>} />
      <Route path="/auth/register" element={<RedirectIfAuthed><AuthPage mode="register"/></RedirectIfAuthed>} />

      {/* Onboarding & Connect — auth required, no AppShell */}
      <Route path="/onboarding" element={<RequireAuth><OnboardingPage/></RequireAuth>} />
      <Route path="/connect"    element={<RequireAuth><ConnectPage/></RequireAuth>} />

      {/* App — uses AppShell */}
      <Route element={<RequireAuth><AppShell/></RequireAuth>}>
        <Route index element={<HomePage world="my"/>} />
        <Route path="/my"               element={<HomePage world="my"/>} />
        <Route path="/my/:roomKey"      element={<RoomPage world="my"/>} />
        <Route path="/buddy"            element={<HomePage world="buddy"/>} />
        <Route path="/buddy/:roomKey"   element={<RoomPage world="buddy"/>} />
        <Route path="/our"              element={<HomePage world="our"/>} />
        <Route path="/our/:roomKey"     element={<RoomPage world="our"/>} />
        <Route path="/settings"         element={<SettingsPage/>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ButterflyCursor />
        <AppRoutes />
        <Toaster theme="dark" toastOptions={{ unstyled: false }} />
      </BrowserRouter>
    </AuthProvider>
  );
}

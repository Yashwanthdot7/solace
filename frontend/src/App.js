import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import "@/App.css";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Feed from "@/pages/Feed";
import Guardian from "@/pages/Guardian";
import Chat from "@/pages/Chat";
import Games from "@/pages/Games";
import Events from "@/pages/Events";
import Mindfulness from "@/pages/Mindfulness";
import Journal from "@/pages/Journal";
import ResetPassword from "@/pages/ResetPassword";
import Settings from "@/pages/Settings";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import { Toaster } from "sonner";

function PageWrap({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.76, 0, 0.24, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const loc = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={loc} key={loc.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/settings" element={<Private><PageWrap><Settings /></PageWrap></Private>} />
        <Route path="/dashboard" element={<Private><PageWrap><Dashboard /></PageWrap></Private>} />
        <Route path="/feed" element={<Private><PageWrap><Feed /></PageWrap></Private>} />
        <Route path="/guardian" element={<Private><PageWrap><Guardian /></PageWrap></Private>} />
        <Route path="/chat" element={<Private><PageWrap><Chat /></PageWrap></Private>} />
        <Route path="/games" element={<Private><PageWrap><Games /></PageWrap></Private>} />
        <Route path="/events" element={<Private><PageWrap><Events /></PageWrap></Private>} />
        <Route path="/mindfulness" element={<Private><PageWrap><Mindfulness /></PageWrap></Private>} />
        <Route path="/journal" element={<Private><PageWrap><Journal /></PageWrap></Private>} />
      </Routes>
    </AnimatePresence>
  );
}

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#080808] text-[#C8F04B] flex items-center justify-center font-display text-4xl">SOLACE.</div>;
  if (!user) return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-right" />
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

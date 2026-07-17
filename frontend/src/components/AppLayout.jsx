import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import MitraOrb from "@/components/MitraOrb";
import LaggingCursor from "@/components/Cursor";

const NAV = [
  { to: "/dashboard", label: "Home" },
  { to: "/feed", label: "Feed" },
  { to: "/guardian", label: "Guardian" },
  { to: "/chat", label: "Chat" },
  { to: "/games", label: "Games" },
  { to: "/events", label: "Events" },
  { to: "/mindfulness", label: "Mindful" },
  { to: "/journal", label: "Journal" },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-30 bg-[#080808]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
          <Link to="/dashboard" className="font-display text-3xl tracking-tight">
            SOLACE<span className="text-[#C8F04B]">.</span>
          </Link>
          <nav className="hidden lg:flex gap-6">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} data-testid={`nav-${n.label.toLowerCase()}`}
                className={`label-mono transition ${loc.pathname === n.to ? "text-[#C8F04B]" : "text-[#A0A0A0] hover:text-white"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="label-mono text-[#C8F04B]">{user?.points ?? 0} pts</p>
              <p className="label-mono text-[#A0A0A0]">{user?.name?.split(" ")[0]}</p>
            </div>
            <button onClick={() => { logout(); nav("/"); }} data-testid="logout-btn"
              className="label-mono text-[#A0A0A0] hover:text-white">Exit</button>
          </div>
        </div>
        <nav className="lg:hidden flex gap-4 overflow-x-auto no-scrollbar px-6 pb-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`label-mono whitespace-nowrap ${loc.pathname === n.to ? "text-[#C8F04B]" : "text-[#A0A0A0]"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main>{children}</main>
      <MitraOrb />
      <LaggingCursor />
    </div>
  );
}

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import MitraOrb from "@/components/MitraOrb";
import LaggingCursor from "@/components/Cursor";
import { HelplineDialog } from "@/components/HelplineCard";
import { useState } from "react";

// Role-specific nav configs
const NAV_BY_ROLE = {
  elder: [
    { to: "/dashboard", label: "Home" },
    { to: "/feed", label: "Feed" },
    { to: "/mindfulness", label: "Mindful" },
    { to: "/journal", label: "Journal" },
    { to: "/games", label: "Games" },
    { to: "/events", label: "Events" },
    { to: "/chat", label: "Chat" },
  ],
  youth: [
    { to: "/dashboard", label: "Home" },
    { to: "/feed", label: "Feed" },
    { to: "/events", label: "Events" },
    { to: "/games", label: "Games" },
    { to: "/mindfulness", label: "Mindful" },
    { to: "/journal", label: "Journal" },
    { to: "/chat", label: "Chat" },
    { to: "/profile", label: "Profile" },
  ],
  community: [
    { to: "/dashboard", label: "Command" },
    { to: "/feed",      label: "Feed" },
    { to: "/events",    label: "Events" },
    { to: "/chat",      label: "Chat" },
    { to: "/games",     label: "Games" },
    { to: "/journal",   label: "Journal" },
    { to: "/members",   label: "Members" },
  ],
  guardian: [
    { to: "/dashboard", label: "Monitor" },
    { to: "/guardian",  label: "Members" },
    { to: "/feed",      label: "Feed" },
    { to: "/events",    label: "Events" },
    { to: "/chat",      label: "Chat" },
  ],
};

// Role accent colours
const ROLE_COLOR = {
  elder: "#F2A68A",
  youth: "#C8F04B",
  community: "#8BBF7A",
  guardian: "#E8854A",
};

const ROLE_LABEL = {
  elder: "Elder",
  youth: "Youth",
  community: "Organiser",
  guardian: "Guardian",
};

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const role = user?.role || "elder";
  const NAV = NAV_BY_ROLE[role] || NAV_BY_ROLE.elder;
  const accent = ROLE_COLOR[role];
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-30 bg-[#080808]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-5 flex items-center justify-between">
          {/* Brand + role badge */}
          <Link to="/dashboard" className="flex items-center gap-3">
            <span className="font-display text-3xl tracking-tight">
              SOLACE<span style={{ color: accent }}>.</span>
            </span>
            <span
              className="hidden md:inline label-mono text-xs px-2 py-0.5 rounded-full border"
              style={{ color: accent, borderColor: accent + "40", background: accent + "12" }}>
              {ROLE_LABEL[role]}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex gap-6">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} data-testid={`nav-${n.label.toLowerCase()}`}
                className="label-mono transition"
                style={{ color: loc.pathname === n.to ? accent : undefined }}
                onMouseOver={e => { if (loc.pathname !== n.to) e.target.style.color = "white"; }}
                onMouseOut={e => { if (loc.pathname !== n.to) e.target.style.color = "#A0A0A0"; }}>
                {n.label}
              </Link>
            ))}
          </nav>

          {/* User info + logout */}
          <div className="flex items-center gap-4">
            <button onClick={() => setHelpOpen(true)} data-testid="need-help-btn"
              className="text-xs font-semibold text-[#080808] bg-[#F5F1E8] px-3 py-1.5 rounded-sm hover:bg-white transition whitespace-nowrap">
              Need help now?
            </button>
            <div className="hidden md:block text-right">
              <p className="label-mono text-xs" style={{ color: accent }}>{user?.points ?? 0} pts</p>
              <p className="label-mono text-xs text-[#A0A0A0]">{user?.name?.split(" ")[0]}</p>
            </div>
            <button onClick={() => { logout(); nav("/"); }} data-testid="logout-btn"
              className="label-mono text-[#A0A0A0] hover:text-white transition text-xs border border-[#222] px-3 py-1.5 rounded-sm hover:border-white/30">
              Exit
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="lg:hidden flex gap-4 overflow-x-auto no-scrollbar px-6 pb-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to}
              className="label-mono whitespace-nowrap text-sm transition"
              style={{ color: loc.pathname === n.to ? accent : "#A0A0A0" }}>
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main>{children}</main>
      <MitraOrb />
      <LaggingCursor />
      <HelplineDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

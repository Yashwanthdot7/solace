import { useAuth } from "@/contexts/AuthContext";
import DashboardElder from "./DashboardElder";
import DashboardYouth from "./DashboardYouth";
import DashboardCommunity from "./DashboardCommunity";
import DashboardGuardian from "./DashboardGuardian";

/**
 * Smart dashboard router — renders the correct dashboard based on user.role.
 * Roles: elder | youth | community | guardian
 */
export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || "elder";

  if (role === "youth")     return <DashboardYouth />;
  if (role === "community") return <DashboardCommunity />;
  if (role === "guardian")  return <DashboardGuardian />;
  return <DashboardElder />;
}

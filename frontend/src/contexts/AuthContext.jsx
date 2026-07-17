import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("solace_token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem("solace_token"))
      .finally(() => setLoading(false));
  }, []);

  /** Register — creates account with email_verified=false, sends OTP email.
   *  Does NOT return a JWT. Call verifyOtp() after the user enters the code. */
  const register = async (payload) => {
    const r = await api.post("/auth/register", payload);
    return r.data; // { sent: true, email: "...", message: "..." }
  };

  /** Resend OTP for an unverified email */
  const sendOtp = async (email) => {
    const r = await api.post("/auth/send-otp", { email });
    return r.data;
  };

  /** Verify OTP — marks email as verified and issues JWT */
  const verifyOtp = async (email, otp) => {
    const r = await api.post("/auth/verify-otp", { email, otp });
    localStorage.setItem("solace_token", r.data.access_token);
    setUser(r.data.user);
    return r.data.user;
  };

  /** Login with email + password */
  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("solace_token", r.data.access_token);
    setUser(r.data.user);
    return r.data.user;
  };

  /** Send forgot-password email */
  const forgotPassword = async (email) => {
    const r = await api.post("/auth/forgot-password", { email });
    return r.data;
  };

  /** Reset password using the token from the reset email link */
  const resetPassword = async (token, newPassword) => {
    const r = await api.post("/auth/reset-password", { token, new_password: newPassword });
    return r.data;
  };

  const logout = () => {
    localStorage.removeItem("solace_token");
    setUser(null);
  };

  const refresh = async () => {
    const r = await api.get("/auth/me");
    setUser(r.data);
  };

  return (
    <AuthCtx.Provider value={{
      user, loading,
      login, register, logout, refresh, setUser,
      sendOtp, verifyOtp,
      forgotPassword, resetPassword,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { login as apiLogin, logout as apiLogout } from "./api";

interface AuthCtx {
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("ss_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp * 1000 > Date.now()) {
          setUsername(payload.sub);
        } else {
          localStorage.removeItem("ss_token");
        }
      } catch {
        localStorage.removeItem("ss_token");
      }
    }
  }, []);

  async function login(u: string, p: string) {
    await apiLogin(u, p);
    const token = localStorage.getItem("ss_token")!;
    const payload = JSON.parse(atob(token.split(".")[1]));
    setUsername(payload.sub);
    router.push("/dashboard");
  }

  function logout() {
    setUsername(null);
    apiLogout();
  }

  return (
    <AuthContext.Provider
      value={{ username, isAuthenticated: !!username, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

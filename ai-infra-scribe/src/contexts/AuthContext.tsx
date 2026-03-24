import { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
}

const TEST_USERS: Record<string, AuthUser> = {
  admin: {
    id: "1",
    name: "Platform Engineer",
    email: "platform.engineer@miraclesoft.ai",
    role: "admin",
    initials: "PE",
  },
  user: {
    id: "2",
    name: "Product Development",
    email: "product.dev@miraclesoft.ai",
    role: "user",
    initials: "PD",
  },
};

interface AuthContextType {
  user: AuthUser | null;
  login: (role: UserRole) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = (role: UserRole) => setUser(TEST_USERS[role]);
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
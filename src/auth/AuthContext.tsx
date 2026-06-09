import React, { createContext, useContext } from 'react';

export type UserRole = 'owner' | 'manager' | 'cashier' | 'server' | 'customer' | 'kitchen';

type AuthContextValue = {
  role: UserRole;
  isGuest: boolean;
  logout: () => void;
};

const AuthRoleContext = createContext<AuthContextValue>({
  role: 'customer',
  isGuest: false,
  logout: () => {},
});

export function AuthRoleProvider({
  role,
  isGuest = false,
  logout,
  children,
}: {
  role: UserRole;
  isGuest?: boolean;
  logout: () => void;
  children: React.ReactNode;
}) {
  return <AuthRoleContext.Provider value={{ role, isGuest, logout }}>{children}</AuthRoleContext.Provider>;
}

export function useUserRole() {
  return useContext(AuthRoleContext).role;
}

export function useAuth() {
  return useContext(AuthRoleContext);
}

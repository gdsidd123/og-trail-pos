import React, { createContext, useContext } from 'react';

export type UserRole = 'owner' | 'manager' | 'cashier' | 'server';

const AuthRoleContext = createContext<UserRole>('server');

export function AuthRoleProvider({ role, children }: { role: UserRole; children: React.ReactNode }) {
  return <AuthRoleContext.Provider value={role}>{children}</AuthRoleContext.Provider>;
}

export function useUserRole() {
  return useContext(AuthRoleContext);
}

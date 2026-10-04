import { createContext, useContext } from 'react';
export type User = { userId: string; name: string; email: string; role: string; organization?: string; permissions?: string[] };
export type Route = { page: string; id?: string };
export const AppContext = createContext<{ user: User | null | undefined; navigate: (page: string, id?: string) => void; requireAuth: () => boolean; toast: (message: string, error?: boolean) => void }>({ user: null, navigate: () => {}, requireAuth: () => false, toast: () => {} });
export const useApp = () => useContext(AppContext);
export const isOperator = (user?: User | null) => !!user && ['admin', 'operator', 'curator', 'administrator', 'rops'].includes(user.role);

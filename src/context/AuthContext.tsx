import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Profile } from '@/types';
import { fetchProfile } from '@/lib/api';

export interface User {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  adminUsername: string | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  adminLogin: (username: string, password: string) => Promise<void>;
  adminLogout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [adminUsername, setAdminUsername] = useState<string | null>(() => localStorage.getItem('fairplay_admin_username'));
  const [loading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('fairplay_user');
    if (!savedUser) return;
    const parsedUser = JSON.parse(savedUser) as User;
    setUser(parsedUser);
    fetchProfile(parsedUser.id).then(setProfile).catch(() => setProfile(null));
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    void password;
    void username;
    const newUser = { id: crypto.randomUUID(), email };
    localStorage.setItem('fairplay_user', JSON.stringify(newUser));
    setUser(newUser);
    fetchProfile(newUser.id).then(setProfile).catch(() => setProfile(null));
  };

  const signIn = async (email: string, password: string) => {
    void password;
    const newUser = { id: crypto.randomUUID(), email };
    localStorage.setItem('fairplay_user', JSON.stringify(newUser));
    setUser(newUser);
    fetchProfile(newUser.id).then(setProfile).catch(() => setProfile(null));
  };

  const signOut = async () => {
    localStorage.removeItem('fairplay_user');
    setUser(null);
    setProfile(null);
  };

  const adminLogin = async (username: string, password: string) => {
    const response = await fetch('http://127.0.0.1:8000/api/admin/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Administrator login failed');
    localStorage.setItem('fairplay_admin_token', data.token);
    localStorage.setItem('fairplay_admin_username', data.username);
    setAdminUsername(data.username);
  };

  const adminLogout = () => {
    localStorage.removeItem('fairplay_admin_token');
    localStorage.removeItem('fairplay_admin_username');
    setAdminUsername(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, adminUsername, loading, signUp, signIn, signOut, adminLogin, adminLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

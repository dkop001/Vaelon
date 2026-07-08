import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const AuthContext = createContext({});

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project.supabase.co')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch {
        setUser(null);
      }
      setLoading(false);
    };

    getSession();

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (event === 'SIGNED_UP') setIsNewUser(true);
      });
      return () => subscription.unsubscribe();
    } catch {
      // subscription failed
    }
  }, []);

  const signUp = async (email, password) => {
    if (!supabase) throw new Error('Authentication not available in local mode');
    return supabase.auth.signUp({ email, password });
  };

  const signIn = async (email, password) => {
    if (!supabase) throw new Error('Authentication not available in local mode');
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    if (!supabase) return;
    return supabase.auth.signOut();
  };

  const clearNewUserFlag = () => setIsNewUser(false);

  return (
    <AuthContext.Provider value={{ user, signUp, signIn, signOut, loading, isNewUser, clearNewUserFlag }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};

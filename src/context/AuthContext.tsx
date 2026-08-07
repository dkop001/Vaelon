import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../ipc/client';

const AuthContext = createContext<any>({});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initLocalUser = async () => {
      try {
        const onboardingComplete = await api.configGet('onboarding_complete');
        const onboardingStepStr = await api.configGet('onboarding_step');
        
        setUser({
          id: 'local_user',
          email: 'developer@vaelon.app',
          user_metadata: {
            onboarding_complete: onboardingComplete === 'true',
            onboarding_step: onboardingStepStr ? parseInt(onboardingStepStr) : 1,
          },
        });
      } catch (err) {
        setUser({
          id: 'local_user',
          email: 'developer@vaelon.app',
          user_metadata: {
            onboarding_complete: true,
            onboarding_step: 5,
          },
        });
      }
      setLoading(false);
    };

    initLocalUser();
  }, []);

  const signUp = async () => {
    return { data: { user } };
  };

  const signIn = async () => {
    return { data: { user } };
  };

  const signOut = async () => {
    setUser(null);
  };

  const clearNewUserFlag = () => {};

  return (
    <AuthContext.Provider value={{ user, signUp, signIn, signOut, loading, isNewUser: false, clearNewUserFlag }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};

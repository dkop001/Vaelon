import { api } from '../ipc/client';

export const supabase = {
  auth: {
    updateUser: async (params: any) => {
      const data = params?.data || {};
      if (data.onboarding_complete !== undefined) {
        await api.configSet('onboarding_complete', data.onboarding_complete ? 'true' : 'false');
      }
      if (data.onboarding_step !== undefined) {
        await api.configSet('onboarding_step', data.onboarding_step.toString());
      }
      return { data: { user: null }, error: null };
    }
  }
};

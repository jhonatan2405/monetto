import { create } from 'zustand';
import { supabase } from '../services/supabase';

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  role: null,
  loading: true,

  initializeAuth: async () => {
    set({ loading: true });
    
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      // Fetch user role from public.users table
      const { data: userData, error } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', session.user.id)
        .single();
        
      if (userData && !error) {
        set({ 
          user: session.user, 
          session, 
          role: userData.role,
          loading: false 
        });
      } else {
        // Handle case where user exists in Auth but not in public.users (should happen via trigger, but safety check)
        set({ user: session.user, session, role: 'empleado', loading: false });
      }
    } else {
      set({ user: null, session: null, role: null, loading: false });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
          
        set({ 
          user: session.user, 
          session, 
          role: userData?.role || 'empleado',
          loading: false 
        });
      } else {
        set({ user: null, session: null, role: null, loading: false });
      }
    });
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null, session: null, role: null });
  },
}));

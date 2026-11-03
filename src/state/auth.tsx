import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
}

export interface Member {
  userId: string;
  displayName: string;
}

interface AuthState {
  /** False until the stored session and household have been checked. */
  ready: boolean;
  session: Session | null;
  household: Household | null;
  members: Member[];
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<'signed-in' | 'check-email'>;
  signOut(): Promise<void>;
  createHousehold(name: string, displayName: string): Promise<void>;
  joinHousehold(code: string, displayName: string): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const loadHousehold = useCallback(async (s: Session | null) => {
    if (!s) {
      setHousehold(null);
      setMembers([]);
      return;
    }
    const sb = client();
    const { data: membership } = await sb
      .from('household_members')
      .select('household_id, households (id, name, invite_code)')
      .eq('user_id', s.user.id)
      .limit(1)
      .maybeSingle();
    const h = membership?.households as unknown as
      | { id: string; name: string; invite_code: string }
      | undefined;
    if (!h) {
      setHousehold(null);
      setMembers([]);
      return;
    }
    setHousehold({ id: h.id, name: h.name, inviteCode: h.invite_code });
    const { data: people } = await sb
      .from('household_members')
      .select('user_id, display_name')
      .eq('household_id', h.id);
    setMembers((people ?? []).map((p) => ({ userId: p.user_id, displayName: p.display_name })));
  }, []);

  useEffect(() => {
    const sb = client();
    let active = true;
    sb.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadHousehold(data.session);
      if (active) setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      void loadHousehold(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadHousehold]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      household,
      members,
      async signIn(email, password) {
        const { error } = await client().auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(email, password) {
        const { data, error } = await client().auth.signUp({ email, password });
        if (error) throw error;
        return data.session ? 'signed-in' : 'check-email';
      },
      async signOut() {
        await client().auth.signOut();
      },
      async createHousehold(name, displayName) {
        const { error } = await client().rpc('create_household', {
          p_name: name,
          p_display_name: displayName,
        });
        if (error) throw error;
        await loadHousehold(session);
      },
      async joinHousehold(code, displayName) {
        const { error } = await client().rpc('join_household', {
          p_code: code,
          p_display_name: displayName,
        });
        if (error) throw error;
        await loadHousehold(session);
      },
    }),
    [ready, session, household, members, loadHousehold],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Auth state, or null when the app runs in local-only mode. */
export function useAuth(): AuthState | null {
  return useContext(AuthContext);
}

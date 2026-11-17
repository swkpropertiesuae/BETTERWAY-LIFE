import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const backendConfigured = Boolean(url && key);

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined;
export const turnstileConfigured = Boolean(turnstileSiteKey);

export const APP_ENV = ((process.env.NEXT_PUBLIC_APP_ENV as string | undefined) ?? 'development').toLowerCase();

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!backendConfigured) throw new Error('Supabase is not configured');
  client ??= createClient(url!, key!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'estate-os:auth',
    },
  });
  return client;
}

export function functionsUrl(name: string): string {
  return `${url}/functions/v1/${name}`;
}

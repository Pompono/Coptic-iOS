import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createDeletionHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } };
const admin = createClient(url, serviceKey, options);
function checked<T>({ data, error }: { data: T; error: unknown }): T { if (error) throw new Error('Backend operation failed'); return data; }

Deno.serve(createDeletionHandler({
  async ready() {
    return Deno.env.get('ACCOUNT_DELETION_ENABLED') === 'true'
      && checked(await admin.rpc('account_deletion_ready')) === true;
  },
  async verify(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user;
  },
  async verifyPassword(email, password) {
    const verifier = createClient(url, anonKey, options);
    const { data, error } = await verifier.auth.signInWithPassword({ email, password });
    if (error) return null;
    const id = data.user?.id ?? null;
    // Revoke the temporary verification session; never return it to the device.
    if (data.session) await verifier.auth.signOut({ scope: 'local' });
    return id;
  },
  async receipt(hash) {
    return checked(await admin.from('account_deletion_requests').select('user_id, locked_until').eq('receipt_hash', hash).maybeSingle());
  },
  async claim(userId, hash) { return checked(await admin.rpc('claim_account_deletion', { p_user_id: userId, p_receipt_hash: hash })) === true; },
  async objects(userId) { return checked(await admin.rpc('account_deletion_objects', { p_user_id: userId })); },
  async removeObjects(bucket, paths) { checked(await admin.storage.from(bucket).remove(paths)); },
  async deleteUser(userId) { checked(await admin.auth.admin.deleteUser(userId, false)); },
}, (Deno.env.get('ACCOUNT_DELETION_ALLOWED_ORIGINS') ?? 'capacitor://localhost').split(',').map(value => value.trim()).filter(Boolean)));

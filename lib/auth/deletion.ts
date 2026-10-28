import { getDeletionState, getPasswordRecoveryContext, getSupabaseClient, supabasePublishableKey, supabaseUrl } from './client';

const errors: Record<string, string> = {
  authentication_required: 'Your sign-in expired. Sign in again, then retry deletion.',
  verification_failed: 'Your password could not be verified. Check it and try again.',
  identity_mismatch: 'The signed-in account does not match this deletion request.',
  confirmation_required: 'Enter your current password and type DELETE to confirm.',
  unavailable: 'Account deletion is unavailable. Please try again later.',
  processing: 'Deletion is still processing. Wait two minutes, then check its status.',
  retry: 'Deletion could not be confirmed. Check its status before retrying. Local progress is safe.',
};

export async function deletionRequest(action: 'ready' | 'status' | 'delete', receipt?: string, password?: string, expectedUserId?: string): Promise<string> {
  if (!navigator.onLine) throw new Error('You are offline. Connect to the internet to check or delete your account. Local progress is safe.');
  let token: string | undefined;
  if (action === 'delete') {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw new Error(errors.authentication_required);
    if (data.session.user.id !== expectedUserId) throw new Error(errors.identity_mismatch);
    token = data.session.access_token;
  }
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/account-deletion`, {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', apikey: supabasePublishableKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, ...(receipt ? { receipt } : {}), ...(action === 'delete' ? { password, confirmation: 'DELETE' } : {}) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(errors[data.state] ?? errors.unavailable);
    if (!['available', 'not_started', 'processing', 'retry', 'deleted'].includes(data.state)) throw new Error(errors.retry);
    return data.state;
  } catch (failure) {
    if (failure instanceof Error && Object.values(errors).includes(failure.message)) throw failure;
    throw new Error('The connection timed out or failed. Deletion is not yet confirmed. Check deletion status when online; your local progress is safe.');
  }
}

export async function finishAccountDeletion() {
  const state = await getDeletionState();
  const pending = await state.read();
  if (!pending) return;
  // Caller must have received a positive backend receipt status before calling.
  await state.revoke(pending.userId);
  window.dispatchEvent(new Event('coptic-account-deleted'));
  const client = await getSupabaseClient();
  await client.auth.stopAutoRefresh();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new Error('Your account was deleted, but session cleanup needs another attempt. Check deletion status again.');
  await (await getPasswordRecoveryContext()).clear();
  await state.finish(pending.userId);
  window.dispatchEvent(new Event('coptic-account-deletion-finished'));
}

let deleting = false;
export async function deleteCurrentAccount(userId: string, password: string) {
  if (deleting) throw new Error('A deletion request is already running.');
  deleting = true;
  try {
    const state = await getDeletionState();
    const pending = await state.begin(userId);
    window.dispatchEvent(new Event('coptic-progress-sync-optout'));
    const result = await deletionRequest('delete', pending.receipt, password, userId);
    if (result !== 'deleted') throw new Error(errors[result] ?? errors.retry);
    await finishAccountDeletion();
  } finally { deleting = false; }
}

export async function checkAccountDeletion() {
  const pending = await (await getDeletionState()).read();
  if (!pending) return 'none';
  const result = await deletionRequest('status', pending.receipt);
  if (result === 'deleted') await finishAccountDeletion();
  return result;
}

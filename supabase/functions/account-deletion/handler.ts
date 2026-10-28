export type DeletionBackend = {
  ready(): Promise<boolean>;
  verify(token: string): Promise<{ id: string; email?: string } | null>;
  verifyPassword(email: string, password: string): Promise<string | null>;
  receipt(hash: string): Promise<{ user_id: string | null; locked_until: string } | null>;
  claim(userId: string, hash: string): Promise<boolean>;
  objects(userId: string): Promise<{ bucket_id: string; name: string }[]>;
  removeObjects(bucket: string, paths: string[]): Promise<void>;
  deleteUser(userId: string): Promise<void>;
};

export function createDeletionHandler(backend: DeletionBackend, origins: string[]) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origin && origins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type';
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    }
    const respond = (status: number, state: string) => new Response(JSON.stringify({ state }), { status, headers });
    if (origin && !origins.includes(origin)) return respond(403, 'origin_rejected');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond(405, 'method_rejected');
    try {
      // Bound the stream, not just the client-supplied Content-Length header.
      const reader = request.body?.getReader();
      if (!reader) return respond(400, 'invalid_request');
      let raw = ''; let bytes = 0; const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) { await reader.cancel(); return respond(413, 'invalid_request'); }
        raw += decoder.decode(value, { stream: true });
      }
      const body = JSON.parse(raw + decoder.decode());
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => !['action', 'receipt', 'password', 'confirmation'].includes(key))) return respond(400, 'invalid_request');
      if (body.action === 'ready') {
        const ready = await backend.ready();
        return respond(ready ? 200 : 503, ready ? 'available' : 'unavailable');
      }
      if (!['delete', 'status'].includes(body.action) || !/^[a-f0-9]{64}$/.test(body.receipt ?? '')) return respond(400, 'invalid_request');
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.receipt));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const prior = await backend.receipt(hash);
      if (body.action === 'status') {
        if (!prior) return respond(200, 'not_started');
        return respond(200, prior.user_id === null ? 'deleted' : Date.parse(prior.locked_until) > Date.now() ? 'processing' : 'retry');
      }
      const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if (!token) return respond(401, 'authentication_required');
      const user = await backend.verify(token);
      if (!user?.email) return respond(401, 'authentication_required');
      if (prior && prior.user_id !== user.id) return respond(403, 'identity_mismatch');
      if (body.confirmation !== 'DELETE' || typeof body.password !== 'string' || !body.password || body.password.length > 1024) return respond(400, 'confirmation_required');
      if (await backend.verifyPassword(user.email, body.password) !== user.id) return respond(403, 'verification_failed');
      if (!await backend.ready()) return respond(503, 'unavailable');
      if (!await backend.claim(user.id, hash)) return respond(409, 'processing');
      // Bounded cleanup, retried with the same receipt after the lease expires.
      for (let batch = 0; batch < 20; batch++) {
        const objects = await backend.objects(user.id);
        if (!objects.length) {
          await backend.deleteUser(user.id);
          const result = await backend.receipt(hash);
          return result?.user_id === null ? respond(200, 'deleted') : respond(503, 'retry');
        }
        for (const bucket of new Set(objects.map(object => object.bucket_id))) {
          await backend.removeObjects(bucket, objects.filter(object => object.bucket_id === bucket).map(object => object.name));
        }
      }
      return respond(503, 'retry');
    } catch {
      // Never log/return passwords, bearer tokens, receipt capabilities or server details.
      return respond(503, 'retry');
    }
  };
}

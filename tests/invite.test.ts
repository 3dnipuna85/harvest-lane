import { describe, expect, it } from 'vitest';
import { forgetKeys } from '../src/server/admin';
import { handleInvite, inviteEmail } from '../src/server/invite';
import type { KV } from '../src/server/payments';

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
async function signer() {
  forgetKeys();
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const get = async () => ({ json: async () => ({ keys: [{ kid: 'inv', kty: 'RSA', n: jwk.n, e: jwk.e }] }) });
  const token = async (claims: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const hp = enc({ alg: 'RS256', kid: 'inv' }) + '.' + enc({ aud: 'farm', iss: 'https://securetoken.google.com/farm', iat: now, exp: now + 600, sub: 'p1', name: 'Ann <b>', email: 'ann@x.com', ...claims });
    return hp + '.' + Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(hp))).toString('base64url');
  };
  return { get, token };
}
function memKV(): KV & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
}

describe('invite emails', () => {
  it('sends through Brevo with the inviter from their sign-in, and limits repeats', async () => {
    const { get, token } = await signer();
    const kv = memKV();
    kv.m.set('secret:brevo', 'xkeysib-test'); kv.m.set('settings', JSON.stringify({ mailFrom: 'game@farm.test' }));
    const env = { PURCHASES: kv, FIREBASE_PROJECT_ID: 'farm' };
    const sent: { headers: Record<string, string>; body: { to: { email: string }[]; htmlContent: string; sender: { email: string } } }[] = [];
    const mail = async (_u: string, i: RequestInit) => { sent.push({ headers: i.headers as Record<string, string>, body: JSON.parse(i.body as string) }); return new Response('{}', { status: 201 }); };
    const send = async (to: string) => (await handleInvite(new Request('https://harvest-lane.pages.dev/api/invite-email', { method: 'POST', headers: { authorization: 'Bearer ' + await token() }, body: JSON.stringify({ to }) }), env, get, mail)).json() as Promise<{ ok?: boolean; error?: string }>;
    expect(await send('Bob@Y.com')).toEqual({ ok: true });
    expect(sent[0].body.to[0].email).toBe('bob@y.com');
    expect(sent[0].body.sender.email).toBe('game@farm.test');
    expect(sent[0].headers['api-key']).toBe('xkeysib-test');
    expect(sent[0].body.htmlContent).toContain('https://harvest-lane.pages.dev/?friend=p1');
    expect(sent[0].body.htmlContent).toContain('Ann &lt;b&gt;');
    expect(await send('bob@y.com')).toEqual({ error: 'already' });
    expect(await send('ann@x.com')).toEqual({ error: 'self' });
    expect(await send('not an email')).toEqual({ error: 'bademail' });
    for (const n of [1, 2, 3, 4]) expect(await send(`f${n}@y.com`)).toEqual({ ok: true });
    expect(await send('f5@y.com')).toEqual({ error: 'limit' });
    expect(sent.length).toBe(5);
  });
  it('says when email isn\'t set up, and refuses players who aren\'t signed in', async () => {
    const { get, token } = await signer();
    const env = { PURCHASES: memKV(), FIREBASE_PROJECT_ID: 'farm' };
    const r = await handleInvite(new Request('https://x/api/invite-email', { method: 'POST', headers: { authorization: 'Bearer ' + await token() }, body: '{"to":"a@b.com"}' }), env, get);
    expect(r.status).toBe(503);
    expect((await handleInvite(new Request('https://x/api/invite-email', { method: 'POST', body: '{}' }), env, get)).status).toBe(401);
  });
  it('builds a friendly email', () => {
    const m = inviteEmail('', 'https://g/?friend=1');
    expect(m.subject).toContain('A friend invited you');
    expect(m.text).toContain('https://g/?friend=1');
  });
});

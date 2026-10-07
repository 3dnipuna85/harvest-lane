import { describe, expect, it } from 'vitest';
import { forgetKeys } from '../src/server/admin';
import { handleMsg, handleRun, handleSave, handleUnsub, nextDue, SEEN_MS, vapid, vapidAuth } from '../src/server/notify';
import type { KV } from '../src/server/payments';

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
async function signer() {
  forgetKeys();
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const get = async () => ({ json: async () => ({ keys: [{ kid: 'n', kty: 'RSA', n: jwk.n, e: jwk.e }] }) });
  const token = async (claims: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const hp = enc({ alg: 'RS256', kid: 'n' }) + '.' + enc({ aud: 'farm', iss: 'https://securetoken.google.com/farm', iat: now, exp: now + 600, sub: 'p1', name: 'Ann Lee', email: 'ann@x.com', email_verified: true, ...claims });
    return hp + '.' + Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(hp))).toString('base64url');
  };
  return { get, token };
}
function memKV(): KV & { m: Map<string, string>; meta: Map<string, unknown> } {
  const m = new Map<string, string>(), meta = new Map<string, unknown>();
  return {
    m, meta, get: async k => m.get(k) ?? null,
    put: async (k, v, o) => { m.set(k, v); meta.set(k, o?.metadata); },
    delete: async k => { m.delete(k); meta.delete(k); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name, metadata: meta.get(name) })), list_complete: true }),
  };
}

describe('farm alerts', () => {
  it('saves alert times, then sends one email and one push when due and the player is away', async () => {
    const { get, token } = await signer();
    const kv = memKV();
    kv.m.set('secret:brevo', 'xkeysib-test'); kv.m.set('settings', JSON.stringify({ mailFrom: 'game@farm.test' })); kv.m.set('secret:cron', 'ck');
    const env = { PURCHASES: kv, FIREBASE_PROJECT_ID: 'farm' };
    const t = Date.now();
    const save = async (body: unknown) => (await handleSave(new Request('https://g.test/api/notify/save', { method: 'POST', headers: { authorization: 'Bearer ' + await token() }, body: JSON.stringify(body) }), env, get, t)).json();
    expect(await save({ at: { sick: t + 60_000, rot: t + 120_000 }, push: true, sub: { endpoint: 'https://push.example/abc' } })).toEqual({ email: true, emailOk: true, push: true });
    const sent: { url: string; init: RequestInit }[] = [];
    const send = async (url: string, init: RequestInit) => { sent.push({ url, init }); return new Response('{}', { status: 201 }); };
    const run = (at: number, k = 'ck') => handleRun(new Request('https://g.test/api/notify/run?k=' + k), env, send, at);
    expect((await run(t + 61_000, 'wrong')).status).toBe(403);
    // still playing: nothing goes out
    expect(await (await run(t + 61_000)).json()).toMatchObject({ emails: 0, pushes: 0 });
    // the player leaves
    await save({ at: { sick: t + 60_000, rot: t + 120_000 }, away: true });
    expect(await (await run(t + 61_000)).json()).toMatchObject({ emails: 1, pushes: 1 });
    const mail = JSON.parse(sent[0].init.body as string);
    expect(mail.to[0].email).toBe('ann@x.com');
    expect(mail.subject).toContain('hungry');
    expect(mail.htmlContent).toContain('/api/notify/unsub?u=p1&amp;s=');
    expect(sent[1].url).toBe('https://push.example/abc');
    expect((sent[1].init.headers as Record<string, string>).Authorization).toMatch(/^vapid t=.+, k=/);
    // the service worker learns what the push was about
    expect(await (await handleMsg(new Request('https://g.test/api/notify/msg', { method: 'POST', body: JSON.stringify({ endpoint: 'https://push.example/abc' }) }), env, t + 62_000)).json()).toMatchObject({ title: expect.stringContaining('hungry') });
    // the crops alert: push waits 3 hours between pushes of a kind, but this is the other kind
    expect(await (await run(t + 121_000)).json()).toMatchObject({ emails: 1, pushes: 1 });
    // nothing more for the same alerts
    expect(await (await run(t + 200_000)).json()).toMatchObject({ emails: 0, pushes: 0 });
    // unsubscribe turns emails off
    const link = mail.textContent.match(/Unsubscribe: (\S+)/)[1];
    expect(await (await handleUnsub(new Request(link), env)).text()).toContain('unsubscribed');
    expect(JSON.parse(kv.m.get('n:p1')!).emailOn).toBe(false);
    expect(await (await handleUnsub(new Request('https://g.test/api/notify/unsub?u=p1&s=bad'), env)).text()).toContain('not valid');
  });
  it('waits while the player is still playing and skips unverified emails', () => {
    const r = { email: 'a@b', emailOk: false, name: '', at: { sick: 1000 }, seen: 500, emailOn: true, pushOn: false, sent: {}, mailDay: {}, pushAt: {} };
    expect(nextDue(r)).toBe(0);
    expect(nextDue({ ...r, emailOk: true })).toBe(500 + SEEN_MS);
    expect(nextDue({ ...r, emailOk: true, seen: 0 })).toBe(1000);
  });
  it('signs VAPID headers that verify with the public key', async () => {
    const kv = memKV(), v = await vapid(kv);
    expect(await vapid(kv)).toEqual(v);
    const h = await vapidAuth(v, 'https://fcm.googleapis.com/fcm/send/x', 'mailto:a@b.c');
    const [, jwt] = h.match(/t=([^,]+)/)!, [hd, body, sig] = jwt.split('.');
    const pub = await crypto.subtle.importKey('raw', Buffer.from(v.pub, 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, Buffer.from(sig, 'base64url'), new TextEncoder().encode(hd + '.' + body))).toBe(true);
    expect(JSON.parse(Buffer.from(body, 'base64url').toString()).aud).toBe('https://fcm.googleapis.com');
  });
});

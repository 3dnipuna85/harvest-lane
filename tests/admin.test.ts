import { describe, expect, it } from 'vitest';
import { forgetKeys, handleAdmin, OWNER_HASHES, verifyAdmin } from '../src/server/admin';
import { cleanSettings, livePacks } from '../src/data/settings';
import type { KV } from '../src/server/payments';

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
let n = 0;
async function setup() {
  const kid = 'k' + ++n;
  forgetKeys();
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const get = async () => ({ json: async () => ({ keys: [{ kid, kty: 'RSA', n: jwk.n, e: jwk.e }] }) });
  const token = async (claims: Record<string, unknown>) => {
    const now = Math.floor(Date.now() / 1000);
    const hp = enc({ alg: 'RS256', kid }) + '.' + enc({ aud: 'farm', iss: 'https://securetoken.google.com/farm', iat: now, exp: now + 600, email: 'Boss@Example.com', email_verified: true, ...claims });
    const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(hp))).toString('base64url');
    return hp + '.' + sig;
  };
  return { get, token };
}
const req = (tok: string, init: RequestInit = {}) => new Request('https://x/api/admin', { ...init, headers: { authorization: 'Bearer ' + tok, ...(init.headers || {}) } });
function memKV(): KV & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
}
const ENV = { FIREBASE_PROJECT_ID: 'farm', ADMIN_EMAILS: 'boss@example.com' };

describe('admin page server', () => {
  it('lets only the listed, verified Google account in', async () => {
    const { get, token } = await setup();
    expect(await verifyAdmin(req(await token({})), ENV, get)).toEqual({ email: 'boss@example.com' });
    expect(await verifyAdmin(req(await token({ email: 'someone@else.com' })), ENV, get)).toMatchObject({ status: 403 });
    expect(await verifyAdmin(req(await token({ aud: 'other' })), ENV, get)).toMatchObject({ status: 401 });
    expect(await verifyAdmin(req(await token({ exp: 1 })), ENV, get)).toMatchObject({ status: 401 });
    const t = await token({});
    expect(await verifyAdmin(req(t.slice(0, -4) + 'AAAA'), ENV, get)).toMatchObject({ status: 401 });
    expect(await verifyAdmin(req(t), { FIREBASE_PROJECT_ID: 'farm' }, get)).toMatchObject({ status: 403 });
  });
  it('always lets the owner in, with no Cloudflare setup', async () => {
    const { get, token } = await setup();
    // The owner is matched by a hash of the email; add one for a made-up owner.
    OWNER_HASHES.push(Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('owner@farm.test'))).toString('hex'));
    const t = await token({ aud: 'harvest-lane-b6dcd', iss: 'https://securetoken.google.com/harvest-lane-b6dcd', email: 'Owner@Farm.test' });
    expect(await verifyAdmin(req(t), {}, get)).toEqual({ email: 'owner@farm.test' });
    OWNER_HASHES.pop();
  });
  it('saves settings and a write-only webhook secret', async () => {
    const { get, token } = await setup();
    const env = { ...ENV, PURCHASES: memKV() };
    const body = JSON.stringify({ settings: { news: 'Hello farmers', packs: { pouch: { usd: 5.99, link: 'https://cgsapiens.lemonsqueezy.com/buy/abc' }, chest: { link: 'https://evil.example/x' } } }, webhookSecret: 'a-very-long-secret-value' });
    const r = await (await handleAdmin(req(await token({}), { method: 'POST', body }), env, get)).json() as { settings: { news: string; packs: Record<string, { usd?: number; link?: string }> }; secrets: { webhook: boolean } };
    expect(r.settings.news).toBe('Hello farmers');
    expect(r.settings.packs.pouch).toEqual({ usd: 5.99, link: 'https://cgsapiens.lemonsqueezy.com/buy/abc' });
    expect(r.settings.packs.chest.link).toBeUndefined();
    expect(r.secrets.webhook).toBe(true);
    expect(JSON.stringify(r)).not.toContain('a-very-long-secret-value');
  });
  it('connects Lemon Squeezy with an API key: links, prices and the webhook', async () => {
    const { get, token } = await setup();
    const env = { ...ENV, PURCHASES: memKV() };
    const calls: { url: string; method: string; body?: string }[] = [];
    const ls = async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method || 'GET', body: init.body as string | undefined });
      const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
      if (url.endsWith('/stores')) return ok([{ id: '9', attributes: { name: 'cgsapiens' } }]);
      if (url.includes('/products')) return ok([
        { id: '1', attributes: { name: 'Pouch of Diamonds', price: 499, status: 'published', test_mode: true, buy_now_url: 'https://cgsapiens.lemonsqueezy.com/buy/pp' } },
        { id: '2', attributes: { name: 'Vault of Diamonds', price: 2499, status: 'published', test_mode: true, buy_now_url: 'https://cgsapiens.lemonsqueezy.com/buy/vv' } },
        { id: '3', attributes: { name: 'Something else', price: 100, status: 'published', test_mode: true, buy_now_url: 'https://cgsapiens.lemonsqueezy.com/buy/xx' } },
      ]);
      if (url.includes('/webhooks?')) return ok([{ id: '50', attributes: { url: 'https://x/api/ls-webhook' } }]);
      if (url.endsWith('/webhooks/50')) return new Response(null, { status: 204 });
      if (url.endsWith('/webhooks')) return ok({ id: '77', attributes: {} });
      return new Response('{}', { status: 404 });
    };
    const r = await (await handleAdmin(req(await token({}), { method: 'POST', body: JSON.stringify({ lsApiKey: 'test-key-0123456789abcdefghij' }) }), env, get, ls)).json() as
      { lemon: { ok: boolean; webhook: string; missing: string[] }; settings: { allowTest: boolean; packs: Record<string, { testLink?: string; usd?: number }> }; secrets: { lsApi: boolean; webhook: boolean } };
    expect(r.lemon.ok).toBe(true);
    expect(r.settings.packs.pouch.testLink).toBe('https://cgsapiens.lemonsqueezy.com/buy/pp');
    expect(r.settings.packs.vault.usd).toBe(24.99);
    expect(r.settings.allowTest).toBe(true);
    expect(r.lemon.webhook).toBe('created');
    expect(r.lemon.missing).toContain('Starter Pack');
    expect(calls.some(c => c.method === 'DELETE' && c.url.endsWith('/webhooks/50'))).toBe(true);
    const made = JSON.parse(calls.find(c => c.method === 'POST')!.body!);
    expect(made.data.attributes.secret).toBe(env.PURCHASES.m.get('secret:ls_webhook'));
    expect(made.data.attributes.test_mode).toBe(true);
    expect(r.secrets).toMatchObject({ lsApi: true, webhook: true });
    expect(JSON.stringify(r)).not.toContain('test-key-0123456789');
  });
  it('applies pack changes and hides switched-off packs', () => {
    const live = livePacks(cleanSettings({ packs: { handful: { off: true }, vault: { gems: 2500 } } }));
    expect(live.find(p => p.id === 'handful')).toBeUndefined();
    expect(live.find(p => p.id === 'vault')!.gems).toBe(2500);
  });
});

import { describe, expect, it } from 'vitest';
import { handleClaim, handleWebhook, signBody, type KV } from '../src/server/payments';

function memKV(): KV & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return {
    m,
    get: async k => m.get(k) ?? null,
    put: async (k, v) => { m.set(k, v); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }),
  };
}
const SECRET = 'test-secret', BUYER = '0123456789abcdef0123456789abcdef';
const event = (name: string, o: Record<string, unknown> = {}) => JSON.stringify({
  meta: { event_name: name, custom_data: { buyer: BUYER, pack: 'chest' } },
  data: { id: '777', attributes: { status: 'paid', subtotal_usd: 999, total_usd: 1099, ...o } },
});
const post = async (body: string, sig?: string) => new Request('https://x/api/ls-webhook', { method: 'POST', body, headers: { 'x-signature': sig ?? await signBody(SECRET, body) } });
const claim = (env: { PURCHASES: KV }) => handleClaim(new Request('https://x/api/claim', { method: 'POST', body: JSON.stringify({ buyer: BUYER }) }), env).then(r => r.json());

describe('lemon squeezy payments', () => {
  it('refuses unsigned or wrongly signed events', async () => {
    const env = { PURCHASES: memKV(), LS_WEBHOOK_SECRET: SECRET };
    expect((await handleWebhook(await post(event('order_created'), 'deadbeef'), env)).status).toBe(401);
    expect((await handleWebhook(await post(event('order_created'), await signBody('other', event('order_created'))), env)).status).toBe(401);
    expect(env.PURCHASES.m.size).toBe(0);
  });
  it('files a paid order once and hands it over once', async () => {
    const env = { PURCHASES: memKV(), LS_WEBHOOK_SECRET: SECRET };
    expect((await handleWebhook(await post(event('order_created')), env)).status).toBe(200);
    await handleWebhook(await post(event('order_created')), env); // Lemon Squeezy retry
    expect(env.PURCHASES.m.size).toBe(1);
    expect(await claim(env)).toEqual({ orders: [{ id: '777', pack: 'chest' }] });
    expect(await claim(env)).toEqual({ orders: [] });
  });
  it('takes test-mode orders only while testing is switched on', async () => {
    const body = event('order_created').replace('"custom_data"', '"test_mode":true,"custom_data"');
    const env = { PURCHASES: memKV(), LS_WEBHOOK_SECRET: SECRET };
    await handleWebhook(await post(body), env);
    expect(env.PURCHASES.m.size).toBe(0);
    await handleWebhook(await post(body), { ...env, LS_ALLOW_TEST: '1' });
    expect(env.PURCHASES.m.size).toBe(1);
  });
  it('ignores underpaid, unpaid and refunded orders', async () => {
    const env = { PURCHASES: memKV(), LS_WEBHOOK_SECRET: SECRET };
    await handleWebhook(await post(event('order_created', { subtotal_usd: 199 })), env);
    await handleWebhook(await post(event('order_created', { status: 'pending' })), env);
    expect(env.PURCHASES.m.size).toBe(0);
    await handleWebhook(await post(event('order_created')), env);
    await handleWebhook(await post(event('order_refunded')), env);
    expect(await claim(env)).toEqual({ orders: [] });
  });
});

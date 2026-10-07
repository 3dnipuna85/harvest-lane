/**
 * The admin page (/admin): change pack prices and checkout links, payment settings, the support email, news and
 * Double XP events, and see recent orders. Sign-in is Google (Firebase Auth); the server (functions/api/admin.ts)
 * checks the account against the ADMIN_EMAILS Cloudflare variable before reading or saving anything.
 */
import './admin.css';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { firebaseConfig, onlineEnabled } from '../online/config';
import { PACKS } from '../data/store';
import type { GameSettings } from '../data/settings';
import type { Order } from '../server/payments';

interface AdminData {
  email: string; settings: GameSettings; secrets: { webhook: boolean; webhookFromCloudflare: boolean };
  testFromCloudflare: boolean; orders: (Order & { buyer: string })[];
}

const app = document.getElementById('app')!, who = document.getElementById('who')!;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const show = (html: string) => { app.innerHTML = html; };
let user: User | null = null;
let data: AdminData | null = null;
// Local preview with made-up data (npm run dev, then /admin.html?preview). Stripped from the real build.
const preview = import.meta.env.DEV && location.search.includes('preview');
async function previewCall(body?: unknown): Promise<AdminData & { error?: string }> {
  const b = body as { settings?: GameSettings } | undefined;
  if (b?.settings) data = { ...data!, settings: { ...b.settings, updatedAt: Date.now() } };
  return data ?? { email: 'owner@example.com', settings: { packs: { pouch: { testLink: 'https://cgsapiens.lemonsqueezy.com/buy/test-123' } }, allowTest: true, supportEmail: '', news: '', xpEventUntil: 0, updatedAt: 0 },
    secrets: { webhook: false, webhookFromCloudflare: false }, testFromCloudflare: false,
    orders: [{ id: '1001', pack: 'pouch', at: Date.now() - 3600_000, cents: 499, test: true, claimed: Date.now(), buyer: 'x' }, { id: '1002', pack: 'chest', at: Date.now() - 600_000, cents: 999, buyer: 'y' }] };
}

async function call(body?: unknown) {
  if (preview) return previewCall(body);
  const r = await fetch('/api/admin', {
    method: body ? 'POST' : 'GET',
    headers: { authorization: 'Bearer ' + await user!.getIdToken(), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({ error: 'server' }));
  return j as AdminData & { error?: string };
}

function problem(err: string) {
  const fix: Record<string, string> = {
    notadmin: `<p>You're signed in as <b>${esc(user?.email)}</b>, which isn't an admin of this game. Sign out and sign in with the owner's Google account.</p>`,
    nokv: `<p>You're signed in as the owner ✓. One thing is missing: <b>storage</b> for settings and orders. Cloudflare needs it connected once, then this page works:</p>
      <ol class="steps">
        <li>Open <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener">dash.cloudflare.com</a> → <b>Workers &amp; Pages</b> → <b>harvest-lane</b> → <b>Settings</b> → <b>Bindings</b>.</li>
        <li>Click <b>Add</b> → <b>KV namespace</b>.</li>
        <li>Variable name: <code>PURCHASES</code>. For the namespace, choose <b>Create new</b> and call it <code>harvest-purchases</code>. Save.</li>
        <li>Go to <b>Deployments</b>, open the latest one and click <b>Retry deployment</b>. When it finishes, reload this page.</li>
      </ol>`,
    signin: '<p>Your sign-in expired. Reload the page and sign in again.</p>',
  };
  show(`<section><h2>Can't open the admin page</h2>${fix[err] ?? `<p>The server didn't answer (${esc(err)}). If the site was just deployed, wait a minute and reload.</p>`}</section>`);
}

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function render(d: AdminData) {
  const s = d.settings, t = Date.now();
  const packs = PACKS.map(p => {
    const o = s.packs[p.id] ?? {};
    return `<div class="pack" data-pack="${p.id}">
      <h3><span>${esc(p.name)}${p.once ? ' <span class="muted">(one per player)</span>' : ''}</span><label class="check" style="margin:0"><input type="checkbox" name="on" ${o.off ? '' : 'checked'}> On sale</label></h3>
      <div class="row">
        <div><label>Price (US$)</label><input type="number" name="usd" step="0.01" min="0.5" value="${o.usd ?? p.usd}"></div>
        <div><label>Diamonds</label><input type="number" name="gems" step="1" min="1" value="${o.gems ?? p.gems}"></div>
      </div>
      <label>Live checkout link <span class="muted">(Lemon Squeezy product → Share)</span></label><input type="url" name="link" placeholder="https://cgsapiens.lemonsqueezy.com/buy/…" value="${esc(o.link || p.link || '')}">
      <label>Test-mode checkout link</label><input type="url" name="testLink" placeholder="https://cgsapiens.lemonsqueezy.com/buy/…" value="${esc(o.testLink || p.testLink || '')}">
    </div>`;
  }).join('');
  const orders = d.orders.length ? `<div class="wrap"><table><thead><tr><th>When</th><th>Pack</th><th>Paid</th><th>Status</th><th>Order</th></tr></thead><tbody>${d.orders.map(o => `<tr>
      <td>${esc(when(o.at))}</td><td>${esc(PACKS.find(p => p.id === o.pack)?.name ?? o.pack)}</td>
      <td>${o.cents ? '$' + (o.cents / 100).toFixed(2) : '–'}${o.test ? ' <span class="warn">test</span>' : ''}</td>
      <td>${o.refunded ? '<span class="warn">Refunded</span>' : o.claimed ? '<span class="ok">Delivered</span>' : 'Waiting for the player'}</td>
      <td>#${esc(o.id)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No orders yet.</p>';
  const evOn = s.xpEventUntil > t;
  show(`
  <section><h2>Setup</h2><ul class="steps">
    <li class="ok">✓ Storage connected and you're signed in as an admin.</li>
    <li class="${d.secrets.webhook ? 'ok' : 'warn'}">${d.secrets.webhook ? '✓ Webhook signing secret is saved' + (d.secrets.webhookFromCloudflare ? ' (from Cloudflare)' : '') + '.' : '✗ No webhook signing secret yet: add it under Payments below.'}</li>
    <li class="${PACKS.some(p => (s.packs[p.id]?.link || p.link)) ? 'ok' : 'warn'}">${PACKS.some(p => (s.packs[p.id]?.link || p.link)) ? '✓ At least one pack has a live checkout link.' : '✗ No live checkout links yet, so the shop shows “soon”.'}</li>
    <li>Webhook URL for Lemon Squeezy: <code>${esc(location.origin)}/api/ls-webhook</code> (events: order_created, order_refunded)</li>
  </ul></section>

  <section><h2>Diamond packs</h2><p class="muted">Changes reach players within about 10 minutes, or when they reload. The price here must match the price of the Lemon Squeezy product, because orders that paid less are not delivered.</p>${packs}</section>

  <section><h2>Payments</h2>
    <label class="check"><input type="checkbox" id="allowTest" ${s.allowTest ? 'checked' : ''}> Accept test payments (fake cards)</label>
    <p class="muted">Turn this on only while testing. Players test with the game link ending in <code>?testpay</code>. ${d.testFromCloudflare ? '<span class="warn">The Cloudflare variable LS_ALLOW_TEST=1 also turns this on; delete it when you go live.</span>' : ''}</p>
    <label>Webhook signing secret</label>
    <input type="password" id="secret" autocomplete="new-password" placeholder="${d.secrets.webhook ? 'Saved. Type a new one only to replace it.' : 'The secret you typed in Lemon Squeezy → Webhooks'}">
    <p class="muted">Write-only: it's kept on the server and never shown again, not even here. At least 16 characters.</p>
  </section>

  <section><h2>Store details</h2>
    <label>Support email <span class="muted">(shown on the Pricing, Terms, Privacy, Refund and Contact pages)</span></label>
    <input type="email" id="email" value="${esc(s.supportEmail)}" placeholder="help@example.com">
  </section>

  <section><h2>Events and news</h2>
    <label>News message <span class="muted">(every player sees it once when they open the game; leave empty for none)</span></label>
    <textarea id="news" maxlength="280">${esc(s.news)}</textarea>
    <label>Double XP for everyone</label>
    <div class="row"><select id="xpev">
      <option value="keep">${evOn ? 'Running until ' + esc(when(s.xpEventUntil)) : 'Off'}</option>
      ${evOn ? '<option value="0">Stop it now</option>' : ''}
      <option value="1">Start for 1 hour</option><option value="3">Start for 3 hours</option>
      <option value="24">Start for 24 hours</option><option value="48">Start for 2 days</option><option value="72">Start for 3 days</option>
    </select></div>
  </section>

  <section><h2>Recent orders</h2>${orders}</section>
  <div class="bar"><span id="msg" class="muted">${s.updatedAt ? 'Last saved ' + esc(when(s.updatedAt)) : 'Not saved yet'}</span><button class="primary" id="save">Save changes</button></div>`);
  document.getElementById('save')!.onclick = save;
}

async function save() {
  const s = structuredClone(data!.settings), msg = document.getElementById('msg')!;
  s.packs = {};
  document.querySelectorAll<HTMLElement>('[data-pack]').forEach(el => {
    const v = (n: string) => (el.querySelector(`[name=${n}]`) as HTMLInputElement);
    s.packs[el.dataset.pack!] = { usd: +v('usd').value, gems: +v('gems').value, link: v('link').value.trim(), testLink: v('testLink').value.trim(), off: !v('on').checked };
  });
  s.allowTest = (document.getElementById('allowTest') as HTMLInputElement).checked;
  s.supportEmail = (document.getElementById('email') as HTMLInputElement).value.trim();
  s.news = (document.getElementById('news') as HTMLTextAreaElement).value.trim();
  const ev = (document.getElementById('xpev') as HTMLSelectElement).value;
  if (ev !== 'keep') s.xpEventUntil = ev === '0' ? 0 : Date.now() + +ev * 3600_000;
  const secret = (document.getElementById('secret') as HTMLInputElement).value.trim();
  if (secret && secret.length < 16) { msg.textContent = 'The webhook secret needs at least 16 characters.'; msg.className = 'warn'; return; }
  msg.textContent = 'Saving…'; msg.className = 'muted';
  const r = await call({ settings: s, ...(secret ? { webhookSecret: secret } : {}) });
  if (r.error) { msg.textContent = 'Not saved: ' + r.error; msg.className = 'warn'; return; }
  // The server drops anything invalid, such as a link that isn't a Lemon Squeezy page; say so.
  const dropped = PACKS.filter(p => { const sent = s.packs[p.id], kept = r.settings.packs[p.id] ?? {}; return (sent.link && sent.link !== kept.link) || (sent.testLink && sent.testLink !== kept.testLink); });
  const badEmail = s.supportEmail && !r.settings.supportEmail;
  data = r; render(r);
  const m = document.getElementById('msg')!;
  m.textContent = dropped.length || badEmail ? `Saved, but ${[...dropped.map(p => p.name + ' link'), ...(badEmail ? ['the support email'] : [])].join(', ')} didn't look right and wasn't kept. Links must start with https://…lemonsqueezy.com/` : 'Saved ✓';
  m.className = dropped.length || badEmail ? 'warn' : 'ok';
}

function signedOut() {
  who.textContent = '';
  show(`<section><h2>Sign in</h2><p>This page is only for the game's owner. Sign in with the Google account listed as an admin.</p><p><button class="primary" id="go">Sign in with Google</button></p><p class="warn" id="err"></p></section>`);
  document.getElementById('go')!.onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => { document.getElementById('err')!.textContent = 'Sign-in failed: ' + (e?.code || e); });
}

if (preview) call().then(r => { data = r; render(r); });
else if (!onlineEnabled) show('<section><h2>Not available</h2><p>Online sign-in isn\'t configured for this build, so the admin page can\'t be used.</p></section>');
const auth = onlineEnabled ? getAuth(initializeApp(firebaseConfig)) : null!;
if (onlineEnabled && !preview) onAuthStateChanged(auth, async u => {
  user = u;
  if (!u) { signedOut(); return; }
  who.innerHTML = `${esc(u.email)} · <button id="out">Sign out</button>`;
  document.getElementById('out')!.onclick = () => signOut(auth);
  show('<p class="muted">Loading…</p>');
  const r = await call().catch(() => ({ error: 'server' }) as AdminData & { error?: string });
  if (r.error) { problem(r.error); return; }
  data = r; render(r);
});

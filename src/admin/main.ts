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
import type { LemonReport } from '../server/lemon';

interface AdminData {
  email: string; settings: GameSettings; secrets: { webhook: boolean; webhookFromCloudflare: boolean; lsApi: boolean; mail: boolean };
  lemon?: LemonReport;
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
  const b = body as { settings?: GameSettings; lsApiKey?: string; lsSync?: boolean } | undefined;
  if (b?.settings) data = { ...data!, settings: { ...b.settings, updatedAt: Date.now() } };
  if (b?.lsApiKey || b?.lsSync) data = { ...data!, secrets: { ...data!.secrets, lsApi: true, webhook: true }, lemon: { ok: true, store: 'cgsapiens', testMode: true, webhook: 'created', missing: ['Starter Pack'], products: [{ name: 'Pouch of Diamonds', price: 499, pack: 'pouch', status: 'published' }, { name: 'Old thing', price: 100, pack: null, status: 'draft' }] } };
  return data ?? { email: 'owner@example.com', settings: { packs: { pouch: { testLink: 'https://cgsapiens.lemonsqueezy.com/buy/test-123' } }, allowTest: true, supportEmail: '', news: '', xpEventUntil: 0, adsOn: false, adClient: '', adsTest: true, adCap: 10, adBreaks: true, adBreakMin: 3, mailFrom: '', updatedAt: 0 },
    secrets: { webhook: false, webhookFromCloudflare: false, lsApi: false, mail: false }, testFromCloudflare: false,
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
  const orders = d.orders.length ? `<div class="wrap"><table><thead><tr><th>When</th><th>Pack</th><th>Paid</th><th>Status</th><th>Order</th></tr></thead><tbody>${d.orders.slice(0, 60).map(o => `<tr>
      <td>${esc(when(o.at))}</td><td>${esc(PACKS.find(p => p.id === o.pack)?.name ?? o.pack)}</td>
      <td>${o.cents ? '$' + (o.cents / 100).toFixed(2) : '–'}${o.test ? ' <span class="warn">test</span>' : ''}</td>
      <td>${o.refunded ? '<span class="warn">Refunded</span>' : o.claimed ? '<span class="ok">Delivered</span>' : 'Waiting for the player'}</td>
      <td>#${esc(o.id)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No orders yet.</p>';
  const evOn = s.xpEventUntil > t;
  // Sales totals from the orders the server keeps (refunds and test orders left out).
  const real = d.orders.filter(o => !o.test && !o.refunded);
  const sales = `<div class="wrap"><table><tbody>
      <tr><td>Paid orders</td><td><b>${real.length}</b></td><td>Money in (before fees)</td><td><b>$${(real.reduce((n, o) => n + (o.cents || 0), 0) / 100).toFixed(2)}</b></td></tr>
      <tr><td>Buyers (browsers)</td><td><b>${new Set(real.map(o => o.buyer)).size}</b></td><td>Refunded / test orders</td><td><b>${d.orders.filter(o => o.refunded).length} / ${d.orders.filter(o => o.test).length}</b></td></tr>
    </tbody></table></div>`;
  const L = d.lemon, lerr: Record<string, string> = { badkey: 'Lemon Squeezy refused that API key. Copy it again (Settings → API → +) and paste the whole key.', nostore: 'That key has no store yet.', nokey: 'Paste your API key first.' };
  const lemon = `<section><h2>Lemon Squeezy</h2>
    <p>Paste your Lemon Squeezy API key once and press <b>Connect</b>. The panel then fills in every pack's checkout link and price from your products, and sets up the order webhook for you. Make one product per pack and put the pack's word in its name: Starter, Handful, Pouch, Chest or Vault.</p>
    <label>API key <span class="muted">(Lemon Squeezy → Settings → API → +)</span></label>
    <input type="password" id="lskey" autocomplete="off" placeholder="${d.secrets.lsApi ? 'Connected. Paste a new key only to switch (for example from test to live).' : 'Paste the key here'}">
    <p class="muted">Write-only: it's stored on the server and never shown again. A test-mode key connects your test products, and a live key your real ones.</p>
    <p><button class="primary" id="lsgo">${d.secrets.lsApi ? 'Refresh from Lemon Squeezy' : 'Connect'}</button> <span id="lsmsg" class="muted"></span></p>
    ${L ? (L.ok ? `<p class="ok">✓ Connected to <b>${esc(L.store)}</b>${L.testMode ? ' in <b>test mode</b> (test payments switched on)' : L.testMode === false ? ' in <b>live mode</b> (test payments switched off)' : ''}. Webhook: ${L.webhook === 'failed' ? '<span class="warn">couldn\'t be created, add it by hand (see Advanced below)</span>' : L.webhook === 'created' ? 'created ✓' : 'already set up ✓'}.</p>
      <div class="wrap"><table><thead><tr><th>Your product</th><th>Price</th><th>Used for</th></tr></thead><tbody>${(L.products ?? []).map(p => `<tr><td>${esc(p.name)}${p.status !== 'published' ? ' <span class="warn">(not published)</span>' : ''}</td><td>$${(p.price / 100).toFixed(2)}</td><td>${p.pack ? esc(PACKS.find(x => x.id === p.pack)?.name) : '<span class="muted">not a pack</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No products yet.</td></tr>'}</tbody></table></div>
      ${L.missing?.length ? `<p class="warn">No product found for: ${esc(L.missing.join(', '))}. Those packs show “soon” until you add one and press Refresh.</p>` : ''}`
      : `<p class="warn">${esc(lerr[L.error ?? ''] ?? 'Lemon Squeezy didn\'t answer (' + (L.error ?? '') + '). Try again in a minute.')}</p>`) : ''}
  </section>`;
  show(`${lemon}
  <section><h2>Setup</h2><ul class="steps">
    <li class="ok">✓ Storage connected and you're signed in as an admin.</li>
    <li class="${d.secrets.webhook ? 'ok' : 'warn'}">${d.secrets.webhook ? '✓ Ready to receive orders' + (d.secrets.webhookFromCloudflare ? ' (secret from Cloudflare)' : '') + '.' : '✗ Orders can\'t be received yet: connect Lemon Squeezy above.'}</li>
    <li class="${PACKS.some(p => (s.packs[p.id]?.link || p.link)) ? 'ok' : 'warn'}">${PACKS.some(p => (s.packs[p.id]?.link || p.link)) ? '✓ At least one pack has a live checkout link.' : '✗ No live checkout links yet, so players see “soon”. Connecting a live API key fills them in.'}</li>
  </ul></section>

  <section><h2>Diamond packs</h2><p class="muted">Changes reach players within about 10 minutes, or when they reload. The price here must match the price of the Lemon Squeezy product, because orders that paid less are not delivered.</p>${packs}</section>

  <section><h2>Payments</h2>
    <label class="check"><input type="checkbox" id="allowTest" ${s.allowTest ? 'checked' : ''}> Accept test payments (fake cards)</label>
    <p class="muted">Turn this on only while testing. Players test with the game link ending in <code>?testpay</code>. ${d.testFromCloudflare ? '<span class="warn">The Cloudflare variable LS_ALLOW_TEST=1 also turns this on; delete it when you go live.</span>' : ''}</p>
    <details><summary class="muted">Advanced: set the webhook by hand</summary>
    <p class="muted">Only needed if Connect couldn't create the webhook. In Lemon Squeezy → Settings → Webhooks, add <code>${esc(location.origin)}/api/ls-webhook</code> with the events order_created and order_refunded, and paste the same signing secret here.</p>
    <label>Webhook signing secret</label>
    <input type="password" id="secret" autocomplete="new-password" placeholder="${d.secrets.webhook ? 'Saved. Type a new one only to replace it.' : 'The secret you typed in Lemon Squeezy → Webhooks'}">
    <p class="muted">Write-only: it's kept on the server and never shown again, not even here. At least 16 characters.</p></details>
  </section>

  <section><h2>Ads</h2>
    <p class="muted">Players who don't pay can watch a short video ad for a small reward: 3 diamonds, a coin bag, finishing the workshops, or growing their crops. Ads come from Google H5 Games Ads. Apply at adsense.google.com, add harvest-lane.pages.dev, and once approved turn on H5 Games Ads in AdSense. To try the flow before then, open the game with <code>?testads</code> for a practice ad.</p>
    <label class="check"><input type="checkbox" id="adsOn" ${s.adsOn ? 'checked' : ''}> Show ads</label>
    <div class="row">
      <div><label>AdSense publisher ID</label><input type="text" id="adClient" value="${esc(s.adClient)}" placeholder="ca-pub-1234567890123456"></div>
      <div><label>Ads per player per day</label><input type="number" id="adCap" min="0" max="50" value="${s.adCap}"></div>
    </div>
    <label class="check"><input type="checkbox" id="adsTest" ${s.adsTest ? 'checked' : ''}> Google test ads (no money earned; turn off once approved)</label>
    <label class="check"><input type="checkbox" id="adBreaks" ${s.adBreaks ? 'checked' : ''}> Short ad break after a level-up</label>
    <div class="row"><div><label>Minutes between ad breaks (at least)</label><input type="number" id="adBreakMin" min="1" max="120" value="${s.adBreakMin}"></div><div></div></div>
    <p class="muted">Reward ads are always the player's choice (Google's rule): "Watch to double", "Retry now", and the shop's free rewards. Ad breaks between levels are allowed without asking.</p>
  </section>

  <section><h2>Invite emails</h2>
    <p class="muted">When a player invites a friend who doesn't play yet, the game emails them an invite. Emails go out through <b>Brevo</b> (free for up to 300 emails a day). Sign up at brevo.com, then add and verify your sender email under Senders, Domains &amp; Dedicated IPs → Senders. Create a key under SMTP &amp; API → API keys and paste it below. Limits: 5 invites per player per day, 1 per address per week, 250 a day in total.</p>
    <div class="row">
      <div><label>Sender email <span class="muted">(verified in Brevo)</span></label><input type="email" id="mailFrom" value="${esc(s.mailFrom)}" placeholder="harvestlane.help@gmail.com"></div>
      <div><label>Brevo API key ${d.secrets.mail ? '<span class="ok">✓ saved</span>' : ''}</label><input type="password" id="brevo" autocomplete="off" placeholder="${d.secrets.mail ? 'Saved. Paste a new one only to replace it.' : 'xkeysib-…'}"></div>
    </div>
    <p class="muted">The key is write-only: it's kept on the server and never shown again.</p>
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

  <section><h2>Sales</h2>${sales}<h2>Recent orders</h2>${orders}</section>
  <div class="bar"><span id="msg" class="muted">${s.updatedAt ? 'Last saved ' + esc(when(s.updatedAt)) : 'Not saved yet'}</span><button class="primary" id="save">Save changes</button></div>`);
  document.getElementById('save')!.onclick = save;
  document.getElementById('lsgo')!.onclick = connect;
}

async function connect() {
  const key = (document.getElementById('lskey') as HTMLInputElement).value.trim(), msg = document.getElementById('lsmsg')!;
  if (!key && !data!.secrets.lsApi) { msg.textContent = 'Paste your API key first.'; msg.className = 'warn'; return; }
  msg.textContent = 'Talking to Lemon Squeezy…'; msg.className = 'muted';
  const r = await call(key ? { lsApiKey: key } : { lsSync: true });
  if (r.error) { msg.textContent = 'Failed: ' + r.error; msg.className = 'warn'; return; }
  data = r; render(r);
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
  s.adsOn = (document.getElementById('adsOn') as HTMLInputElement).checked;
  s.adClient = (document.getElementById('adClient') as HTMLInputElement).value.trim();
  s.adsTest = (document.getElementById('adsTest') as HTMLInputElement).checked;
  s.adCap = +(document.getElementById('adCap') as HTMLInputElement).value || 0;
  s.adBreaks = (document.getElementById('adBreaks') as HTMLInputElement).checked;
  s.adBreakMin = +(document.getElementById('adBreakMin') as HTMLInputElement).value || 3;
  s.mailFrom = (document.getElementById('mailFrom') as HTMLInputElement).value.trim();
  const brevo = (document.getElementById('brevo') as HTMLInputElement).value.trim();
  const ev = (document.getElementById('xpev') as HTMLSelectElement).value;
  if (ev !== 'keep') s.xpEventUntil = ev === '0' ? 0 : Date.now() + +ev * 3600_000;
  const secret = (document.getElementById('secret') as HTMLInputElement).value.trim();
  if (secret && secret.length < 16) { msg.textContent = 'The webhook secret needs at least 16 characters.'; msg.className = 'warn'; return; }
  msg.textContent = 'Saving…'; msg.className = 'muted';
  const r = await call({ settings: s, ...(secret ? { webhookSecret: secret } : {}), ...(brevo ? { brevoKey: brevo } : {}) });
  if (r.error) { msg.textContent = 'Not saved: ' + r.error; msg.className = 'warn'; return; }
  // The server drops anything invalid, such as a link that isn't a Lemon Squeezy page; say so.
  const dropped = PACKS.filter(p => { const sent = s.packs[p.id], kept = r.settings.packs[p.id] ?? {}; return (sent.link && sent.link !== kept.link) || (sent.testLink && sent.testLink !== kept.testLink); });
  const badEmail = s.supportEmail && !r.settings.supportEmail, badAd = s.adClient && !r.settings.adClient;
  data = r; render(r);
  const m = document.getElementById('msg')!;
  m.textContent = dropped.length || badEmail || badAd ? `Saved, but ${[...dropped.map(p => p.name + ' link'), ...(badEmail ? ['the support email'] : []), ...(badAd ? ['the publisher ID (ca-pub- and digits)'] : [])].join(', ')} didn't look right and wasn't kept. Links must start with https://…lemonsqueezy.com/` : 'Saved ✓';
  m.className = dropped.length || badEmail || badAd ? 'warn' : 'ok';
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

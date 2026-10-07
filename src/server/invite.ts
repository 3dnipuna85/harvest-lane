/**
 * POST /api/invite-email {to}: a signed-in player invites a friend who doesn't play yet. The email goes out through
 * Brevo (its API key is saved on the admin page and never leaves the server). Only the friend's address comes from
 * the browser; the inviter's name and invite link come from their verified sign-in, so the email can't be filled
 * with someone else's text. Limits: 5 invites per player per day, 1 per friend's address per week, and a daily
 * total for the whole game.
 */
import { loadSettings, json, MAIL_KEY, type Env } from './payments';
import { sha256, verifyUser, type Fetch } from './admin';

export const PER_PLAYER_DAY = 5, PER_ADDRESS_DAYS = 7, GAME_DAY = 250;
export type MailFetch = (url: string, init: RequestInit) => Promise<Response>;

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function inviteEmail(from: string, link: string) {
  const who = esc(from || 'A friend');
  const subject = `${(from || 'A friend').slice(0, 60)} invited you to Harvest Lane 🌾`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4efe2;font-family:Arial,Helvetica,sans-serif;color:#3b2a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf7;border-radius:16px;overflow:hidden;border:1px solid #e4d8bf">
<tr><td style="background:#5aa832;padding:22px 24px;color:#fff;font-size:24px;font-weight:bold">🌾 Harvest Lane</td></tr>
<tr><td style="padding:24px">
<p style="font-size:18px;margin:0 0 12px"><b>${who}</b> wants you on their farm!</p>
<p style="margin:0 0 18px;line-height:1.5">Harvest Lane is a free farming game you play in your web browser: grow crops, raise animals, run workshops and fill trucks. Open the invite, sign up, and you and ${who} become friends in the game, so you can visit each other's farms.</p>
<p style="margin:0 0 22px"><a href="${esc(link)}" style="background:#e2a31f;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">Accept the invite</a></p>
<p style="margin:0;font-size:12px;color:#7a6650;line-height:1.5">Or copy this link: ${esc(link)}<br>You got this email because ${who} typed your address in the game. We don't add you to any list, and you won't get more emails unless a friend invites you again.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${from || 'A friend'} invited you to Harvest Lane, a free farming game in your browser.\n\nAccept the invite: ${link}\n\nYou got this email because they typed your address in the game. We don't add you to any list.`;
  return { subject, html, text };
}

export async function handleInvite(req: Request, env: Env, get?: Fetch, mail: MailFetch = (u, i) => fetch(u, i)) {
  const me = await verifyUser(req, env, get);
  if ('error' in me) return json({ error: me.error }, me.status);
  const kv = env.PURCHASES, key = kv ? await kv.get(MAIL_KEY) : null, st = await loadSettings(env);
  if (!kv || !key || !st.mailFrom) return json({ error: 'nomail' }, 503);
  let to = '';
  try { to = String((await req.json() as { to?: unknown }).to ?? '').trim().toLowerCase(); } catch { /* checked below */ }
  if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(to) || to.length > 120) return json({ error: 'bademail' }, 400);
  if (to === me.email) return json({ error: 'self' }, 400);
  const day = new Date().toISOString().slice(0, 10);
  const kMe = `rl:inv:${me.uid}:${day}`, kTo = `rl:to:${await sha256(to)}`, kAll = `rl:all:${day}`;
  const [nMe, seen, nAll] = await Promise.all([kv.get(kMe), kv.get(kTo), kv.get(kAll)]);
  if (+(nMe || 0) >= PER_PLAYER_DAY) return json({ error: 'limit' }, 429);
  if (seen) return json({ error: 'already' }, 429);
  if (+(nAll || 0) >= GAME_DAY) return json({ error: 'busy' }, 429);
  const link = new URL(req.url).origin + '/?friend=' + encodeURIComponent(me.uid);
  const m = inviteEmail(me.name, link);
  const r = await mail('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Harvest Lane', email: st.mailFrom }, to: [{ email: to }], subject: m.subject, htmlContent: m.html, textContent: m.text, tags: ['invite'] }),
  });
  if (!r.ok) return json({ error: 'sendfail', status: r.status }, 502);
  await Promise.all([
    kv.put(kMe, String(+(nMe || 0) + 1), { expirationTtl: 2 * 86400 }),
    kv.put(kTo, '1', { expirationTtl: PER_ADDRESS_DAYS * 86400 }),
    kv.put(kAll, String(+(nAll || 0) + 1), { expirationTtl: 2 * 86400 }),
  ]);
  return json({ ok: true });
}

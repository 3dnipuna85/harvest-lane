/**
 * Friends for the public build: invite by email (a friend request waits in their list until they accept) or share
 * an invite link. Friends can visit each other's farm: a look-only copy from their public player card.
 */
import { toast } from '../ui/toasts';
import { visitFarm } from '../ui/visit';
import { S } from '../game/state';

type Fb = typeof import('./firebase');
const INVITE_KEY = 'harvest-lane-invite';

let fb: Fb | null = null;
let me: { uid: string; name: string; photo: string; email?: string } | null = null;
let requests: import('./firebase').Invite[] = [];
let signIn: () => void = () => {};
let box: HTMLElement | null = null;

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (v: number) => Math.floor(v).toLocaleString();
const inviteLink = (uid: string) => location.origin + location.pathname + '?friend=' + encodeURIComponent(uid);
const denied = (e: unknown) => (e as { code?: string }).code === 'permission-denied';

/** Remember an invite from the link (?friend=uid) until the player is signed in, and tidy the address bar. */
export function catchInvite() {
  const u = new URLSearchParams(location.search).get('friend');
  if (!u) return;
  try { localStorage.setItem(INVITE_KEY, u); } catch { /* blocked */ }
  history.replaceState(null, '', location.pathname + location.hash);
}
const pendingInvite = () => { try { return localStorage.getItem(INVITE_KEY); } catch { return null; } };
const clearInvite = () => { try { localStorage.removeItem(INVITE_KEY); } catch { /* blocked */ } };

export function initFriends(f: Fb, openSignIn: () => void) {
  fb = f; signIn = openSignIn;
  const btn = document.createElement('button');
  btn.className = 'pill friendspill';
  btn.setAttribute('aria-label', 'Friends');
  btn.innerHTML = '<img src="./ui/friends.webp" alt=""><span class="account-name">Friends</span>';
  btn.addEventListener('click', openFriends);
  document.querySelector('.hud')!.insertBefore(btn, document.querySelector('.hud .account') || document.getElementById('coinPill'));
  if (pendingInvite()) setTimeout(() => { if (!me) toast('Sign in to accept your friend’s invite.'); }, 2500);
}

/** Who is signed in, before their farm has finished loading. */
export function friendsMe(u: { uid: string; name: string; photo: string; email?: string }) { me = u; }

/** Signed in (or out). Accepts a waiting invite, and publishes this player's card so friends can see the farm. */
export async function friendsUser(u: { uid: string; name: string; photo: string; email?: string } | null) {
  me = u;
  requests = [];
  updatePill();
  if (!u || !fb) return;
  fb.publishCard(u.uid, { name: u.name, photo: u.photo }, JSON.stringify(S), S.level).catch(() => {});
  if (u.email) fb.registerEmail(u.uid, u.email).catch(() => {});
  checkRequests(true);
  const inv = pendingInvite();
  if (!inv) return;
  clearInvite();
  if (inv === u.uid) { toast('That’s your own invite link. Send it to a friend!'); return; }
  try {
    await fb.addFriend(u.uid, inv);
    const c = await fb.playerCard(inv);
    toast('You and ' + (c?.name || 'your friend') + ' are now friends! Tap Friends to visit their farm.');
  } catch (e) {
    toast(denied(e) ? 'Friends aren’t switched on for this game yet.' : 'Couldn’t add your friend. Open the invite link again.');
  }
}

/** Friend requests waiting for this player. Shows a badge on the Friends pill, and a toast when asked. */
async function checkRequests(say = false) {
  if (!fb || !me) return;
  try { requests = await fb.invitesFor(me.uid); } catch { requests = []; }
  updatePill();
  if (say && requests.length) toast(requests.length === 1 ? `${requests[0].name} wants to be your friend. Tap Friends to accept.` : `${requests.length} friend requests are waiting. Tap Friends to see them.`);
}
function updatePill() {
  const p = document.querySelector<HTMLElement>('.friendspill');
  if (!p) return;
  let b = p.querySelector<HTMLElement>('.badge');
  if (!b) { b = document.createElement('span'); b.className = 'badge'; p.appendChild(b); }
  b.hidden = !requests.length;
  b.textContent = String(requests.length);
}

async function inviteByEmail(input: HTMLInputElement, note: HTMLElement) {
  if (!fb || !me) return;
  const email = input.value.trim();
  const say = (m: string, ok = false) => { note.textContent = m; note.className = 'fr-note' + (ok ? ' ok' : ' bad'); };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('That doesn’t look like an email address.'); return; }
  if (me.email && email.toLowerCase() === me.email.toLowerCase()) { say('That’s your own email. Try a friend’s!'); return; }
  say('Looking for your friend…', true);
  try {
    const uid = await fb.uidForEmail(email);
    if (!uid) { say('Nobody plays with that email yet. Send them your invite link below instead.'); return; }
    if ((await fb.friendIds(me.uid)).includes(uid)) { say('You’re already friends!', true); return; }
    await fb.sendInvite(me.uid, uid, { name: me.name, photo: me.photo });
    input.value = '';
    say('Invite sent! It shows up in their Friends list next time they play.', true);
  } catch (e) {
    say(denied(e) ? 'Email invites are opening soon. Use your invite link for now.' : 'Couldn’t send the invite. Check your connection and try again.');
  }
}

async function answer(from: string, yes: boolean, list: HTMLElement) {
  if (!fb || !me) return;
  try {
    if (yes) await fb.addFriend(me.uid, from);
    await fb.dropInvite(me.uid, from);
    const r = requests.find(q => q.from === from);
    requests = requests.filter(q => q.from !== from);
    updatePill();
    if (yes) toast(`You and ${r?.name || 'your friend'} are now friends!`);
    fillRequests();
    fillList(list);
  } catch { toast('Couldn’t answer that request. Try again.'); }
}

function fillRequests() {
  const el = box?.querySelector<HTMLElement>('.fr-reqs');
  if (!el) return;
  el.hidden = !requests.length;
  el.innerHTML = requests.length ? `<h3 class="fr-h">Friend requests</h3>` + requests.map(r => `<div class="fr-row req">${face(r.name, r.photo)}
      <div class="fr-id"><b>${esc(r.name)}</b><span>wants to be your friend</span></div>
      <button class="btn gold" data-yes="${esc(r.from)}">Accept</button><button class="btn alt" data-no="${esc(r.from)}">No thanks</button></div>`).join('') : '';
}

function face(name: string, photo: string) {
  return `<span class="face fr-face">${esc((name[0] || '?').toUpperCase())}${photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
}

async function fillList(list: HTMLElement) {
  if (!fb || !me) return;
  try {
    const ids = await fb.friendIds(me.uid);
    if (!ids.length) { list.innerHTML = '<p class="fr-empty">No friends yet. Send your link to family and friends, and their farms will show up here.</p>'; return; }
    const cards = (await Promise.all(ids.map(id => fb!.playerCard(id).catch(() => null)))).filter(Boolean) as Awaited<ReturnType<Fb['playerCard']>>[];
    cards.sort((a, b) => b!.level - a!.level);
    list.innerHTML = cards.map((c, i) => `<div class="fr-row">${face(c!.name, c!.photo)}
      <div class="fr-id"><b>${esc(c!.name)}</b><span>Lv ${c!.level} · ${n(c!.earned)} coins earned · ${c!.plots} plots</span></div>
      <button class="btn gold" data-visit="${i}" ${c!.snap ? '' : 'disabled'}>Visit</button></div>`).join('');
    list.querySelectorAll<HTMLButtonElement>('[data-visit]').forEach(b => b.addEventListener('click', () => {
      const c = cards[+b.dataset.visit!]!;
      if (c.snap && visitFarm(c.snap, c.name, c.level)) closeFriends();
    }));
  } catch (e) {
    list.innerHTML = `<p class="fr-empty">${denied(e) ? 'The friends list is opening soon. Your invite link already works: friends who use it will show up here.' : 'Couldn’t load your friends. Check your connection and try again.'}</p>`;
  }
}

function closeFriends() {
  if (!box) return;
  const b = box; box = null;
  b.classList.add('out');
  setTimeout(() => b.remove(), 300);
}

export function openFriends() {
  if (box) return;
  box = document.createElement('section');
  box.className = 'guide friends';
  const body = !me
    ? `<p class="fr-lead">Sign in to invite friends and visit their farms.</p><button class="btn gold" data-fr="signin">Sign in</button>`
    : `<div class="fr-reqs" hidden></div>
      <div class="fr-invite"><p class="fr-lead">Invite a friend who already plays by their email.</p>
        <form class="fr-link fr-email"><input type="email" placeholder="friend@email.com" aria-label="Friend’s email" autocomplete="off"><button class="btn gold" type="submit">Send invite</button></form>
        <p class="fr-note" aria-live="polite"></p></div>
      <h3 class="fr-h">Your friends</h3><div class="fr-list"><p class="fr-empty">Loading…</p></div>
      <div class="fr-invite"><p class="fr-lead small">Friend not playing yet? Send this link. When they open it and sign in, you’ll be friends.</p>
        <div class="fr-link"><input readonly value="${esc(inviteLink(me.uid))}" aria-label="Your invite link"><button class="btn gold" data-fr="copy">Copy</button>${'share' in navigator ? '<button class="btn" data-fr="share">Share</button>' : ''}</div></div>`;
  box.innerHTML = `<div class="g-card board fr-card" role="dialog" aria-label="Friends"><h2 class="plank-title">Friends</h2>
    <button class="close" aria-label="Close">×</button><div class="fr-body">${body}</div></div>`;
  document.body.appendChild(box);
  box.addEventListener('click', async e => {
    const el = e.target as HTMLElement;
    if (el === box || el.closest('.close')) { closeFriends(); return; }
    const a = el.closest<HTMLElement>('[data-fr]')?.dataset.fr;
    if (a === 'signin') { closeFriends(); signIn(); }
    const yes = el.closest<HTMLElement>('[data-yes]')?.dataset.yes, no = el.closest<HTMLElement>('[data-no]')?.dataset.no;
    if ((yes || no) && list) { answer((yes || no)!, !!yes, list); return; }
    if (a === 'copy' && me) {
      const input = box!.querySelector<HTMLInputElement>('.fr-link:not(.fr-email) input')!;
      try { await navigator.clipboard.writeText(input.value); toast('Invite link copied. Paste it in a message to your friend.'); }
      catch { input.select(); toast('Select the link and copy it.'); }
    }
    if (a === 'share' && me) navigator.share({ title: 'Harvest Lane', text: 'Come farm with me on Harvest Lane!', url: inviteLink(me.uid) }).catch(() => {});
  });
  const list = box.querySelector<HTMLElement>('.fr-list');
  const form = box.querySelector<HTMLFormElement>('.fr-email');
  form?.addEventListener('submit', e => { e.preventDefault(); inviteByEmail(form.querySelector('input')!, box!.querySelector<HTMLElement>('.fr-note')!); });
  if (list) { fillList(list); fillRequests(); checkRequests().then(fillRequests); }
}

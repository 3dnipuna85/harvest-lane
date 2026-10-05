/**
 * Friends for the public build: share an invite link; whoever opens it and signs in becomes your friend,
 * and each of you can visit the other's farm (a read-only copy from their public player card).
 */
import { toast } from '../ui/toasts';
import { visitFarm } from '../ui/visit';
import { S } from '../game/state';

type Fb = typeof import('./firebase');
const INVITE_KEY = 'harvest-lane-invite';

let fb: Fb | null = null;
let me: { uid: string; name: string; photo: string } | null = null;
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

/** Signed in (or out). Accepts a waiting invite, and publishes this player's card so friends can see the farm. */
export async function friendsUser(u: { uid: string; name: string; photo: string } | null) {
  me = u;
  if (!u || !fb) return;
  fb.publishCard(u.uid, { name: u.name, photo: u.photo }, JSON.stringify(S), S.level).catch(() => {});
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
    list.innerHTML = `<p class="fr-empty">${denied(e) ? 'Friends need a one-time switch in the game’s Firebase settings. Ask the farm owner to update the Firestore rules.' : 'Couldn’t load your friends. Check your connection and try again.'}</p>`;
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
    : `<div class="fr-invite"><p class="fr-lead">Send this link to a friend. When they open it and sign in, you’ll be friends and can visit each other’s farms.</p>
        <div class="fr-link"><input readonly value="${esc(inviteLink(me.uid))}" aria-label="Your invite link"><button class="btn gold" data-fr="copy">Copy</button>${'share' in navigator ? '<button class="btn" data-fr="share">Share</button>' : ''}</div></div>
      <h3 class="fr-h">Your friends</h3><div class="fr-list"><p class="fr-empty">Loading…</p></div>`;
  box.innerHTML = `<div class="g-card board fr-card" role="dialog" aria-label="Friends"><h2 class="plank-title">Friends</h2>
    <button class="close" aria-label="Close">×</button><div class="fr-body">${body}</div></div>`;
  document.body.appendChild(box);
  box.addEventListener('click', async e => {
    const el = e.target as HTMLElement;
    if (el === box || el.closest('.close')) { closeFriends(); return; }
    const a = el.closest<HTMLElement>('[data-fr]')?.dataset.fr;
    if (a === 'signin') { closeFriends(); signIn(); }
    if (a === 'copy' && me) {
      const input = box!.querySelector('input')!;
      try { await navigator.clipboard.writeText(input.value); toast('Invite link copied. Paste it in a message to your friend.'); }
      catch { input.select(); toast('Select the link and copy it.'); }
    }
    if (a === 'share' && me) navigator.share({ title: 'Harvest Lane', text: 'Come farm with me on Harvest Lane!', url: inviteLink(me.uid) }).catch(() => {});
  });
  const list = box.querySelector<HTMLElement>('.fr-list');
  if (list) fillList(list);
}

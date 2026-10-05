/**
 * Sign-in for the public build: a welcome panel over the farm with Google and email login, or play
 * without an account (browser save only). Signed-in players' farms sync to Firestore through cloud.ts.
 */
import { connectRemote, disconnectRemote } from '../cloud';
import { toast } from '../ui/toasts';

type Fb = typeof import('./firebase');
let fb: Fb | null = null;
let panel: HTMLElement;
let account: HTMLButtonElement;
let who: { uid: string; name: string } | null = null;
const GUEST_KEY = 'harvest-lane-guest';

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email. Create one instead.',
  'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  'auth/popup-closed-by-user': 'The Google window was closed before signing in.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain': 'This website isn’t allowed to sign in yet. Add its domain in Firebase > Authentication > Settings > Authorized domains.',
  'auth/operation-not-allowed': 'This sign-in method is turned off in Firebase > Authentication > Sign-in method.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
};
const msg = (e: unknown) => MESSAGES[(e as { code?: string }).code ?? ''] ?? 'Something went wrong. Please try again.';

const guest = () => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; } };
const setGuest = (on: boolean) => { try { on ? localStorage.setItem(GUEST_KEY, '1') : localStorage.removeItem(GUEST_KEY); } catch { /* blocked */ } };

function show(html: string) { panel.querySelector('.login-body')!.innerHTML = html; panel.hidden = false; }
function hide() { panel.hidden = true; }
function err(text: string) { const e = panel.querySelector<HTMLElement>('.login-err'); if (e) { e.textContent = text; e.hidden = !text; } }

function welcome() {
  show(`
    <p class="login-lead">Sign in to keep your farm safe and play it on any device.</p>
    <button class="btn google" data-login="google"><svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"/></svg>Continue with Google</button>
    <div class="login-or"><span>or use email</span></div>
    <form class="login-form" novalidate>
      <input type="email" id="lgEmail" placeholder="Email" autocomplete="email" required>
      <input type="password" id="lgPw" placeholder="Password (6+ characters)" autocomplete="current-password" required>
      <p class="login-err" role="alert" hidden></p>
      <div class="login-row">
        <button class="btn" type="submit" data-login="in">Sign in</button>
        <button class="btn gold" type="button" data-login="up">Create account</button>
      </div>
      <button class="linkbtn" type="button" data-login="reset">Forgot password?</button>
    </form>
    <button class="linkbtn guest" data-login="guest">Play without an account (saves on this device only)</button>`);
}

function accountPanel() {
  show(`
    <p class="login-lead">Signed in as <b></b>. Your farm saves to your account automatically.</p>
    <div class="login-row">
      <button class="btn alt" data-login="close">Back to the farm</button>
      <button class="btn red" data-login="out">Sign out</button>
    </div>`);
  panel.querySelector('.login-lead b')!.textContent = who?.name ?? '';
}

async function act(kind: string) {
  if (!fb) return;
  const email = (panel.querySelector<HTMLInputElement>('#lgEmail')?.value ?? '').trim();
  const pw = panel.querySelector<HTMLInputElement>('#lgPw')?.value ?? '';
  err('');
  if ((kind === 'in' || kind === 'up') && !/^\S+@\S+\.\S+$/.test(email)) { err(MESSAGES['auth/invalid-email']); return; }
  if ((kind === 'in' || kind === 'up') && pw.length < 6) { err(kind === 'up' ? MESSAGES['auth/weak-password'] : MESSAGES['auth/missing-password']); return; }
  try {
    if (kind === 'google') await fb.google();
    else if (kind === 'in') await fb.emailIn(email, pw);
    else if (kind === 'up') await fb.emailUp(email, pw);
    else if (kind === 'reset') {
      if (!email) { err('Type your email above first.'); return; }
      await fb.resetPw(email); err('We sent a reset link to ' + email + '.');
    } else if (kind === 'guest') { setGuest(true); hide(); updateAccount(); }
    else if (kind === 'close') hide();
    else if (kind === 'out') { await fb.logOut(); setGuest(false); toast('Signed out. Your farm is saved in your account.'); }
  } catch (e) { err(msg(e)); }
}

function updateAccount() {
  account.hidden = false;
  account.textContent = who ? (who.name[0] || '?').toUpperCase() : 'Sign in';
  account.classList.toggle('in', !!who);
  account.setAttribute('aria-label', who ? 'Account: ' + who.name : 'Sign in');
}

export async function initOnline() {
  panel = document.createElement('section');
  panel.className = 'login';
  panel.hidden = true;
  panel.innerHTML = '<div class="board login-card"><h2 class="plank-title">Harvest Lane</h2><div class="login-body"></div></div>';
  document.body.appendChild(panel);
  panel.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-login]');
    if (b && b.getAttribute('type') !== 'submit') { e.preventDefault(); act(b.dataset.login!); }
  });
  panel.addEventListener('submit', e => { e.preventDefault(); act('in'); });

  account = document.createElement('button');
  account.className = 'pill account';
  account.hidden = true;
  document.querySelector('.hud')!.insertBefore(account, document.getElementById('coinPill'));
  account.addEventListener('click', () => (who ? accountPanel() : welcome()));

  fb = await import('./firebase');
  fb.watchUser(async u => {
    if (u) {
      who = { uid: u.uid, name: u.displayName || u.email || 'Farmer' };
      setGuest(false); hide(); updateAccount();
      await connectRemote(fb!.farmStore(u.uid));
    } else {
      who = null; disconnectRemote(); updateAccount();
      if (!guest()) welcome();
    }
  });
}

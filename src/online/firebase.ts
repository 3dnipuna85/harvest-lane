/** Firebase Auth + Firestore for the public build. Loaded on demand, so the claude.ai build never downloads it. */
import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, type User,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import type { Remote } from '../cloud';
import { firebaseConfig } from './config';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const watchUser = (fn: (u: User | null) => void) => onAuthStateChanged(auth, fn);
export const google = () => signInWithPopup(auth, new GoogleAuthProvider());
export const emailIn = (email: string, pw: string) => signInWithEmailAndPassword(auth, email, pw);
export const emailUp = (email: string, pw: string) => createUserWithEmailAndPassword(auth, email, pw);
export const resetPw = (email: string) => sendPasswordResetEmail(auth, email);
export const logOut = () => signOut(auth);

export interface Profile { name: string; photo: string }
export interface PlayerCard extends Profile { uid: string; level: number; earned: number; plots: number; snap: string | null }

/**
 * One private Firestore document per player (farms/{uid}), plus a public card (players/{uid}) that friends
 * read to see the player's name, level and a copy of the farm to visit.
 */
export function farmStore(uid: string, me: Profile): Remote {
  const ref = doc(db, 'farms', uid), card = doc(db, 'players', uid);
  return {
    async load() { const s = await getDoc(ref); const d = s.data(); return d && typeof d.state === 'string' ? d.state : null; },
    async store(state, meta) {
      await setDoc(ref, { state, ...meta, updatedAt: serverTimestamp() });
      const s = JSON.parse(state) as { stats?: { earned?: number }; plots?: unknown[] };
      // The public card is best-effort: older Firestore rules without players/ simply refuse it.
      setDoc(card, { name: me.name, photo: me.photo, level: meta.level, earned: s.stats?.earned ?? 0, plots: s.plots?.length ?? 0, snap: state, updatedAt: serverTimestamp() })
        .catch(() => {});
    },
  };
}

/** Write the public card now (on sign-in), without waiting for the farm to change. */
export function publishCard(uid: string, me: Profile, state: string, level: number) {
  const s = JSON.parse(state) as { stats?: { earned?: number }; plots?: unknown[] };
  return setDoc(doc(db, 'players', uid), { name: me.name, photo: me.photo, level, earned: s.stats?.earned ?? 0, plots: s.plots?.length ?? 0, snap: state, updatedAt: serverTimestamp() });
}

export async function playerCard(uid: string): Promise<PlayerCard | null> {
  const d = (await getDoc(doc(db, 'players', uid))).data();
  if (!d) return null;
  return { uid, name: String(d.name || 'Farmer'), photo: String(d.photo || ''), level: +d.level || 1, earned: +d.earned || 0, plots: +d.plots || 0, snap: typeof d.snap === 'string' ? d.snap : null };
}

/** Make two players friends: the link is written on both sides. */
export async function addFriend(me: string, other: string) {
  await setDoc(doc(db, 'players', me, 'friends', other), { at: serverTimestamp() });
  await setDoc(doc(db, 'players', other, 'friends', me), { at: serverTimestamp() });
}

export async function friendIds(me: string) {
  return (await getDocs(collection(db, 'players', me, 'friends'))).docs.map(d => d.id);
}

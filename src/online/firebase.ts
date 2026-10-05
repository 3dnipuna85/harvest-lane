/** Firebase Auth + Firestore for the public build. Loaded on demand, so the claude.ai build never downloads it. */
import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
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

/** One Firestore document per player: farms/{uid}. */
export function farmStore(uid: string): Remote {
  const ref = doc(db, 'farms', uid);
  return {
    async load() { const s = await getDoc(ref); const d = s.data(); return d && typeof d.state === 'string' ? d.state : null; },
    store: (state, meta) => setDoc(ref, { state, ...meta, updatedAt: serverTimestamp() }),
  };
}

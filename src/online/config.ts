/**
 * Firebase web app config for the public build. These values only identify the Firebase project (they are
 * not secrets; access is enforced by Auth and firestore.rules). Set them in `.env.production` as
 * VITE_FIREBASE_* (see `.env.example`). With no project id, online play stays off and the game saves
 * in the browser only.
 */
const env = import.meta.env;
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};
export const onlineEnabled = !!firebaseConfig.projectId && !!firebaseConfig.apiKey;

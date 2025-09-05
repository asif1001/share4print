import { initializeApp, getApps } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { connectAuthEmulator } from 'firebase/auth'

// Values are provided via environment variables (NEXT_PUBLIC_*)
const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function assertFirebaseEnv() {
  const missing = Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length) {
    const msg = `Missing Firebase env vars: ${missing.join(', ')}. Create .env.local and set NEXT_PUBLIC_* values.`
    console.error(msg)
    throw new Error(msg)
  }
  if (cfg.apiKey && !/^AIza[\w-]+/.test(cfg.apiKey)) {
    console.warn('The provided NEXT_PUBLIC_FIREBASE_API_KEY does not look like a valid browser API key (should start with AIza...)')
  }
}

assertFirebaseEnv()

const firebaseConfig = cfg as Required<typeof cfg>

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()
// Always show account chooser
try { googleProvider.setCustomParameters({ prompt: 'select_account' }) } catch {}

// Optional: App Check (helps avoid CORS-like failures when enforcement is enabled)
// Set NEXT_PUBLIC_APPCHECK_SITE_KEY (reCAPTCHA v3 site key). For local dev, set NEXT_PUBLIC_APPCHECK_DEBUG=true
if (typeof window !== 'undefined') {
  const siteKey = process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY
  const looksReal = !!siteKey && !/YOUR_RECAPTCHA/i.test(siteKey) && siteKey.length > 20
  if (looksReal) {
    if (process.env.NEXT_PUBLIC_APPCHECK_DEBUG === 'true') {
      ;(window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true
      console.info('[firebase] App Check debug token enabled')
    }
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey as string),
        isTokenAutoRefreshEnabled: true,
      })
      console.info('[firebase] App Check initialized with reCAPTCHA v3')
    } catch (e) {
      console.warn('App Check init skipped/failed:', e)
    }
  } else if (siteKey) {
    console.warn('[firebase] NEXT_PUBLIC_APPCHECK_SITE_KEY looks like a placeholder; skipping App Check init')
  }
}

// Optional: Use local emulators during development to bypass network/CORS
const EMU_ALL = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === '1'
const EMU_AUTH = (process.env.NEXT_PUBLIC_USE_AUTH_EMULATOR ?? (EMU_ALL ? '1' : '0')) === '1'
const EMU_FS = (process.env.NEXT_PUBLIC_USE_FIRESTORE_EMULATOR ?? (EMU_ALL ? '1' : '0')) === '1'
const EMU_ST = (process.env.NEXT_PUBLIC_USE_STORAGE_EMULATOR ?? (EMU_ALL ? '1' : '0')) === '1'

try {
  if (EMU_AUTH) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    if (typeof window !== 'undefined') console.info('[firebase] Auth → emulator :9099')
  } else if (typeof window !== 'undefined') {
    console.info('[firebase] Auth → production')
  }
} catch {}

try {
  if (EMU_FS) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    if (typeof window !== 'undefined') console.info('[firebase] Firestore → emulator :8080')
  } else if (typeof window !== 'undefined') {
    console.info('[firebase] Firestore → production')
  }
} catch {}

try {
  if (EMU_ST) {
    connectStorageEmulator(storage, '127.0.0.1', 9199)
    if (typeof window !== 'undefined') console.info('[firebase] Storage → emulator :9199')
  } else if (typeof window !== 'undefined') {
    console.info('[firebase] Storage → production; bucket:', firebaseConfig.storageBucket)
  }
} catch {}

"use client"
import { auth, googleProvider } from '@/lib/firebase'
import { signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'

export default function AuthButton() {
  const [user, setUser] = useState(auth.currentUser)
  useEffect(() => {
    return auth.onAuthStateChanged(setUser)
  }, [])

  if (user) {
    return (
      <button onClick={() => signOut(auth)} className="px-3 py-1 border rounded text-sm">Sign out</button>
    )
  }
  const onSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: any) {
      // Popup blocked or third-party cookie issues — fallback to redirect
      try {
        await signInWithRedirect(auth, googleProvider)
      } catch (err2) {
        alert('Could not open Google sign-in. Please allow popups or try again.')
        // eslint-disable-next-line no-console
        console.warn('Sign-in failed', err, err2)
      }
    }
  }
  return (
    <button onClick={onSignIn} className="px-3 py-1 bg-brand text-white rounded text-sm">Sign in</button>
  )
}

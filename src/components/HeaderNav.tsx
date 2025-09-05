"use client"
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const AuthButton = dynamic(() => import('@/components/AuthButton'), { ssr: false })
const ThemeToggle = dynamic(() => import('@/components/ThemeToggle'), { ssr: false })

export default function HeaderNav() {
  const router = useRouter()
  useEffect(() => {
    router.prefetch('/upload')
    router.prefetch('/explore')
    router.prefetch('/profile')
  }, [router])
  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/explore">Explore</Link>
      <Link href="/upload">Upload</Link>
      <Link href="/profile">Profile</Link>
      <Link href="/admin">Admin</Link>
      <ThemeToggle />
      <AuthButton />
    </nav>
  )
}

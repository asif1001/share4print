"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'

type ModelCard = { id: string; slug: string; title: string; ownerUsername?: string | null; coverUrl?: string | null; license?: string | null }

export default function HomePage() {
  const [latest, setLatest] = useState<ModelCard[]>([])
  const [popular, setPopular] = useState<ModelCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // Preferred queries (require composite indexes)
        const latestQ = query(
          collection(db, 'models'),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc'),
          limit(8)
        )
        const popularQ = query(
          collection(db, 'models'),
          where('visibility', '==', 'public'),
          orderBy('stats.likes', 'desc'),
          limit(8)
        )
        const [latestSnap, popularSnap] = await Promise.all([getDocs(latestQ), getDocs(popularQ)])
        if (!alive) return
        const toCards = (snap: any) => {
          const rows: ModelCard[] = []
          snap.forEach((docu: any) => {
            const d = docu.data() as any
            rows.push({ id: docu.id, slug: d.slug, title: d.title, ownerUsername: d.ownerUsername ?? null, coverUrl: d.coverUrl ?? null, license: d.license ?? null })
          })
          return rows
        }
        setLatest(toCards(latestSnap))
        setPopular(toCards(popularSnap))
      } catch (err) {
        // Fallbacks without composite indexes
        try {
          const latestQ2 = query(collection(db, 'models'), orderBy('createdAt', 'desc'), limit(16))
          const latestSnap2 = await getDocs(latestQ2)
          const rowsL: ModelCard[] = []
          latestSnap2.forEach((docu: any) => {
            const d = docu.data() as any
            if (d.visibility === 'public') rowsL.push({ id: docu.id, slug: d.slug, title: d.title, ownerUsername: d.ownerUsername ?? null, coverUrl: d.coverUrl ?? null, license: d.license ?? null })
          })
          setLatest(rowsL.slice(0, 8))
        } catch {}
        try {
          const popularQ2 = query(collection(db, 'models'), orderBy('stats.likes', 'desc'), limit(16))
          const popularSnap2 = await getDocs(popularQ2)
          const rowsP: ModelCard[] = []
          popularSnap2.forEach((docu: any) => {
            const d = docu.data() as any
            if (d.visibility === 'public') rowsP.push({ id: docu.id, slug: d.slug, title: d.title, ownerUsername: d.ownerUsername ?? null, coverUrl: d.coverUrl ?? null, license: d.license ?? null })
          })
          setPopular(rowsP.slice(0, 8))
        } catch {}
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <div className="space-y-10">
      <section className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded">
        <h1 className="text-3xl font-bold">share4print</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">Modern platform to upload, preview, and download 3D printing models.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/upload" className="px-4 py-2 bg-brand text-white rounded">Upload a model</Link>
          <Link href="/explore" className="px-4 py-2 border rounded">Explore</Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Popular</h2>
          <Link href="/explore" className="text-brand">See all</Link>
        </div>
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : popular.length === 0 ? (
          <div className="text-sm text-gray-500">No popular models yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {popular.map((m) => (
      <Link key={m.id} href={`/model/${encodeURIComponent(m.slug)}`} className="border rounded p-2 block group hover:shadow-sm transition">
                <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                  {m.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
        <img src={m.coverUrl} alt={m.title} className="w-full h-full object-cover group-hover:opacity-95" />
                  ) : null}
                </div>
                <div className="mt-2 text-sm font-medium truncate" title={m.title}>{m.title}</div>
                <div className="text-xs text-gray-500 truncate">{m.ownerUsername ? `by ${m.ownerUsername}` : '—'} {m.license ? `• ${m.license}` : ''}</div>
      </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Latest</h2>
          <Link href="/explore" className="text-brand">See all</Link>
        </div>
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : latest.length === 0 ? (
          <div className="text-sm text-gray-500">No models yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {latest.map((m) => (
      <Link key={m.id} href={`/model/${encodeURIComponent(m.slug)}`} className="border rounded p-2 block group hover:shadow-sm transition">
                <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                  {m.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
        <img src={m.coverUrl} alt={m.title} className="w-full h-full object-cover group-hover:opacity-95" />
                  ) : null}
                </div>
                <div className="mt-2 text-sm font-medium truncate" title={m.title}>{m.title}</div>
                <div className="text-xs text-gray-500 truncate">{m.ownerUsername ? `by ${m.ownerUsername}` : '—'} {m.license ? `• ${m.license}` : ''}</div>
      </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

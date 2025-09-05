"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import Link from 'next/link'
import { db } from '@/lib/firebase'

type ModelCard = { id: string; slug: string; title: string; ownerUsername?: string | null; coverUrl?: string | null; license?: string | null }

export default function ExplorePage() {
  const [items, setItems] = useState<ModelCard[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Prefetch the heavy Upload route so clicking is instant
    router.prefetch('/upload')

    let alive = true
    ;(async () => {
      try {
        // Preferred: compound query (requires composite index)
        const qref = query(
          collection(db, 'models'),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc'),
          limit(24)
        )
        const snap = await getDocs(qref)
        const rows: ModelCard[] = []
        snap.forEach(docu => {
          const d = docu.data() as any
          rows.push({ id: docu.id, slug: d.slug, title: d.title, ownerUsername: d.ownerUsername ?? null, coverUrl: d.coverUrl ?? null, license: d.license ?? null })
        })
        if (alive) setItems(rows)
      } catch (err) {
        // Fallback: single-field order + client-side filter (no composite index needed)
        try {
          const qref2 = query(
            collection(db, 'models'),
            orderBy('createdAt', 'desc'),
            limit(24)
          )
          const snap2 = await getDocs(qref2)
          const rows2: ModelCard[] = []
      snap2.forEach(docu => {
            const d = docu.data() as any
            if (d.visibility === 'public') {
        rows2.push({ id: docu.id, slug: d.slug, title: d.title, ownerUsername: d.ownerUsername ?? null, coverUrl: d.coverUrl ?? null, license: d.license ?? null })
            }
          })
          if (alive) setItems(rows2)
        } catch {}
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Explore</h1>
        <div className="text-sm text-gray-500">Showing latest public uploads</div>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((m) => (
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
    </div>
  )
}

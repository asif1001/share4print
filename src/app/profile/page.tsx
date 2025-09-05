"use client"
import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'

type Row = { id: string; title: string; slug: string; coverUrl?: string | null; visibility?: string | null }

export default function ProfilePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const uid = auth.currentUser?.uid

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!uid) { setLoading(false); return }
      try {
        const qref = query(collection(db, 'users', uid, 'models'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(qref)
        const list: Row[] = []
        snap.forEach(d => {
          const v = d.data() as any
          list.push({ id: d.id, title: v.title, slug: v.slug, coverUrl: v.coverUrl ?? null, visibility: v.visibility ?? null })
        })
        if (alive) setRows(list)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [uid])

  return (
    <div>
      <h1 className="text-2xl font-bold">Your profile</h1>
      {!uid && <div className="text-sm text-gray-500">Sign in to see your uploads.</div>}
      {uid && (
        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-gray-500">No uploads yet.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {rows.map(r => (
                <div key={r.id} className="border rounded p-2">
                  <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                    {r.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverUrl} alt={r.title} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm font-medium truncate" title={r.title}>{r.title}</div>
                  <div className="text-xs text-gray-500 truncate">{r.visibility}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

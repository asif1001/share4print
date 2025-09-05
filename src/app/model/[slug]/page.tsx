"use client"
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const ModelViewer = dynamic(() => import('@/components/ModelViewer'), { ssr: false })

type FileRow = { name: string; url: string; contentType: string | null; size: number }

function is3D(name: string) {
  const n = name.toLowerCase()
  return n.endsWith('.stl') || n.endsWith('.obj') || n.endsWith('.3mf')
}
function extToFormat(name: string): 'stl'|'obj'|'3mf'|null {
  const n = name.toLowerCase()
  if (n.endsWith('.stl')) return 'stl'
  if (n.endsWith('.obj')) return 'obj'
  if (n.endsWith('.3mf')) return '3mf'
  return null
}

export default function ModelPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug)
  const [loading, setLoading] = useState(true)
  const [model, setModel] = useState<any | null>(null)
  const [files, setFiles] = useState<FileRow[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // Find by slug (unique)
        const qref = query(collection(db, 'models'), where('slug', '==', slug), limit(1))
        const snap = await getDocs(qref)
        if (!alive) return
        if (snap.empty) {
          setModel(null)
          setFiles([])
          setActiveIndex(null)
          return
        }
        const docu = snap.docs[0]
        const d = docu.data() as any
        setModel({ id: docu.id, ...d })
        const f: FileRow[] = (d.files || []).map((x: any) => ({ name: x.name, url: x.url, contentType: x.contentType ?? null, size: x.size ?? 0 }))
        setFiles(f)
        // Default to first 3D file, else first file
        const idx = f.findIndex(ff => is3D(ff.name))
        setActiveIndex(idx >= 0 ? idx : (f.length > 0 ? 0 : null))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [slug])

  const active = useMemo(() => (activeIndex != null ? files[activeIndex] : null), [activeIndex, files])
  const activeFormat = active ? extToFormat(active.name) : null

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Loading…</div>
          ) : active && activeFormat ? (
            <ModelViewer src={active.url} format={activeFormat} />
          ) : active ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.url} alt={active.name} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">No preview</div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{model?.title ?? slug}</h1>
          <div className="text-sm text-gray-500">{model?.ownerUsername ? `by ${model.ownerUsername}` : ''} {model?.license ? `• ${model.license}` : ''}</div>
        </div>
        <div>
          <h2 className="font-semibold mb-2">Description</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{model?.description || '—'}</p>
        </div>
      </div>
      <aside className="space-y-4">
        <div className="border rounded p-3">
          <h3 className="font-semibold mb-2">Files</h3>
          {files.length === 0 ? (
            <div className="text-xs text-gray-500">No files</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[60vh] overflow-auto">
              {files.map((f, i) => (
                <button key={i} onClick={() => setActiveIndex(i)} className={`flex items-center gap-3 p-2 border rounded text-left ${i===activeIndex ? 'border-brand ring-2 ring-brand/20' : ''}`}>
                  <div className="w-16 h-10 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center">
                    {is3D(f.name) ? (
                      <span className="text-[10px] font-mono">{extToFormat(f.name)?.toUpperCase()}</span>
                    ) : (
                      <span className="text-[10px] font-mono">{(f.contentType ?? '').split('/')[1] || 'FILE'}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs truncate" title={f.name}>{f.name}</div>
                    <div className="text-[10px] text-gray-500">{(f.size/1024/1024).toFixed(2)} MB</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <a href={active?.url} download className="px-3 py-2 border rounded text-center text-sm">Download</a>
          <button className="px-3 py-2 border rounded text-sm">Like</button>
          <button className="px-3 py-2 border rounded text-sm">Save</button>
        </div>
        {model?.details && (
          <div className="border rounded p-3">
            <h3 className="font-semibold">Print settings</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              {model.details.layerHeight != null && (<li>Layer height: {model.details.layerHeight} mm</li>)}
              {model.details.infill != null && (<li>Infill: {model.details.infill}%</li>)}
              {model.details.supports != null && (<li>Supports: {model.details.supports ? 'Yes' : 'No'}</li>)}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}

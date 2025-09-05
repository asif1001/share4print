"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { auth, db, storage } from '@/lib/firebase'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { addDoc, collection, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore'
import { slugify } from '@/lib/slugify'
import ModelViewer from '@/components/ModelViewer'
import type { ModelViewerHandle, ModelDimensions } from '@/components/ModelViewer'
import { buildKeywords } from '@/lib/search'

export default function UploadPage() {
  const { register, handleSubmit, reset } = useForm()
  const [submitting, setSubmitting] = useState(false)
  const viewerRef = useRef<ModelViewerHandle | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [fileUrls, setFileUrls] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [coverChoice, setCoverChoice] = useState<'auto' | 'file' | 'image' | 'none'>('auto')
  const [coverFileIndex, setCoverFileIndex] = useState<number | null>(null)
  const [coverImage, setCoverImage] = useState<File | null>(null)
  // GIF upload/conversion removed for performance
  // Upload progress UI
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const uploadedBytesRef = useRef<number>(0)
  const [totalBytesPlanned, setTotalBytesPlanned] = useState<number>(0)
  // Track viewer readiness for reliable thumbnail capture
  const viewerReadyRef = useRef<boolean>(false)

  // Wait for the 3D viewer to report ready, with timeout fallback
  async function waitForViewerReady(timeoutMs = 5000) {
    const start = Date.now()
    while (!viewerReadyRef.current) {
      if (Date.now() - start > timeoutMs) break
      await new Promise(r => setTimeout(r, 50))
    }
    // Give R3F one more frame to render
    await new Promise(requestAnimationFrame)
  }
  // License options as per request/screenshots
  const licenseOptions = [
    { value: 'CC-BY', label: 'Creative Commons - Attribution' },
    { value: 'CC-BY-SA', label: 'Creative Commons - Attribution - Share Alike' },
    { value: 'CC-BY-ND', label: 'Creative Commons - Attribution - No Derivatives' },
    { value: 'CC-BY-NC', label: 'Creative Commons - Attribution - Non-Commercial' },
    { value: 'CC-BY-NC-SA', label: 'Creative Commons - Attribution - Non-Commercial - Share Alike' },
    { value: 'CC-BY-NC-ND', label: 'Creative Commons - Attribution - Non-Commercial - No Derivatives' },
    { value: 'CC0', label: 'Creative Commons - Public Domain Dedication' },
    { value: 'GPL', label: 'GNU - GPL' },
    { value: 'LGPL', label: 'GNU - LGPL' },
    { value: 'BSD', label: 'BSD License' },
  ] as const
  const onSubmit = async (data: any) => {
    // Must be signed in to upload
    if (!auth.currentUser) {
      alert('Please sign in to upload a project.')
      return
    }
    setSubmitting(true)
  try {
  // Ensure the latest auth token is present before hitting Storage rules
  try { await auth.currentUser?.getIdToken(true) } catch {}
  const fileList: File[] = files
  if (!fileList || fileList.length === 0) {
        alert('Please select at least one .stl/.obj/.3mf file')
        return
      }
  const file = fileList[0]
      const uid = auth.currentUser?.uid as string
  const title: string = data.title
      const modelSlug = slugify(title)
      const version = 'v1.0.0'
      // Try to resolve owner username (optional)
      let ownerUsername: string | null = null
      try {
        if (uid !== 'anon') {
          const uref = doc(db, 'users', uid)
          const usnap = await getDoc(uref)
          if (usnap.exists()) {
            const udata = usnap.data() as any
            ownerUsername = (udata.username as string) || (udata.displayName as string) || null
          }
        }
      } catch {}

      // Compute total bytes planned (we add cover later if needed)
      uploadedBytesRef.current = 0
      setUploadProgress(0)
      setUploadStatus('')
      let totalBytes = fileList.reduce((sum, f) => sum + (f.size || 0), 0)

  // Try to prepare/generate a thumbnail before uploading files
      let coverUrlRemote: string | null = null
      // helper to upload with progress
      const uploadWithProgress = async (blob: Blob, path: string, contentType: string, label: string) => {
        setUploadStatus(label)
        // If this is the first time we know this blob's size and we didn't include it yet, include it
        if (blob.size && label.toLowerCase().includes('cover')) {
          totalBytes += blob.size
          setTotalBytesPlanned(totalBytes)
        }
        const r = ref(storage, path)
        const task = uploadBytesResumable(r, blob, { contentType })
        const startUploaded = uploadedBytesRef.current
        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', (snap) => {
            const transferred = startUploaded + snap.bytesTransferred
            uploadedBytesRef.current = transferred
            const denom = totalBytes > 0 ? totalBytes : snap.totalBytes
            setUploadProgress(Math.max(0, Math.min(100, Math.round((transferred / Math.max(1, denom)) * 100))))
          }, reject, () => {
            uploadedBytesRef.current = startUploaded + task.snapshot.totalBytes
            const denom = totalBytes > 0 ? totalBytes : task.snapshot.totalBytes
            setUploadProgress(Math.max(0, Math.min(100, Math.round((uploadedBytesRef.current / Math.max(1, denom)) * 100))))
            resolve()
          })
        })
        return await getDownloadURL(task.snapshot.ref)
      }

      // Helper: snapshot the 3D viewer as a JPEG and upload
      const uploadViewerJpegCover = async (): Promise<string | null> => {
        try {
          // Prefer currently selected 3D preview if any; else pick the first 3D file
          let idx = selectedIndex != null && files[selectedIndex] && is3D(files[selectedIndex].name) ? selectedIndex : files.findIndex(f => is3D(f.name))
          if (idx == null || idx < 0) return null
          // If the current preview isn't the target idx, switch and wait
          if (selectedIndex !== idx) {
            const f = files[idx]
            const url = fileUrls[idx] || URL.createObjectURL(f)
            setPreviewUrl(url)
            setPreviewType(extToFormat(f.name))
            setSelectedIndex(idx)
            viewerReadyRef.current = false
            await waitForViewerReady()
          } else {
            await waitForViewerReady()
          }
          // Try our smarter thumbnail first, then fall back to a raw frame
          let dataUrl: string | undefined
          try {
            dataUrl = await viewerRef.current?.generateThumbnail({ width: 1200, height: 675, quality: 0.92 })
          } catch {}
          if (!dataUrl) {
            try { dataUrl = await viewerRef.current?.captureFrame?.({ mime: 'image/jpeg', quality: 0.92 }) } catch {}
          }
          if (!dataUrl) return null
          const blob = await (await fetch(dataUrl)).blob()
          const coverPath = `uploads/${uid}/${modelSlug}/${version}/cover.jpg`
          return await uploadWithProgress(blob, coverPath, 'image/jpeg', 'Uploading cover image…')
        } catch (e) {
          console.warn('Viewer snapshot fallback failed', e)
          return null
        }
      }

      // Initialize total planned bytes before uploads start
      setTotalBytesPlanned(totalBytes)

      try {
        if (coverChoice === 'image' && coverImage) {
          const coverPath = `uploads/${uid}/${modelSlug}/${version}/cover${getExt(coverImage.name) || '.jpg'}`
          totalBytes += coverImage.size || 0
          setTotalBytesPlanned(totalBytes)
          coverUrlRemote = await uploadWithProgress(coverImage, coverPath, coverImage.type || 'image/jpeg', 'Uploading cover image…')
  } else {
          // Auto or file-based behavior
          if (coverChoice === 'file' && coverFileIndex != null && coverFileIndex >= 0) {
            const cf = files[coverFileIndex]
            if (cf) {
              if (is3D(cf.name)) {
                const url = URL.createObjectURL(cf)
                setPreviewUrl(url)
                setPreviewType(extToFormat(cf.name))
                setSelectedIndex(coverFileIndex)
                viewerReadyRef.current = false
                await waitForViewerReady()
                let dataUrl = await viewerRef.current?.generateThumbnail({ width: 1200, height: 675, quality: 0.92 })
                if (!dataUrl) {
                  try { dataUrl = await viewerRef.current?.captureFrame?.({ mime: 'image/jpeg', quality: 0.92 }) } catch {}
                }
                if (dataUrl) {
                  const blob = await (await fetch(dataUrl)).blob()
                  const coverPath = `uploads/${uid}/${modelSlug}/${version}/cover.jpg`
                  coverUrlRemote = await uploadWithProgress(blob, coverPath, 'image/jpeg', 'Uploading cover image…')
                }
                URL.revokeObjectURL(url)
              } else if (isImage(cf.name)) {
                const ext = getExt(cf.name) || '.jpg'
                const ct = cf.type || (ext === '.gif' ? 'image/gif' : 'image/jpeg')
                const coverPath = `uploads/${uid}/${modelSlug}/${version}/cover${ext}`
                totalBytes += cf.size || 0
                setTotalBytesPlanned(totalBytes)
                coverUrlRemote = await uploadWithProgress(cf, coverPath, ct, 'Uploading cover image…')
              } else if (isVideo(cf.name)) {
                // No conversion now; fall back to viewer JPEG cover
                coverUrlRemote = await uploadViewerJpegCover()
              }
            }
          } else {
            // AUTO mode: prefer first 3D file; if none, use first image
            let idx3d = files.findIndex(f => is3D(f.name))
            if (idx3d >= 0) {
              const f = files[idx3d]
              const url = URL.createObjectURL(f)
              setPreviewUrl(url)
              setPreviewType(extToFormat(f.name))
              setSelectedIndex(idx3d)
              viewerReadyRef.current = false
              await waitForViewerReady()
              let dataUrl = await viewerRef.current?.generateThumbnail({ width: 1200, height: 675, quality: 0.92 })
              if (!dataUrl) {
                try { dataUrl = await viewerRef.current?.captureFrame?.({ mime: 'image/jpeg', quality: 0.92 }) } catch {}
              }
              if (dataUrl) {
                const blob = await (await fetch(dataUrl)).blob()
                const coverPath = `uploads/${uid}/${modelSlug}/${version}/cover.jpg`
                coverUrlRemote = await uploadWithProgress(blob, coverPath, 'image/jpeg', 'Uploading cover image…')
              }
              URL.revokeObjectURL(url)
            } else if (files[0] && isImage(files[0].name)) {
              const f = files[0]
              const ext = getExt(f.name) || '.jpg'
              const ct = f.type || 'image/jpeg'
              const coverPath = `uploads/${uid}/${modelSlug}/${version}/cover${ext}`
              totalBytes += f.size || 0
              setTotalBytesPlanned(totalBytes)
              coverUrlRemote = await uploadWithProgress(f, coverPath, ct, 'Uploading cover image…')
            } else {
              // Last resort: try viewer snapshot cover if any 3D file exists elsewhere
              coverUrlRemote = await uploadViewerJpegCover()
            }
          }
        }
      } catch (e) {
        console.warn('Thumbnail generation failed', e)
        try { if (!coverUrlRemote) coverUrlRemote = await uploadViewerJpegCover() } catch {}
      }

      // Upload all files
      const uploaded: { name: string; url: string; contentType: string | null; size: number }[] = []
      for (const f of fileList) {
        const fPath = `uploads/${uid}/${modelSlug}/${version}/${f.name}`
        setUploadStatus(`Uploading ${f.name}…`)
        const fUrl = await uploadWithProgress(
          f,
          fPath,
          f.type || 'application/octet-stream',
          `Uploading ${f.name}…`
        )
        uploaded.push({ name: f.name, url: fUrl, contentType: f.type || null, size: f.size })
      }

      // Minimal model document for demo
      // Parse tags
      const tags: string[] = (data.tags || '')
        .split(',')
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t.length > 0)

      // Build search keywords
      const keywords = buildKeywords(title, tags, ownerUsername || undefined)

      const modelRef = await addDoc(collection(db, 'models'), {
        title,
        description: data.description || '',
        category: data.category || 'other',
        tags,
        visibility: data.visibility || 'public',
        allowRemix: !!data.allowRemix,
        nsfw: !!data.nsfw,
        aiGenerated: !!data.aiGenerated,
        workInProgress: !!data.workInProgress,
        allowCustomizer: !!data.allowCustomizer,
        isRemix: !!data.isRemix,
        remixOf: data.remixOf || '',
        printSettings: data.printSettings || '',
        postPrinting: data.postPrinting || '',
        designNotes: data.designNotes || '',
        customSection: {
          title: data.customSectionTitle || '',
          body: data.customSectionBody || '',
        },
        details: {
          material: data.material || '',
          printer: data.printer || '',
          layerHeight: data.layerHeight ? Number(data.layerHeight) : null,
          nozzle: data.nozzle ? Number(data.nozzle) : null,
          supports: !!data.supports,
          infill: data.infill ? Number(data.infill) : null,
          scale: data.scale ? Number(data.scale) : null,
        },
        attribution: data.attribution || '',
        sourceUrl: data.sourceUrl || '',
        tipUrl: data.tipUrl || '',
        slug: modelSlug,
        ownerUid: uid,
        ownerUsername,
        license: data.license ?? 'CC0',
  coverUrl: coverUrlRemote ?? null,
  dimensions: dims ? { width: dims.width, height: dims.height, depth: dims.depth, units: dims.units || 'unitless' } : null,
        latestVersion: version,
        stats: { views: 0, downloads: 0, likes: 0, comments: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
  coverSource: coverChoice,
  coverFromFile: coverFileIndex != null ? files[coverFileIndex]?.name ?? null : null,
  files: uploaded,
        search: {
          titleLower: title.toLowerCase(),
          keywords,
        },
      })

      // Write a lightweight reference for the user's profile listings
      if (uid !== 'anon') {
        try {
          const uModelRef = doc(db, 'users', uid, 'models', modelRef.id)
          await setDoc(uModelRef, {
            modelId: modelRef.id,
            title,
            slug: modelSlug,
            coverUrl: coverUrlRemote ?? null,
            visibility: data.visibility || 'public',
            createdAt: serverTimestamp(),
          })
        } catch {}
      }

  setUploadProgress(100)
  setUploadStatus('Done')
  alert('Uploaded to Firebase Storage and saved a model entry!')
      reset()
      // cleanup preview
  if (previewUrl) URL.revokeObjectURL(previewUrl)
  setPreviewUrl(null)
  setPreviewType(null)
  fileUrls.forEach(u => URL.revokeObjectURL(u))
  setFiles([])
  setFileUrls([])
  setSelectedIndex(null)
  setCoverChoice('auto')
  setCoverFileIndex(null)
  setCoverImage(null)
    } catch (err: any) {
      console.error('Upload failed', err)
      const code = err?.code || ''
      const msg = (err && (err.message || err.toString())) || 'Unknown error'
      if (typeof window !== 'undefined' && code === 'storage/unauthorized') {
        alert('Upload failed: Not authorized to write to Storage. If you are signed in, this is often due to App Check enforcement being ON without a valid token. Either set NEXT_PUBLIC_APPCHECK_SITE_KEY and register a debug token, or temporarily disable App Check enforcement for Storage, or use the Storage emulator for local dev.')
      } else {
        alert('Upload failed: ' + msg)
      }
    } finally {
      setSubmitting(false)
      setUploadStatus('')
      setUploadProgress(0)
      setTotalBytesPlanned(0)
      uploadedBytesRef.current = 0
    }
  }

  // Show quick alerts for validation errors (e.g., terms not checked)
  const onInvalid = (errs: any) => {
    if (errs?.agreeToTerms) {
      alert('Please agree to the terms to proceed.')
      return
    }
    if (errs?.title) {
      alert('Please enter a title.')
      return
    }
  }

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<'stl'|'obj'|'3mf'|null>(null)
  const [dims, setDims] = useState<ModelDimensions | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const list = e.target.files ? Array.from(e.target.files) : []
    // cleanup old object URLs
    fileUrls.forEach(u => URL.revokeObjectURL(u))
    setFiles(list)
    const urls = list.map(f => URL.createObjectURL(f))
    setFileUrls(urls)
    setDims(null)
    // Select first 3D file for preview
    const idx = list.findIndex(f => is3D(f.name))
    const sel = idx >= 0 ? idx : (list.length > 0 ? 0 : null)
    setSelectedIndex(sel)
    if (sel != null) {
      const f = list[sel]
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(urls[sel])
      setPreviewType(extToFormat(f.name))
  // If previewing a 3D file, the viewer will signal readiness via onReady
  const willLoad3D = is3D(f.name)
  if (willLoad3D) viewerReadyRef.current = false
  setPreviewLoading(willLoad3D)
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      setPreviewType(null)
  setPreviewLoading(false)
    }
    // Default cover: first file becomes selected cover when any files exist
    if (list.length > 0) {
      setCoverChoice('file')
      setCoverFileIndex(0)
    } else {
      setCoverFileIndex(null)
    }
  }

  const onSelectPreview = (i: number) => {
  setSelectedIndex(i)
  const f = files[i]
  if (!f) return
  // reuse existing object URL for stability
  setPreviewUrl(fileUrls[i])
  setPreviewType(extToFormat(f.name))
  setDims(null)
  const willLoad3D = is3D(f.name)
  if (willLoad3D) viewerReadyRef.current = false
  setPreviewLoading(willLoad3D)
  }

  const onCoverImageChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] || null
    setCoverImage(f)
    if (f) setCoverChoice('image')
  }

  // GIF upload removed

  // Video→GIF conversion removed

  // FFmpeg loader removed

  function is3D(name: string) {
    const n = name.toLowerCase()
    return n.endsWith('.stl') || n.endsWith('.obj') || n.endsWith('.3mf')
  }
  function isImage(name: string) {
    const n = name.toLowerCase()
  return n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.webp')
  }
  function isVideo(name: string) {
    const n = name.toLowerCase()
    return n.endsWith('.mp4') || n.endsWith('.webm') || n.endsWith('.mov') || n.endsWith('.mkv') || n.endsWith('.avi')
  }
  function extToFormat(name: string): 'stl'|'obj'|'3mf'|null {
    const n = name.toLowerCase()
    if (n.endsWith('.stl')) return 'stl'
    if (n.endsWith('.obj')) return 'obj'
    if (n.endsWith('.3mf')) return '3mf'
    return null
  }
  function getExt(name: string) {
    const i = name.lastIndexOf('.')
    return i >= 0 ? name.slice(i) : ''
  }

  function onRemoveFile(i: number) {
    const nextFiles = files.slice()
    nextFiles.splice(i, 1)
    const nextUrls = fileUrls.slice()
    const removedUrl = nextUrls.splice(i, 1)[0]
    if (removedUrl) URL.revokeObjectURL(removedUrl)

    // Adjust selected preview
    let nextSelected: number | null = selectedIndex
    if (selectedIndex === i) {
      // choose next item or previous
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (nextFiles.length > 0) {
        const newIndex = i < nextFiles.length ? i : nextFiles.length - 1
        nextSelected = newIndex
        setPreviewUrl(nextUrls[newIndex] ?? null)
        setPreviewType(extToFormat(nextFiles[newIndex].name))
      } else {
        nextSelected = null
        setPreviewUrl(null)
        setPreviewType(null)
      }
      setDims(null)
    } else if (selectedIndex != null && selectedIndex > i) {
      nextSelected = selectedIndex - 1
    }

    // Adjust cover selection if needed
    if (coverChoice === 'file') {
      if (coverFileIndex === i) setCoverFileIndex(null)
      else if (coverFileIndex != null && coverFileIndex > i) setCoverFileIndex(coverFileIndex - 1)
    }

    setFiles(nextFiles)
    setFileUrls(nextUrls)
    setSelectedIndex(nextSelected)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Upload a model</h1>
  <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left: Project details */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input className="w-full border rounded p-2" placeholder="Title" {...register('title', { required: true })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea className="w-full border rounded p-2" placeholder="Describe your project" rows={6} {...register('description')} />
          </div>
          {/* Basic information */}
          <div className="border rounded p-4 space-y-3">
            <div className="font-medium text-sm">Basic information</div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" {...register('aiGenerated')} />
              <span>AI generated content</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" {...register('workInProgress')} />
              <span>Work in progress</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" {...register('allowCustomizer')} />
              <span>Allow Customizer/derivatives</span>
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" {...register('isRemix')} />
                <span>This is a remix</span>
              </label>
              <input className="w-full border rounded p-2" placeholder="Original model/source (URL or title)" {...register('remixOf')} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Category</label>
              <select className="w-full border rounded p-2" {...register('category')}>
                <option value="miniatures">Miniatures</option>
                <option value="figurines">Figurines</option>
                <option value="tools">Tools</option>
                <option value="household">Household</option>
                <option value="art">Art</option>
                <option value="toys">Toys</option>
                <option value="electronics">Electronics</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">License</label>
              <select className="w-full border rounded p-2" {...register('license', { required: true })} defaultValue={licenseOptions[0].value}>
                {licenseOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Tags</label>
            <input className="w-full border rounded p-2" placeholder="e.g. figure, fantasy, base" {...register('tags')} />
            <p className="text-xs text-gray-500">Comma-separated tags</p>
          </div>
          {/* Print info sections */}
          <div className="border rounded p-4 space-y-3">
            <div className="font-medium text-sm">Print settings</div>
            <textarea className="w-full border rounded p-2" rows={4} placeholder="Layer height, supports, material, etc." {...register('printSettings')} />
            <div className="font-medium text-sm">Post-printing</div>
            <textarea className="w-full border rounded p-2" rows={3} placeholder="Sanding, priming, painting, assembly..." {...register('postPrinting')} />
            <div className="font-medium text-sm">How I designed this</div>
            <textarea className="w-full border rounded p-2" rows={3} placeholder="Tools, techniques, references" {...register('designNotes')} />
          </div>

          {/* Detailed print parameters */}
          <div className="border rounded p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Material</label>
              <input className="w-full border rounded p-2" placeholder="PLA, ABS, Resin..." {...register('material')} />
            </div>
            <div>
              <label className="block text-sm mb-1">Printer</label>
              <input className="w-full border rounded p-2" placeholder="Printer model" {...register('printer')} />
            </div>
            <div>
              <label className="block text-sm mb-1">Layer height (mm)</label>
              <input type="number" step="0.01" className="w-full border rounded p-2" {...register('layerHeight')} />
            </div>
            <div>
              <label className="block text-sm mb-1">Nozzle (mm)</label>
              <input type="number" step="0.01" className="w-full border rounded p-2" {...register('nozzle')} />
            </div>
            <div>
              <label className="block text-sm mb-1">Infill (%)</label>
              <input type="number" step="1" min="0" max="100" className="w-full border rounded p-2" {...register('infill')} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" {...register('supports')} />
              <span className="text-sm">Supports used</span>
            </div>
            <div>
              <label className="block text-sm mb-1">Scale (%)</label>
              <input type="number" step="1" className="w-full border rounded p-2" {...register('scale')} />
            </div>
          </div>

          {/* Custom section */}
          <div className="border rounded p-4 space-y-2">
            <div className="font-medium text-sm">Custom section</div>
            <input className="w-full border rounded p-2" placeholder="Section title (optional)" {...register('customSectionTitle')} />
            <textarea className="w-full border rounded p-2" rows={3} placeholder="Add any extra info" {...register('customSectionBody')} />
          </div>

          {/* Terms & Conditions */}
          <div className="border rounded p-4 space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" {...register('agreeToTerms', { required: true })} />
              <span>I acknowledge and agree to the terms and conditions of uploading.</span>
            </label>
            <p className="text-xs text-gray-500">No illegal, dangerous, or harmful items. Respect others' IP and privacy.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Attribution</label>
              <input className="w-full border rounded p-2" placeholder="Creator name / attribution" {...register('attribution')} />
            </div>
            <div>
              <label className="block text-sm mb-1">Source URL</label>
              <input className="w-full border rounded p-2" placeholder="https://..." {...register('sourceUrl')} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Tip/Donation URL</label>
              <input className="w-full border rounded p-2" placeholder="https://..." {...register('tipUrl')} />
            </div>
            <div>
              <label className="block text-sm mb-1">Visibility</label>
              <select className="w-full border rounded p-2" {...register('visibility')}>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('allowRemix')} />
              Allow remix
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('nsfw')} />
              Mark as sensitive/NSFW
            </label>
          </div>
          <div>
            <button disabled={submitting} className="px-4 py-2 bg-brand text-white rounded">{submitting ? `Uploading… ${uploadProgress}%` : 'Upload'}</button>
            {submitting && (
              <div className="mt-2 text-xs text-gray-600">
                {uploadStatus || 'Uploading…'}
                <div className="h-2 bg-gray-200 rounded mt-1 overflow-hidden">
                  <div className="h-2 bg-blue-500" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Files + Preview */}
        <div className="space-y-3">
      <div className="border rounded p-3 bg-blue-50 text-blue-900 text-sm">
            <div className="font-medium">Tip: You can upload multiple files for one project</div>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Select multiple .stl, .obj, .3mf and image files at once.</li>
              <li>Use Preview to view any 3D file; the viewer updates instantly.</li>
  <li>Choose a thumbnail: Auto snapshot, or pick a 3D file to snapshot, or upload an image.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <label className="block text-sm mb-1">Files (.stl, .obj, .3mf, images)</label>
            <input type="file" multiple accept=".stl,.obj,.3mf,.png,.jpg,.jpeg,.webp" onChange={onFileChange} />
            <p className="text-xs text-gray-500">Select one or more files for this project.</p>
            {files.length > 0 && (
              <div className="border rounded divide-y">
                {files.map((f, i) => (
          <div key={i} className="flex items-center justify-between gap-3 p-2">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{f.name}</div>
                      <div className="text-[11px] text-gray-500">{(f.size/1024/1024).toFixed(2)} MB • {f.type || 'application/octet-stream'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" className="text-xs px-2 py-1 border rounded" onClick={() => onSelectPreview(i)}>Preview</button>
                      <label className="inline-flex items-center gap-1 text-xs">
                        <input type="radio" name="coverFile" checked={coverFileIndex === i && coverChoice === 'file'} onChange={() => { setCoverChoice('file'); setCoverFileIndex(i); }} /> Cover
                      </label>
            <button type="button" className="text-xs px-2 py-1 border rounded text-red-600" onClick={() => onRemoveFile(i)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="font-medium text-sm">Thumbnail</div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="coverChoice" checked={coverChoice === 'auto'} onChange={() => setCoverChoice('auto')} />
                <span>Auto-generate from preview</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="coverChoice" checked={coverChoice === 'file'} onChange={() => setCoverChoice('file')} />
                <span>Use snapshot of chosen file</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="coverChoice" checked={coverChoice === 'image'} onChange={() => setCoverChoice('image')} />
                <span>Upload image</span>
              </label>
              {/* GIF/Video conversion removed for performance */}
            </div>
          
            {coverChoice === 'image' && (
              <input type="file" accept="image/*" onChange={onCoverImageChange} />
            )}
            
          </div>
          <div className="relative w-full h-[323px] sm:h-[391px] lg:h-[544px] bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
            {(() => {
              // Prefer immediate previewUrl to avoid any race with fileUrls state
              if (previewUrl) {
                if (previewType) {
                  return (
                    <div className="absolute inset-0">
                      <ModelViewer ref={viewerRef} src={previewUrl} format={previewType} onDimensions={setDims} onReady={() => { viewerReadyRef.current = true; setPreviewLoading(false) }} />
                      {previewLoading && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-transparent">
                          <div className="text-xs px-2 py-1 rounded bg-black/50 text-white">Preparing 3D preview…</div>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-2 z-10">
                        <button type="button" title="Flip upside down" onClick={() => viewerRef.current?.toggleUpsideDown?.()} className="px-2 py-1 text-xs bg-white/80 dark:bg-black/40 backdrop-blur rounded border">Flip</button>
                        <button type="button" title="Spin Y" onClick={() => viewerRef.current?.toggleAutoRotate?.()} className="px-2 py-1 text-xs bg-white/80 dark:bg-black/40 backdrop-blur rounded border">Spin Y</button>
                        <button type="button" title="Spin X" onClick={() => viewerRef.current?.toggleAutoRotateX?.()} className="px-2 py-1 text-xs bg-white/80 dark:bg-black/40 backdrop-blur rounded border">Spin X</button>
                        <button type="button" title="Spin Z" onClick={() => viewerRef.current?.toggleAutoRotateZ?.()} className="px-2 py-1 text-xs bg-white/80 dark:bg-black/40 backdrop-blur rounded border">Spin Z</button>
                      </div>
                    </div>
                  )
                }
                // If type is not a 3D format, use the selected file's mime by name
                const f = selectedIndex != null ? files[selectedIndex] : null
                if (f && isImage(f.name)) {
                  return (
                    <div className="absolute inset-0 flex items-center justify-center bg-white">
                      <img src={previewUrl} alt={f.name} className="max-w-full max-h-full object-contain" />
                    </div>
                  )
                }
                if (f && isVideo(f.name)) {
                  return (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                      <video src={previewUrl} className="max-w-full max-h-full" controls muted loop playsInline />
                    </div>
                  )
                }
              }
              // Fallback: use arrays if previewUrl not set yet
              if (selectedIndex != null && files[selectedIndex]) {
                const f = files[selectedIndex]
                const url = fileUrls[selectedIndex]
                if (url) {
                  if (is3D(f.name)) {
                    return (
                      <div className="absolute inset-0">
                        <ModelViewer ref={viewerRef} src={url} format={extToFormat(f.name)!} onDimensions={setDims} onReady={() => { viewerReadyRef.current = true; setPreviewLoading(false) }} />
                        {previewLoading && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-transparent">
                            <div className="text-xs px-2 py-1 rounded bg-black/50 text-white">Preparing 3D preview…</div>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 flex gap-2 z-10">
                          <button type="button" title="Flip upside down" onClick={() => viewerRef.current?.toggleUpsideDown?.()} className="px-2 py-1 text-xs bg-white/80 dark:bg-black/40 backdrop-blur rounded border">Flip</button>
                          <button type="button" title="Spin Y" onClick={() => viewerRef.current?.toggleAutoRotate?.()} className="px-2 py-1 text-xs bg-white/80 dark:bg-black/40 backdrop-blur rounded border">Spin Y</button>
                          <button type="button" title="Spin X" onClick={() => viewerRef.current?.toggleAutoRotateX?.()} className="px-2 py-1 text-xs bg-white/80 dark:bg-black/40 backdrop-blur rounded border">Spin X</button>
                          <button type="button" title="Spin Z" onClick={() => viewerRef.current?.toggleAutoRotateZ?.()} className="px-2 py-1 text-xs bg-white/80 dark:bg-black/40 backdrop-blur rounded border">Spin Z</button>
                        </div>
                      </div>
                    )
                  } else if (isImage(f.name)) {
                    return (
                      <div className="absolute inset-0 flex items-center justify-center bg-white">
                        <img src={url} alt={f.name} className="max-w-full max-h-full object-contain" />
                      </div>
                    )
                  } else if (isVideo(f.name)) {
                    return (
                      <div className="absolute inset-0 flex items-center justify-center bg-black">
                        <video src={url} className="max-w-full max-h-full" controls muted loop playsInline />
                      </div>
                    )
                  }
                }
              }
              return (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm text-gray-500">No preview yet</span>
                </div>
              )
            })()}
          </div>
          {dims && (
            <div className="text-xs text-gray-600 dark:text-gray-300">
              <span className="font-medium">Estimated size:</span>
              <span> W {dims.width.toFixed(2)} × H {dims.height.toFixed(2)} × D {dims.depth.toFixed(2)} (model units)</span>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}

"use client"
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, OrbitControls, Html } from '@react-three/drei'
import React, { ForwardedRef, Suspense, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Box3, Group, PerspectiveCamera, Vector3 } from 'three'

const STLLoader = dynamic(() => import('@/components/STL'), { ssr: false, suspense: true })
const OBJLoaderComp = dynamic(() => import('@/components/OBJ'), { ssr: false, suspense: true })
const ThreeMFComp = dynamic(() => import('@/components/ThreeMF'), { ssr: false, suspense: true })

type Format = 'stl' | 'obj' | '3mf'

function inferFormat(src: string): Format | null {
  const s = src.toLowerCase()
  if (s.endsWith('.stl')) return 'stl'
  if (s.endsWith('.obj')) return 'obj'
  if (s.endsWith('.3mf')) return '3mf'
  return null
}

export type ModelViewerHandle = {
  generateThumbnail: (opts?: { width?: number; height?: number; quality?: number }) => Promise<string>
  // Controls
  setAutoRotate: (on: boolean, speedRadPerSec?: number) => void
  startAutoRotate: (speedRadPerSec?: number) => void
  stopAutoRotate: () => void
  toggleAutoRotate: (speedRadPerSec?: number) => void
  // Axis-specific rotate toggles
  toggleAutoRotateX: (speedRadPerSec?: number) => void
  toggleAutoRotateZ: (speedRadPerSec?: number) => void
  setAutoRotateAxis: (axis: 'x'|'y'|'z', on: boolean, speedRadPerSec?: number) => void
  setUpsideDown: (on: boolean) => void
  toggleUpsideDown: () => void
  // Frame capture + direct stepping
  captureFrame: (opts?: { mime?: 'image/png'|'image/jpeg'; quality?: number }) => Promise<string>
  stepRotate: (axis: 'x'|'y'|'z', radians: number) => void
}

export type ModelDimensions = { width: number; height: number; depth: number; units?: string }

class ViewerErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message?: string }>{
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: (err as Error)?.message || 'Failed to load model' }
  }
  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.warn('Model viewer error:', err)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
            Could not load 3D model. {this.state.message}
          </div>
        </div>
      )
    }
    return this.props.children as JSX.Element
  }
}

function ModelViewerImpl(
  { src, format, onDimensions, onReady }: { src: string; format?: Format; onDimensions?: (d: ModelDimensions) => void; onReady?: () => void },
  ref: ForwardedRef<ModelViewerHandle>
) {
  // Basic WebGL capability detection to avoid blank canvas on unsupported devices
  const [glSupported, setGlSupported] = useState<boolean | null>(null)
  const [autoRotate, setAutoRotateState] = useState(false)
  const [autoRotateX, setAutoRotateX] = useState(false)
  const [autoRotateZ, setAutoRotateZ] = useState(false)
  const [rotateSpeed, setRotateSpeed] = useState(0.7) // radians per second
  const [flipped, setFlipped] = useState(false)
  useEffect(() => {
    try {
      const c = document.createElement('canvas')
      const ok = !!(c.getContext('webgl') || c.getContext('experimental-webgl') || c.getContext('webgl2'))
      setGlSupported(ok)
    } catch {
      setGlSupported(false)
    }
  }, [])

  const fmt = format ?? inferFormat(src)
  // Expose imperative API via a child that knows about the scene
  const apiRef = useRef<Partial<ModelViewerHandle> | null>(null)
  useImperativeHandle(ref, () => ({
    async generateThumbnail(options) {
  if (!apiRef.current?.generateThumbnail) throw new Error('Viewer not ready')
  return apiRef.current.generateThumbnail(options)
    },
    async captureFrame(options) {
      if (!apiRef.current?.captureFrame) throw new Error('Viewer not ready')
      return apiRef.current.captureFrame(options)
    },
    stepRotate(axis, radians) {
      apiRef.current?.stepRotate?.(axis, radians)
    },
    setAutoRotate(on: boolean, speed?: number) {
      setAutoRotateState(on)
      if (speed && speed > 0) setRotateSpeed(speed)
    },
    startAutoRotate(speed?: number) {
      setAutoRotateState(true)
      if (speed && speed > 0) setRotateSpeed(speed)
    },
    stopAutoRotate() {
      setAutoRotateState(false)
    },
    toggleAutoRotate(speed?: number) {
      setAutoRotateState(v => !v)
      if (speed && speed > 0) setRotateSpeed(speed)
    },
    toggleAutoRotateX(speed?: number) {
      setAutoRotateX(v => !v)
      if (speed && speed > 0) setRotateSpeed(speed)
    },
    toggleAutoRotateZ(speed?: number) {
      setAutoRotateZ(v => !v)
      if (speed && speed > 0) setRotateSpeed(speed)
    },
    setAutoRotateAxis(axis: 'x'|'y'|'z', on: boolean, speed?: number) {
      if (axis === 'y') setAutoRotateState(on)
      if (axis === 'x') setAutoRotateX(on)
      if (axis === 'z') setAutoRotateZ(on)
      if (speed && speed > 0) setRotateSpeed(speed)
    },
    setUpsideDown(on: boolean) {
      setFlipped(on)
    },
    toggleUpsideDown() {
      setFlipped(v => !v)
    },
  }))
  if (glSupported === false) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-xs text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-black/40 px-3 py-2 rounded">
          WebGL is not available. Please enable hardware acceleration in your browser or try a different browser/device.
        </div>
      </div>
    )
  }
  if (glSupported === null) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-xs text-gray-600 dark:text-gray-300">Preparing 3D viewer…</div>
      </div>
    )
  }
  return (
    <ViewerErrorBoundary>
      <Canvas camera={{ position: [2, 2, 2], fov: 50 }} className="w-full h-full" gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={[0xf5f5f5]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Suspense fallback={
          <Html center>
            <div style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.6)',
              color: 'white',
              fontSize: 12,
              letterSpacing: 0.2
            }}>
              Loading 3D preview…
            </div>
          </Html>
        }>
          <AutoScale key={src} dep={src} targetSize={2} apiRef={apiRef} onDimensions={onDimensions} onReady={onReady} autoRotate={autoRotate} autoRotateX={autoRotateX} autoRotateZ={autoRotateZ} rotateSpeed={rotateSpeed} flipped={flipped}>
            {fmt === 'stl' && <STLLoader url={src} />}
            {fmt === 'obj' && <OBJLoaderComp url={src} />}
            {fmt === '3mf' && <ThreeMFComp url={src} />}
          </AutoScale>
        </Suspense>
        <Environment preset="city" />
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} minDistance={0.05} maxDistance={500} />
      </Canvas>
    </ViewerErrorBoundary>
  )
}

export default forwardRef<ModelViewerHandle, { src: string; format?: Format; onDimensions?: (d: ModelDimensions) => void; onReady?: () => void }>(ModelViewerImpl)

function AutoScale({ children, targetSize = 2, dep, apiRef, onDimensions, onReady, autoRotate = false, autoRotateX = false, autoRotateZ = false, rotateSpeed = 0.7, flipped = false }: { children: React.ReactNode; targetSize?: number; dep?: string; apiRef?: React.MutableRefObject<Partial<ModelViewerHandle> | null>; onDimensions?: (d: ModelDimensions) => void; onReady?: () => void; autoRotate?: boolean; autoRotateX?: boolean; autoRotateZ?: boolean; rotateSpeed?: number; flipped?: boolean }) {
  const groupRef = useRef<Group>(null)
  const { camera, size: viewport, controls, gl } = useThree()
  const initializedRef = useRef(false)
  // Keep dynamic controls in refs so useFrame sees latest values
  const autoRotateRef = useRef(autoRotate)
  const autoRotateXRef = useRef(autoRotateX)
  const autoRotateZRef = useRef(autoRotateZ)
  const rotateSpeedRef = useRef(rotateSpeed)
  const flippedRef = useRef(flipped)
  useEffect(() => { autoRotateRef.current = autoRotate }, [autoRotate])
  useEffect(() => { autoRotateXRef.current = autoRotateX }, [autoRotateX])
  useEffect(() => { autoRotateZRef.current = autoRotateZ }, [autoRotateZ])
  useEffect(() => { rotateSpeedRef.current = rotateSpeed }, [rotateSpeed])
  useEffect(() => { flippedRef.current = flipped }, [flipped])
  // Apply auto-rotation each frame if enabled, and initialize framing once children exist
  useFrame((_state: unknown, delta: number) => {
    const g = groupRef.current
    if (!g) return
    // Initialize framing once when content exists
    if (!initializedRef.current && g.children.length > 0) {
      // Measure and frame
      const box = new Box3().setFromObject(g)
      const bboxSize = new Vector3()
      const center = new Vector3()
      const min = box.min.clone()
      box.getSize(bboxSize)
      box.getCenter(center)
      const maxDim = Math.max(bboxSize.x, bboxSize.y, bboxSize.z) || 1
      onDimensions?.({ width: bboxSize.x, height: bboxSize.y, depth: bboxSize.z, units: 'unitless' })
      const scale = targetSize / maxDim
      const minCentered = min.sub(center)
      const yOffset = -minCentered.y * scale
      g.scale.setScalar(scale)
      g.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
      g.position.y += yOffset
      const scaledSize = new Vector3(bboxSize.x * scale, bboxSize.y * scale, bboxSize.z * scale)
      const cam = camera as PerspectiveCamera
      const aspect = cam.aspect || (viewport.width > 0 && viewport.height > 0 ? viewport.width / viewport.height : 16 / 9)
      const vFov = (cam.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
      const fitHeightDist = (scaledSize.y / 2) / Math.tan(vFov / 2)
      const fitWidthDist = (scaledSize.x / 2) / Math.tan(hFov / 2)
      const distance = Math.max(fitHeightDist, fitWidthDist) * 1.25
      const targetY = scaledSize.y * 0.8
      const target = new Vector3(0, targetY, 0)
      cam.position.set(target.x + distance, target.y + distance * 0.5, target.z + distance)
      cam.near = Math.max(0.01, distance / 100)
      cam.far = distance * 100
      cam.updateProjectionMatrix()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctrl: any = controls
      if (ctrl && ctrl.target) {
        ctrl.target.copy(target)
        ctrl.update?.()
      }
      initializedRef.current = true
      onReady?.()
    }
    if (autoRotateRef.current) {
      g.rotation.y += rotateSpeedRef.current * delta
    }
    if (autoRotateXRef.current) {
      g.rotation.x += rotateSpeedRef.current * delta
    }
    if (autoRotateZRef.current) {
      g.rotation.z += rotateSpeedRef.current * delta
    }
    // Upside down toggle: if flipped, snap to PI only when X spin is off
    if (flippedRef.current) {
      if (!autoRotateXRef.current) {
        g.rotation.x = Math.PI
      }
    }
  })
  useEffect(() => {
    // Reset initialization when src/dep changes
    initializedRef.current = false
  }, [dep, targetSize])

  // Imperative thumbnail API
  useEffect(() => {
    if (!apiRef) return
  apiRef.current = {
      generateThumbnail: async ({ width = 1200, height = 675, quality = 0.92 } = {}) => {
        const g = groupRef.current
        const cam = camera as PerspectiveCamera
        if (!g) throw new Error('Model not loaded')

        // Compute bbox in world after scaling/positioning
        const box = new Box3().setFromObject(g)
        const bboxSize = new Vector3()
        const center = new Vector3()
        box.getSize(bboxSize)
        box.getCenter(center)

        // Distance to fit
        const aspect = width / height
        const vFov = (cam.fov * Math.PI) / 180
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
        const fitHeightDist = (bboxSize.y / 2) / Math.tan(vFov / 2)
        const fitWidthDist = (bboxSize.x / 2) / Math.tan(hFov / 2)
        const baseDistance = Math.max(fitHeightDist, fitWidthDist) * 1.25

        // Sample azimuth angles and pick the one with max projected area of bbox
        const angles = [15, 35, 45, 60, 120, 225].map(a => (a * Math.PI) / 180)
        let best = { area: -Infinity, pos: new Vector3() }
        const up = new Vector3(0, 1, 0)
        const target = new Vector3(0, bboxSize.y * 0.8, 0)

        // Helper to project bbox corners and compute area in NDC
        const corners = [
          new Vector3(box.min.x, box.min.y, box.min.z),
          new Vector3(box.min.x, box.min.y, box.max.z),
          new Vector3(box.min.x, box.max.y, box.min.z),
          new Vector3(box.min.x, box.max.y, box.max.z),
          new Vector3(box.max.x, box.min.y, box.min.z),
          new Vector3(box.max.x, box.min.y, box.max.z),
          new Vector3(box.max.x, box.max.y, box.min.z),
          new Vector3(box.max.x, box.max.y, box.max.z),
        ]

        for (const a of angles) {
          const pos = new Vector3(
            target.x + Math.cos(a) * baseDistance,
            target.y + baseDistance * 0.5,
            target.z + Math.sin(a) * baseDistance
          )
          // Temporarily set camera to compute projection
          const prevPos = cam.position.clone()
          const prevUp = cam.up.clone()
          cam.position.copy(pos)
          cam.up.copy(up)
          cam.lookAt(target)
          cam.updateMatrixWorld()

          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (const c of corners) {
            const p = c.clone().project(cam)
            minX = Math.min(minX, p.x)
            minY = Math.min(minY, p.y)
            maxX = Math.max(maxX, p.x)
            maxY = Math.max(maxY, p.y)
          }
          const area = Math.max(0, (maxX - minX)) * Math.max(0, (maxY - minY))
          if (area > best.area) best = { area, pos }

          cam.position.copy(prevPos)
          cam.up.copy(prevUp)
        }

        // Apply best camera position
        const prevPos = cam.position.clone()
        const prevNear = cam.near
        const prevFar = cam.far
        cam.position.copy(best.pos)
        cam.near = Math.max(0.01, baseDistance / 100)
        cam.far = baseDistance * 100
        cam.lookAt(target)
        cam.updateProjectionMatrix()

        // Render a frame and capture
        // R3F renders continuously by default, so we can wait a tick
        await new Promise(requestAnimationFrame)
        const canvas = (cam as any)._renderer?.domElement || document.querySelector('canvas')
        if (!canvas) throw new Error('Canvas not found')
        const dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/jpeg', quality)

        // Restore camera
        cam.position.copy(prevPos)
        cam.near = prevNear
        cam.far = prevFar
        cam.updateProjectionMatrix()

        return dataUrl
      },
      captureFrame: async ({ mime = 'image/png', quality = 0.92 } = {}) => {
        // Wait a frame to ensure latest scene is rendered
        await new Promise(requestAnimationFrame)
        const canvas = gl?.domElement || (document.querySelector('canvas') as HTMLCanvasElement | null)
        if (!canvas) throw new Error('Canvas not found')
        return canvas.toDataURL(mime, quality as number)
      },
      stepRotate: (axis: 'x'|'y'|'z', radians: number) => {
        const g = groupRef.current
        if (!g) return
        if (axis === 'x') g.rotation.x += radians
        else if (axis === 'y') g.rotation.y += radians
        else g.rotation.z += radians
      },
  setAutoRotate: (on: boolean, speed?: number) => {
        // handled in parent component via state; noop here for typing completeness
      },
      startAutoRotate: (speed?: number) => {
        // noop; control provided by parent via state
      },
      stopAutoRotate: () => {
        // noop
      },
      toggleAutoRotate: (speed?: number) => {
        // noop
      },
      toggleAutoRotateX: (speed?: number) => {
        // noop
      },
      toggleAutoRotateZ: (speed?: number) => {
        // noop
      },
      setAutoRotateAxis: (_axis: 'x'|'y'|'z', _on: boolean, _speed?: number) => {
        // noop
      },
      setUpsideDown: (on: boolean) => {
        // noop; state lives in parent
      },
      toggleUpsideDown: () => {
        // noop
      },
    }
    return () => {
      if (apiRef) apiRef.current = null
    }
  }, [apiRef, camera])

  return <group ref={groupRef}>{children}</group>
}

"use client"
import { useLoader } from '@react-three/fiber'
import { ThreeMFLoader } from 'three-stdlib'

export default function ThreeMF({ url }: { url: string }) {
  const model = useLoader(ThreeMFLoader, url)
  return <primitive object={model} />
}

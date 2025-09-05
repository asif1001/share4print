"use client"
import { useLoader } from '@react-three/fiber'
import { STLLoader } from 'three-stdlib'
import { MeshStandardMaterial } from 'three'

export default function STL({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url)
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#2F70FE" metalness={0.1} roughness={0.6} />
    </mesh>
  )
}

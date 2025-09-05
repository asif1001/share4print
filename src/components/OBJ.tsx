"use client"
import { useLoader } from '@react-three/fiber'
import { OBJLoader } from 'three-stdlib'

export default function OBJ({ url }: { url: string }) {
  const object = useLoader(OBJLoader, url)
  return <primitive object={object} />
}

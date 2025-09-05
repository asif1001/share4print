export type License = 'CC0' | 'CC-BY' | 'CC-BY-NC' | 'NC'

export interface UserProfile {
  uid: string
  username: string
  displayName?: string
  avatarUrl?: string
  bio?: string
  links?: { label: string; url: string }[]
  donationUrl?: string
  roles?: ('admin')[]
  stats?: { models: number; downloads: number; likes: number }
  createdAt: number
  updatedAt: number
}

export interface ModelFileMeta {
  name: string
  path: string
  size: number
  contentType: string
  downloadURL: string
}

export interface ModelVersion {
  id: string
  version: string
  changelog?: string
  files: ModelFileMeta[]
  createdAt: number
}

export interface Model {
  id: string
  slug: string
  title: string
  description?: string
  ownerUid: string
  ownerUsername?: string
  coverUrl?: string
  gallery?: string[]
  categories?: string[]
  tags?: string[]
  license: License
  print?: { layerHeight?: string; infill?: string; supports?: boolean | string; materials?: string[]; printer?: string }
  stats?: { views: number; downloads: number; likes: number; comments: number }
  latestVersion?: string
  createdAt: number
  updatedAt: number
}

export interface CommentDoc {
  id: string
  modelId: string
  authorUid: string
  authorName?: string
  rating?: number
  text: string
  createdAt: number
}

export interface CollectionDoc {
  id: string
  ownerUid: string
  name: string
  isPrivate: boolean
  modelIds: string[]
  createdAt: number
}

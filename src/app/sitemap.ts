import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://share4print.web.app'
  return [
    { url: base, lastModified: new Date() },
    { url: base + '/explore', lastModified: new Date() },
  ]
}

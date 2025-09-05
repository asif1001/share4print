export function buildKeywords(title: string, tags: string[] = [], ownerUsername?: string) {
  const words = new Set<string>()
  const push = (s?: string) => {
    if (!s) return
    for (const w of s
      .toLowerCase()
      .replace(/[^a-z0-9_\-\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)) {
      if (w.length >= 2 && w.length <= 48) words.add(w)
    }
  }
  push(title)
  tags.forEach(t => push(t))
  push(ownerUsername)
  // Also add joined tag strings for phrase-like contains-any matches (up to length limits)
  const tagPhrases = tags
    .map(t => t.toLowerCase().trim())
    .filter(Boolean)
  tagPhrases.forEach(tp => words.add(tp))
  return Array.from(words)
}

export function tokenizeQuery(q: string) {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)
}
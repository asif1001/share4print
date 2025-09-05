// Copy ffmpeg.wasm core files to public/ffmpeg so Next.js can serve them
const fs = require('fs')
const path = require('path')

function copy(src, dest) {
  if (!fs.existsSync(src)) return false
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  return true
}

const nm = path.join(__dirname, '..', 'node_modules', '@ffmpeg', 'core', 'dist')
const pub = path.join(__dirname, '..', 'public', 'ffmpeg')

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js']
let ok = false
for (const f of files) {
  const s = path.join(nm, f)
  const d = path.join(pub, f)
  const res = copy(s, d)
  ok = ok || res
}

if (!ok) {
  console.warn('[copy-ffmpeg-core] Core files not found. Skipping copy; CDN fallback will be used.')
} else {
  console.log('[copy-ffmpeg-core] ffmpeg core files copied to /public/ffmpeg')
}

"use client"
import { useTheme } from 'next-themes'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="px-3 py-1 border rounded text-sm"
      title="Toggle theme"
    >
      {isDark ? 'Light' : 'Dark'}
    </button>
  )
}

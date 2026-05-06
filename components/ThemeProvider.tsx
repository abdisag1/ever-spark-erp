'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'forest' | 'ocean' | 'earth' | 'dark'

export const THEMES: {
  id: Theme
  label: string
  description: string
  primary: string
  sidebar: string
  accent: string
  dark?: boolean
}[] = [
  { id: 'forest', label: 'Forest',    description: 'Deep green & amber — brand default', primary: '#1db89d', sidebar: '#1b4332', accent: '#f5a623' },
  { id: 'ocean',  label: 'Ocean',     description: 'Teal & amber',                       primary: '#16b3c6', sidebar: '#0c3b50', accent: '#f5a623' },
  { id: 'earth',  label: 'Earth',     description: 'Olive green & golden yellow',        primary: '#5a9e46', sidebar: '#2d4a22', accent: '#f5c518' },
  { id: 'dark',   label: 'Dark Mode', description: 'Dark background throughout',         primary: '#38bdf8', sidebar: '#020617', accent: '#f59e0b', dark: true },
]

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'forest',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('forest')

  useEffect(() => {
    const saved = localStorage.getItem('es-theme') as Theme | null
    if (saved && THEMES.some((t) => t.id === saved)) {
      apply(saved)
      setThemeState(saved)
    }
  }, [])

  const setTheme = useCallback((t: Theme) => {
    apply(t)
    setThemeState(t)
    localStorage.setItem('es-theme', t)
  }, [])

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>
}

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

export const useTheme = () => useContext(ThemeCtx)

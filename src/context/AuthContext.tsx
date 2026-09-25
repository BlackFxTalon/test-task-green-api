/**
 * AuthContext — учётные данные GREEN-API (см. design.md: React Context + хуки).
 * Успешный вход сохраняет credentials в localStorage, «Выйти» удаляет их;
 * при перезагрузке страницы сессия восстанавливается сразу, без экрана входа.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { GreenApiCredentials } from '../api/greenApi'
import { verifyCredentials, type VerifyResult } from '../api/verifyCredentials'

const STORAGE_KEY = 'greenApiCredentials'

function loadStoredCredentials(): GreenApiCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GreenApiCredentials>
    if (typeof parsed.idInstance === 'string' && typeof parsed.apiTokenInstance === 'string') {
      return { idInstance: parsed.idInstance, apiTokenInstance: parsed.apiTokenInstance }
    }
    return null
  } catch {
    return null
  }
}

interface AuthContextValue {
  /** null — не выполнен вход (показываем экран входа). */
  credentials: GreenApiCredentials | null
  login: (credentials: GreenApiCredentials) => Promise<VerifyResult>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<GreenApiCredentials | null>(loadStoredCredentials)

  const login = useCallback(async (next: GreenApiCredentials): Promise<VerifyResult> => {
    const result = await verifyCredentials(next)
    if (result.ok) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setCredentials(next)
    }
    return result
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setCredentials(null)
  }, [])

  const value = useMemo(() => ({ credentials, login, logout }), [credentials, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth должен вызываться внутри <AuthProvider>')
  }
  return context
}

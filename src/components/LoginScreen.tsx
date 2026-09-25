/**
 * Экран входа (спека account-connect):
 * — пустые поля → запрос не отправляется, под полями подсказки;
 * — проверка через verifyCredentials: успех → экран чата;
 *   неверные данные → ошибка; инстанс не авторизован → предупреждение.
 */

import { useState, type FormEvent } from 'react'
import type { VerifyFailureReason, VerifyResult } from '../api/verifyCredentials'
import { verifyFailureMessages } from '../api/verifyCredentials'
import { useAuth } from '../context/AuthContext'

interface FieldErrors {
  idInstance?: string
  apiTokenInstance?: string
}

/** Какой баннер показывать под формой. */
interface FormBanner {
  kind: 'error' | 'warning'
  text: string
}

function bannerFromResult(result: Exclude<VerifyResult, { ok: true }>): FormBanner {
  if (result.reason === 'not_authorized') {
    return { kind: 'warning', text: result.message }
  }
  if (result.reason === 'service') {
    return { kind: 'error', text: result.message }
  }
  const text = verifyFailureMessages[result.reason as Exclude<VerifyFailureReason, 'not_authorized'>]
  return { kind: 'error', text }
}

export function LoginScreen() {
  const { login } = useAuth()
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [banner, setBanner] = useState<FormBanner | null>(null)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (checking) return

    // Обязательность полей: без запроса к API
    const trimmedId = idInstance.trim()
    const trimmedToken = apiTokenInstance.trim()
    const errors: FieldErrors = {}
    if (!trimmedId) errors.idInstance = 'Обязательное поле'
    if (!trimmedToken) errors.apiTokenInstance = 'Обязательное поле'
    setFieldErrors(errors)
    setBanner(null)
    if (Object.keys(errors).length > 0) return

    setChecking(true)
    try {
      const result = await login({ idInstance: trimmedId, apiTokenInstance: trimmedToken })
      if (!result.ok) setBanner(bannerFromResult(result))
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="login-root">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <h1 className="login-title">MAX Chat</h1>
        <p className="login-subtitle">Вход по данным инстанса GREEN-API</p>

        <label className="field">
          <span className="field-label">idInstance</span>
          <input
            className={`field-input${fieldErrors.idInstance ? ' field-input_invalid' : ''}`}
            type="text"
            name="idInstance"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Например, 310022746580"
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value)}
          />
          {fieldErrors.idInstance && <span className="field-error">{fieldErrors.idInstance}</span>}
        </label>

        <label className="field">
          <span className="field-label">apiTokenInstance</span>
          <input
            className={`field-input${fieldErrors.apiTokenInstance ? ' field-input_invalid' : ''}`}
            type="password"
            name="apiTokenInstance"
            autoComplete="off"
            placeholder="Ключ доступа инстанса"
            value={apiTokenInstance}
            onChange={(event) => setApiTokenInstance(event.target.value)}
          />
          {fieldErrors.apiTokenInstance && (
            <span className="field-error">{fieldErrors.apiTokenInstance}</span>
          )}
        </label>

        {banner && (
          <div className={`banner banner_${banner.kind}`} role="alert">
            {banner.text}
          </div>
        )}

        <button className="submit-button" type="submit" disabled={checking}>
          {checking ? 'Проверяем…' : 'Войти'}
        </button>

        <p className="login-hint">
          idInstance и apiTokenInstance — в личном кабинете{' '}
          <a href="https://green-api.com" target="_blank" rel="noreferrer">
            green-api.com
          </a>
        </p>
      </form>
    </main>
  )
}

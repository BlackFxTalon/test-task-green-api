import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyCredentials } from './verifyCredentials'

const credentials = { idInstance: '310022746580', apiTokenInstance: 'token' }

function stubFetchOnce(status: number, body: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('verifyCredentials', () => {
  it('authorized → ok', async () => {
    stubFetchOnce(200, JSON.stringify({ stateInstance: 'authorized' }))

    const result = await verifyCredentials(credentials)
    expect(result).toEqual({ ok: true, stateInstance: 'authorized' })
  })

  it('401 → «Неверные учётные данные»', async () => {
    stubFetchOnce(401, 'Unauthorized')

    const result = await verifyCredentials(credentials)
    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'Неверные учётные данные' })
  })

  it('400 «Instance is deleted» → «Неверные учётные данные»', async () => {
    stubFetchOnce(400, 'Instance is deleted')

    const result = await verifyCredentials(credentials)
    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('сетевая ошибка → reason network, без упоминания неверных данных', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const result = await verifyCredentials(credentials)
    expect(result).toMatchObject({ ok: false, reason: 'network' })
  })

  it('инстанс не авторизован (pendingPassword) → предупреждение, вход не выполняем', async () => {
    stubFetchOnce(200, JSON.stringify({ stateInstance: 'pendingPassword' }))

    const result = await verifyCredentials(credentials)
    expect(result).toMatchObject({ ok: false, reason: 'not_authorized' })
    if (!result.ok && result.reason === 'not_authorized') {
      expect(result.message).toContain('pendingPassword')
      expect(result.message).toContain('QR-коду')
    }
  })

  it('неавторизованный инстанс (notAuthorized) → тоже предупреждение', async () => {
    stubFetchOnce(200, JSON.stringify({ stateInstance: 'notAuthorized' }))

    const result = await verifyCredentials(credentials)
    expect(result).toMatchObject({ ok: false, reason: 'not_authorized' })
  })

  it('прочий HTTP-статус (500) → service с текстом ошибки', async () => {
    stubFetchOnce(500, 'Internal error')

    const result = await verifyCredentials(credentials)
    expect(result).toMatchObject({ ok: false, reason: 'service' })
    if (!result.ok && result.reason === 'service') {
      expect(result.message).toContain('500')
    }
  })
})

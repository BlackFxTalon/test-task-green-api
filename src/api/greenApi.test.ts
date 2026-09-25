import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHAT_ID_SUFFIX,
  GREEN_API_BASE_URL,
  GreenApiError,
  buildChatId,
  deleteNotification,
  getSettings,
  getStateInstance,
  receiveNotification,
  sendMessage,
  type GreenApiCredentials,
} from './greenApi'

const credentials: GreenApiCredentials = {
  idInstance: '1101234567',
  apiTokenInstance: 'test-token',
}

/** Подменяет глобальный fetch и возвращает историю вызовов. */
function stubFetch(handler: (url: URL, init: RequestInit) => Promise<Response> | Response) {
  const fetchMock = vi.fn(handler)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('константы', () => {
  it('базовый URL и суффикс chatId определены в одном месте', () => {
    expect(GREEN_API_BASE_URL).toBe('https://api.green-api.com')
    expect(CHAT_ID_SUFFIX).toBe('@c.us')
    expect(buildChatId('79001234567')).toBe('79001234567@c.us')
  })
})

describe('getSettings', () => {
  it('успех: GET на корректный URL, ответ типизирован', async () => {
    const payload = { instanceId: 1101234567, defaultCountry: 'ru' }
    const fetchMock = stubFetch((url, init) => {
      expect(url.toString()).toBe(
        `${GREEN_API_BASE_URL}/waInstance1101234567/getSettings/test-token`,
      )
      expect(init.method).toBe('GET')
      return jsonResponse(200, payload)
    })

    await expect(getSettings(credentials)).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('getStateInstance', () => {
  it('успех: возвращает состояние инстанса', async () => {
    stubFetch((url) => {
      expect(url.pathname).toBe('/waInstance1101234567/getStateInstance/test-token')
      return jsonResponse(200, { stateInstance: 'authorized' })
    })

    await expect(getStateInstance(credentials)).resolves.toEqual({ stateInstance: 'authorized' })
  })

  it('401: неверный токен → GreenApiError со статусом 401', async () => {
    stubFetch(() => jsonResponse(401, { error: 'Unauthorized' }))

    const promise = getStateInstance(credentials)
    await expect(promise).rejects.toBeInstanceOf(GreenApiError)
    await promise.catch((error: GreenApiError) => {
      expect(error.status).toBe(401)
      expect(error.isNetworkError).toBe(false)
    })
  })
})

describe('sendMessage', () => {
  it('успех: POST с телом { chatId, message }', async () => {
    const fetchMock = stubFetch((url, init) => {
      expect(url.toString()).toBe(
        `${GREEN_API_BASE_URL}/waInstance1101234567/sendMessage/test-token`,
      )
      expect(init.method).toBe('POST')
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(String(init.body))).toEqual({
        chatId: '79001234567@c.us',
        message: 'Привет!',
      })
      return jsonResponse(200, { idMessage: 'ABCDEF123456' })
    })

    await expect(sendMessage(credentials, '79001234567@c.us', 'Привет!')).resolves.toEqual({
      idMessage: 'ABCDEF123456',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('ошибка API: статус 400 → GreenApiError со статусом', async () => {
    stubFetch(() => jsonResponse(400, 'bad chatId'))

    const promise = sendMessage(credentials, 'bad@c.us', 'text')
    await expect(promise).rejects.toBeInstanceOf(GreenApiError)
    await promise.catch((error: GreenApiError) => {
      expect(error.status).toBe(400)
      expect(error.message).toContain('400')
    })
  })
})

describe('receiveNotification', () => {
  it('успех: возвращает уведомление с receiptId и телом', async () => {
    const notification = {
      receiptId: 1234567,
      body: {
        typeWebhook: 'incomingMessageDataReceived',
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Ответ' } },
        senderData: { chatId: '79001234567@c.us' },
      },
    }
    stubFetch((url) => {
      expect(url.pathname).toBe('/waInstance1101234567/receiveNotification/test-token')
      return jsonResponse(200, notification)
    })

    await expect(receiveNotification(credentials)).resolves.toEqual(notification)
  })

  it('нет уведомлений: null не трактуется как ошибка', async () => {
    stubFetch(() => jsonResponse(200, null))

    await expect(receiveNotification(credentials, 5)).resolves.toBeNull()
  })

  it('MAX v3: пустое тело при отсутствии уведомлений → null, без исключения', async () => {
    stubFetch(
      () =>
        new Response('', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    await expect(receiveNotification(credentials, 5)).resolves.toBeNull()
  })

  it('receiveTimeout передаётся в query', async () => {
    stubFetch((url) => {
      expect(url.searchParams.get('receiveTimeout')).toBe('5')
      return jsonResponse(200, null)
    })

    await receiveNotification(credentials, 5)
  })

  it('сетевая ошибка: fetch отклонился → GreenApiError с isNetworkError', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })

    const promise = receiveNotification(credentials)
    await expect(promise).rejects.toBeInstanceOf(GreenApiError)
    await promise.catch((error: GreenApiError) => {
      expect(error.isNetworkError).toBe(true)
      expect(error.status).toBeUndefined()
    })
  })
})

describe('deleteNotification', () => {
  it('успех: DELETE с receiptId в пути, подтверждение после обработки', async () => {
    stubFetch((url, init) => {
      expect(url.toString()).toBe(
        `${GREEN_API_BASE_URL}/waInstance1101234567/deleteNotification/test-token/1234567`,
      )
      expect(init.method).toBe('DELETE')
      return jsonResponse(200, { result: true })
    })

    await expect(deleteNotification(credentials, 1234567)).resolves.toEqual({ result: true })
  })

  it('сетевая ошибка: приводится к GreenApiError', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })

    await expect(deleteNotification(credentials, 1)).rejects.toMatchObject({
      isNetworkError: true,
    })
  })
})

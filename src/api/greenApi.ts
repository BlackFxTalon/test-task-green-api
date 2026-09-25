/**
 * Тонкий API-слой GREEN-API (v3) поверх fetch.
 *
 * Базовый URL, шаблон пути и суффикс chatId вынесены в константы
 * в одном месте: при интеграции с инстансами MAX уточняется хост
 * и формат chatId (см. design.md, Open Questions) — правится здесь.
 */

/** Базовый хост GREEN-API. */
export const GREEN_API_BASE_URL = 'https://api.green-api.com'

/** Суффикс идентификатора чата GREEN-API. */
export const CHAT_ID_SUFFIX = '@c.us'

/** Учётные данные инстанса GREEN-API. */
export interface GreenApiCredentials {
  idInstance: string
  apiTokenInstance: string
}

/** Собирает chatId из номера телефона (код страны, без «+»). */
export function buildChatId(phone: string): string {
  return `${phone}${CHAT_ID_SUFFIX}`
}

// ---------- Типы ответов ----------

/** Ответ getSettings (используются ключевые поля). */
export interface GetSettingsResponse {
  instanceId?: number
  /** Текущий инстанс WhatsApp/MAX-инстанса. */
  defaultCountry?: string
  [key: string]: unknown
}

/** Ответ getStateInstance. */
export interface GetStateInstanceResponse {
  /** authorized | notAuthorized | starting | sleepMode | blocked */
  stateInstance: string
}

/** Ответ sendMessage. */
export interface SendMessageResponse {
  /** Идентификатор отправленного сообщения. */
  idMessage: string
  [key: string]: unknown
}

/** Тело уведомления (webhook) входящего сообщения. */
export interface NotificationBody {
  /** Тип уведомления, для текстового сообщения — "incomingMessageDataReceived". */
  typeWebhook?: string
  /** Unix-time отправки, секунды. */
  timestamp?: number
  /** Данные сообщения (у текстовых — messageData.textMessageData.text). */
  messageData?: {
    typeMessage?: string
    textMessageData?: {
      textMessage?: string
    }
    [key: string]: unknown
  }
  /** Отправитель: chatId вида <phone>@c.us. */
  senderData?: {
    chatId?: string
    sender?: string
    chatName?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** Успешный ответ receiveNotification (или null, если уведомлений нет). */
export interface ReceiveNotificationResponse {
  /** Идентификатор для подтверждения обработки (deleteNotification). */
  receiptId: number
  body: NotificationBody
}

/** Ответ deleteNotification. */
export interface DeleteNotificationResponse {
  result: boolean
}

// ---------- Ошибки ----------

/** Класс ошибки API: отделяет HTTP-статусы от сетевых сбоев. */
export class GreenApiError extends Error {
  /** HTTP-статус ответа (undefined для сетевой ошибки). */
  readonly status?: number
  /** true — запрос не дошёл (сеть, CORS, DNS). */
  readonly isNetworkError: boolean

  constructor(message: string, options: { status?: number; isNetworkError?: boolean; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'GreenApiError'
    this.status = options.status
    this.isNetworkError = options.isNetworkError ?? false
  }
}

// ---------- Внутренний транспорт ----------

interface RequestOptions {
  /** HTTP-метод запроса. */
  httpMethod?: 'GET' | 'POST' | 'DELETE'
  /** JSON-тело запроса. */
  body?: unknown
  /** Часть пути после /{method}/{apiTokenInstance}. */
  pathSuffix?: string
  /** Query-параметры. */
  query?: Record<string, string>
  /** Таймаут запроса в мс (AbortController), по умолчанию 60 с (долгий опрос). */
  timeoutMs?: number
}

/**
 * Единая точка запроса: `<baseUrl>/waInstance{idInstance}/{method}/{apiTokenInstance}[/suffix][?query]`.
 * Ошибки приводятся к GreenApiError (HTTP-статус или сетевая ошибка).
 */
async function request<T>(
  credentials: GreenApiCredentials,
  method: string,
  options: RequestOptions = {},
): Promise<T> {
  const { httpMethod = 'GET', body, pathSuffix, query, timeoutMs = 60_000 } = options

  const url = new URL(
    `waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}` +
      (pathSuffix ? `/${pathSuffix}` : ''),
    GREEN_API_BASE_URL,
  )
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(url, {
      method: httpMethod,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (cause) {
    throw new GreenApiError('Нет связи с сервером GREEN-API', { isNetworkError: true, cause })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new GreenApiError(
      `GREEN-API ответил ошибкой ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      { status: response.status },
    )
  }

  // MAX v3: при отсутствии уведомлений сервер отдаёт HTTP 200 с пустым телом
  // (проверено на тестовом инстансе), а не null — трактуем как «данных нет».
  const text = await response.text()
  if (text.trim() === '') {
    return null as T
  }

  return JSON.parse(text) as T
}

// ---------- Методы API ----------

/** Настройки инстанса — проверка связи и валидности данных. */
export function getSettings(credentials: GreenApiCredentials): Promise<GetSettingsResponse> {
  return request(credentials, 'getSettings')
}

/** Состояние инстанса — проверка авторизации (stateInstance === 'authorized'). */
export function getStateInstance(credentials: GreenApiCredentials): Promise<GetStateInstanceResponse> {
  return request(credentials, 'getStateInstance')
}

/** Отправка текстового сообщения в чат `chatId`. */
export function sendMessage(
  credentials: GreenApiCredentials,
  chatId: string,
  message: string,
): Promise<SendMessageResponse> {
  return request(credentials, 'sendMessage', {
    httpMethod: 'POST',
    body: { chatId, message },
  })
}

/**
 * Долгий опрос уведомлений. Возвращает `null`, если уведомлений нет
 * (в том числе когда сервер ответил пустым телом).
 * `receiveTimeoutSeconds` — сколько сервер держит запрос при отсутствии уведомлений.
 */
export function receiveNotification(
  credentials: GreenApiCredentials,
  receiveTimeoutSeconds?: number,
): Promise<ReceiveNotificationResponse | null> {
  return request(credentials, 'receiveNotification', {
    query: receiveTimeoutSeconds !== undefined ? { receiveTimeout: String(receiveTimeoutSeconds) } : undefined,
    timeoutMs: receiveTimeoutSeconds !== undefined ? (receiveTimeoutSeconds + 10) * 1000 : 60_000,
  })
}

/** Подтверждение обработки уведомления — вызывается строго после обработки. */
export function deleteNotification(
  credentials: GreenApiCredentials,
  receiptId: number,
): Promise<DeleteNotificationResponse> {
  return request(credentials, 'deleteNotification', {
    httpMethod: 'DELETE',
    pathSuffix: String(receiptId),
  })
}

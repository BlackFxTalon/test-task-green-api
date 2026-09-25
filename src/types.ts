/**
 * Общие типы предметной области (см. design.md: модель данных).
 * Наполняются в задачах разделов 2–5.
 */

/** Чат — определяется номером получателя. */
export interface Chat {
  /** GREEN-API идентификатор: `<phone>@c.us` */
  id: string
  /** Номер телефона с кодом страны, без «+» */
  phone: string
}

/** Направление сообщения. */
export type MessageDirection = 'out' | 'in'

/** Статус доставки: не отправлено / отправлено. */
export type MessageStatus = 'failed' | 'sent'

/** Текстовое сообщение переписки (история — только в памяти сессии). */
export interface Message {
  id: string
  chatId: string
  text: string
  direction: MessageDirection
  /** Unix-time в миллисекундах */
  timestamp: number
  status: MessageStatus
}

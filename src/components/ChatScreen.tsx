/**
 * Экран чата: верхняя панель с «Выйти», слева список чатов, справа переписка.
 * Чаты (номера) хранятся в localStorage; история сообщений — только в памяти
 * сессии (по ТЗ персистентность истории не требуется).
 */

import { useEffect, useMemo, useState } from 'react'
import { checkAccount, GreenApiError, normalizePhone } from '../api/greenApi'
import type { CreateChatResult } from './ChatList'
import { ChatList } from './ChatList'
import { useAuth } from '../context/AuthContext'
import type { Chat, Message } from '../types'

const CHATS_STORAGE_KEY = 'maxChatChats'

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is Chat =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Chat).id === 'string' &&
        typeof (item as Chat).phone === 'string',
    )
  } catch {
    return []
  }
}

export function ChatScreen() {
  const { credentials, logout } = useAuth()
  const [chats, setChats] = useState<Chat[]>(loadChats)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  /** История сообщений в памяти сессии: chatId → сообщения.
   * Записывать сообщения начнёт цикл приёма/отправки в разделе 5. */
  const [messages] = useState<Record<string, Message[]>>({})

  useEffect(() => {
    localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats))
  }, [chats])

  const previews = useMemo(() => {
    const result: Record<string, string> = {}
    for (const [chatId, list] of Object.entries(messages)) {
      const last = list[list.length - 1]
      if (last) result[chatId] = last.direction === 'out' ? `Вы: ${last.text}` : last.text
    }
    return result
  }, [messages])

  async function handleCreateChat(phoneInput: string): Promise<CreateChatResult> {
    if (!credentials) return { ok: false, message: 'Нет активной сессии' }

    // Валидация до любого запроса (спека chat-list)
    const phone = normalizePhone(phoneInput)
    if (!phone) {
      return {
        ok: false,
        message: 'Неверный формат: введите 10–15 цифр с кодом страны, без «+»',
      }
    }

    // Защита от дублей: существующий чат просто открываем
    const existing = chats.find((chat) => chat.phone === phone)
    if (existing) {
      setActiveChatId(existing.id)
      return { ok: true }
    }

    // Резолв канонического chatId MAX (design.md: входящие приходят с внутренним ID)
    let canonicalId: string
    try {
      const account = await checkAccount(credentials, phone)
      if (!account.exist) {
        return { ok: false, message: `Аккаунт MAX с номером ${phone} не найден` }
      }
      canonicalId = account.chatId
    } catch (error) {
      const detail =
        error instanceof GreenApiError && error.isNetworkError
          ? 'Нет связи с сервером GREEN-API'
          : 'Не удалось проверить номер'
      return { ok: false, message: `${detail}. Чат не создан, попробуйте ещё раз` }
    }

    const chat: Chat = { id: canonicalId, phone }
    setChats((current) => [...current, chat])
    setActiveChatId(chat.id)
    return { ok: true }
  }

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null

  return (
    <div className="chat-root">
      <header className="chat-topbar">
        <span className="chat-brand">MAX Chat</span>
        <span className="chat-instance">Инстанс: {credentials?.idInstance}</span>
        <button className="logout-button" type="button" onClick={logout}>
          Выйти
        </button>
      </header>

      <div className="chat-layout">
        <ChatList
          chats={chats}
          activeChatId={activeChatId}
          previews={previews}
          onSelectChat={setActiveChatId}
          onCreateChat={handleCreateChat}
        />

        <main className="conversation-panel">
          {activeChat ? (
            <>
              <header className="conversation-header">
                <span className="chat-avatar" aria-hidden="true">
                  {activeChat.phone.slice(0, 1)}
                </span>
                <div className="conversation-title">
                  <div className="conversation-phone">{activeChat.phone}</div>
                  <div className="conversation-id">chatId: {activeChat.id}</div>
                </div>
              </header>
              <div className="conversation-body">
                <p className="chat-placeholder">Переписка появится в разделе 5</p>
              </div>
            </>
          ) : (
            <div className="conversation-empty">
              <p className="chat-placeholder">Выберите чат или создайте новый</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

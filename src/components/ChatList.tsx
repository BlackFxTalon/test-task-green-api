/**
 * Левая панель: форма «Новый чат» и список чатов (спека chat-list).
 * Состояние чатов живёт в ChatScreen (design.md: состояние — в корневом
 * компоненте приложения); здесь только отображение и ввод.
 */

import { useState, type FormEvent } from 'react'
import type { Chat } from '../types'

export interface CreateChatResult {
  ok: boolean
  message?: string
}

interface ChatListProps {
  chats: Chat[]
  activeChatId: string | null
  /** Превью последнего сообщения по chatId (после F5 может отсутствовать). */
  previews: Record<string, string>
  onSelectChat: (chatId: string) => void
  onCreateChat: (phoneInput: string) => Promise<CreateChatResult>
}

export function ChatList({ chats, activeChatId, previews, onSelectChat, onCreateChat }: ChatListProps) {
  const [phoneInput, setPhoneInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    setFormError(null)
    try {
      const result = await onCreateChat(phoneInput)
      if (result.ok) {
        setPhoneInput('')
      } else {
        setFormError(result.message ?? 'Не удалось создать чат')
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <aside className="chat-list-panel">
      <form className="new-chat-form" onSubmit={handleCreate} noValidate>
        <input
          className="new-chat-input"
          type="text"
          inputMode="tel"
          autoComplete="off"
          placeholder="Номер: 79991234567"
          aria-label="Номер телефона получателя"
          value={phoneInput}
          onChange={(event) => setPhoneInput(event.target.value)}
        />
        <button className="new-chat-button" type="submit" disabled={creating}>
          {creating ? '…' : 'Создать'}
        </button>
      </form>
      {formError && (
        <div className="banner banner_error new-chat-error" role="alert">
          {formError}
        </div>
      )}

      <div className="chat-list">
        {chats.length === 0 && (
          <p className="chat-list-empty">Чатов пока нет — создайте новый по номеру</p>
        )}
        {chats.map((chat) => (
          <button
            key={chat.id}
            type="button"
            className={`chat-list-item${chat.id === activeChatId ? ' chat-list-item_active' : ''}`}
            onClick={() => onSelectChat(chat.id)}
          >
            <span className="chat-avatar" aria-hidden="true">
              {chat.phone.slice(0, 1)}
            </span>
            <span className="chat-list-item-body">
              <span className="chat-list-item-phone">{chat.phone}</span>
              <span className="chat-list-item-preview">{previews[chat.id] ?? 'Нет сообщений'}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}

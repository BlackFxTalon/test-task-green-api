/**
 * Заглушка экрана чата: верхняя панель с «Выйти» и пустая рабочая область.
 * Список чатов и переписка появятся в задачах разделов 4–5.
 */

import { useAuth } from '../context/AuthContext'

export function ChatScreen() {
  const { credentials, logout } = useAuth()

  return (
    <div className="chat-root">
      <header className="chat-topbar">
        <span className="chat-brand">MAX Chat</span>
        <span className="chat-instance">Инстанс: {credentials?.idInstance}</span>
        <button className="logout-button" type="button" onClick={logout}>
          Выйти
        </button>
      </header>
      <main className="chat-body">
        <p className="chat-placeholder">Здесь появится список чатов и переписка</p>
      </main>
    </div>
  )
}

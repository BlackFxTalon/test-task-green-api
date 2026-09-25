/**
 * Корневой компонент: AuthProvider + переключение экранов.
 * Сохранённые credentials (localStorage) → сразу экран чата, иначе — вход.
 */

import { ChatScreen } from './components/ChatScreen'
import { LoginScreen } from './components/LoginScreen'
import { AuthProvider, useAuth } from './context/AuthContext'

function AppRoutes() {
  const { credentials } = useAuth()
  return credentials ? <ChatScreen /> : <LoginScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

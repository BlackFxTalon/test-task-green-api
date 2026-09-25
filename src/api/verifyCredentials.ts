/**
 * Проверка учётных данных при входе (спека account-connect):
 * корректные данные → ок; ошибка авторизации → «Неверные учётные данные»;
 * инстанс не привязан к MAX → предупреждение, вход не выполняем.
 *
 * Логика вынесена из UI, чтобы покрываться юнит-тестами без браузера.
 */

import { getStateInstance, GreenApiError, type GreenApiCredentials } from './greenApi'

export type VerifyFailureReason =
  /** Неверный idInstance/apiTokenInstance (401/403/400 — включая «Instance is deleted»). */
  | 'invalid'
  /** Сетевая ошибка / CORS — запрос не дошёл. */
  | 'network'
  /** Иная ошибка сервиса. */
  | 'service'
  /** Данные верны, но инстанс не авторизован в MAX. */
  | 'not_authorized'

export type VerifyResult =
  | { ok: true; stateInstance: string }
  | { ok: false; reason: VerifyFailureReason; message: string }

/** Человеческие сообщения для экрана входа. */
export const verifyFailureMessages: Record<Exclude<VerifyFailureReason, 'not_authorized'>, string> = {
  invalid: 'Неверные учётные данные',
  network: 'Нет связи с сервером GREEN-API. Проверьте интернет-подключение.',
  service: 'Сервис GREEN-API ответил ошибкой',
}

/**
 * Проверяет credentials через getStateInstance.
 * Считаем инстанс готовым только в состоянии `authorized`.
 */
export async function verifyCredentials(credentials: GreenApiCredentials): Promise<VerifyResult> {
  let stateInstance: string
  try {
    const response = await getStateInstance(credentials)
    stateInstance = response.stateInstance
  } catch (error) {
    if (error instanceof GreenApiError) {
      if (error.isNetworkError) {
        return { ok: false, reason: 'network', message: verifyFailureMessages.network }
      }
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        return { ok: false, reason: 'invalid', message: verifyFailureMessages.invalid }
      }
      return {
        ok: false,
        reason: 'service',
        message: `${verifyFailureMessages.service}: ${error.message}`,
      }
    }
    return {
      ok: false,
      reason: 'service',
      message: `${verifyFailureMessages.service}: ${String(error)}`,
    }
  }

  if (stateInstance !== 'authorized') {
    return {
      ok: false,
      reason: 'not_authorized',
      message:
        `Инстанс не авторизован в MAX (состояние: ${stateInstance}). ` +
        'Авторизуйте его в личном кабинете GREEN-API по QR-коду и повторите вход.',
    }
  }

  return { ok: true, stateInstance }
}

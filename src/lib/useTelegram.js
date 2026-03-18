'use client'
import { useEffect, useState, useCallback } from 'react'
import useGameStore from './store'

/**
 * NSS Telegram Mini App Integration
 * Автоопределение языка, вибрация, нативные кнопки
 */

export function useTelegram() {
  const [webApp, setWebApp] = useState(null)
  const [isTelegramReady, setIsTelegramReady] = useState(false)
  const { setLang, lang } = useGameStore()

  useEffect(() => {
    const tg = window.Telegram?.WebApp

    if (tg) {
      setWebApp(tg)

      // Telegram готов
      tg.ready()

      // Разворачиваем на весь экран
      tg.expand()

      // Цвета под NSS дизайн
      if (tg.setHeaderColor) tg.setHeaderColor('#2b2a1a')
      if (tg.setBackgroundColor) tg.setBackgroundColor('#2b2a1a')

      // Автоопределение языка из Telegram
      const tgLang = tg.initDataUnsafe?.user?.language_code
      if (tgLang) {
        // Маппинг Telegram language_code → наши коды
        const langMap = {
          'ru': 'ru',
          'uk': 'uk',
          'be': 'ru', // Беларусь → русский
          'kk': 'ru', // Казахстан → русский
          'uz': 'ru', // Узбекистан → русский
          'en': 'en',
          'de': 'de',
          'es': 'es',
          'fr': 'fr',
          'it': 'it',
          'pl': 'pl',
          'pt': 'pt',
          'tr': 'tr',
          'ar': 'ar',
          'zh': 'zh',
          'ja': 'ja',
          'ko': 'ko',
          'vi': 'vi',
          'th': 'th',
          'id': 'id',
          'hi': 'hi',
        }
        const mappedLang = langMap[tgLang] || langMap[tgLang.split('-')[0]] || 'en'
        
        // Проверяем есть ли такой язык в наших переводах
        const { translations } = require('@/locales')
        if (translations[mappedLang]) {
          setLang(mappedLang)
        } else {
          setLang('en') // Fallback на английский
        }
      }

      setIsTelegramReady(true)
    }
  }, [setLang])

  // В Telegram?
  const isInTelegram = !!webApp

  // Данные пользователя
  const user = webApp?.initDataUnsafe?.user || null

  // Цветовая схема
  const colorScheme = webApp?.colorScheme || 'dark'

  // Реферальный код из start_param
  const startParam = webApp?.initDataUnsafe?.start_param || null

  // Вибрация
  const haptic = useCallback((type = 'light') => {
    if (!webApp?.HapticFeedback) return

    if (type === 'success' || type === 'error' || type === 'warning') {
      webApp.HapticFeedback.notificationOccurred(type)
    } else {
      webApp.HapticFeedback.impactOccurred(type)
    }
  }, [webApp])

  // Главная кнопка Telegram
  const showMainButton = useCallback((text, onClick) => {
    if (!webApp?.MainButton) return
    webApp.MainButton.setText(text)
    webApp.MainButton.onClick(onClick)
    webApp.MainButton.show()
  }, [webApp])

  const hideMainButton = useCallback(() => {
    webApp?.MainButton?.hide()
  }, [webApp])

  // Кнопка назад
  const showBackButton = useCallback((onClick) => {
    if (!webApp?.BackButton) return
    webApp.BackButton.onClick(onClick)
    webApp.BackButton.show()
  }, [webApp])

  const hideBackButton = useCallback(() => {
    webApp?.BackButton?.hide()
  }, [webApp])

  // Шаринг
  const shareLink = useCallback((url, text = '') => {
    if (webApp) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`
      webApp.openTelegramLink(shareUrl)
    } else {
      if (navigator.share) {
        navigator.share({ url, text })
      } else {
        navigator.clipboard.writeText(url)
      }
    }
  }, [webApp])

  // Открыть ссылку
  const openLink = useCallback((url) => {
    if (webApp) {
      webApp.openLink(url)
    } else {
      window.open(url, '_blank')
    }
  }, [webApp])

  // Алерт
  const showAlert = useCallback((message) => {
    return new Promise((resolve) => {
      if (webApp) {
        webApp.showAlert(message, resolve)
      } else {
        alert(message)
        resolve()
      }
    })
  }, [webApp])

  // Подтверждение
  const showConfirm = useCallback((message) => {
    return new Promise((resolve) => {
      if (webApp) {
        webApp.showConfirm(message, resolve)
      } else {
        resolve(confirm(message))
      }
    })
  }, [webApp])

  // Закрыть
  const close = useCallback(() => {
    webApp?.close()
  }, [webApp])

  return {
    webApp,
    user,
    isInTelegram,
    isTelegramReady,
    colorScheme,
    startParam,
    haptic,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
    shareLink,
    openLink,
    showAlert,
    showConfirm,
    close,
  }
}

export default useTelegram

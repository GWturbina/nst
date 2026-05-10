'use client'
/**
 * GwadUtmCapture — захват UTM-параметров рекламной кампании gwad.ink.
 *
 * Невидимый компонент. Срабатывает при загрузке страницы:
 * если в URL есть utm_source=gwads + utm_campaign + ref —
 * сохраняет их в localStorage на 30 дней.
 *
 * Когда пользователь позже регистрируется — модуль gwadTracking
 * читает эти UTM из localStorage и отправляет в gwad.ink.
 *
 * Если в URL ничего нет — просто молчит.
 */
import { useEffect } from 'react'
import { captureGwadUtm } from '@/lib/gwadTracking'

export default function GwadUtmCapture() {
    useEffect(() => {
        captureGwadUtm()
    }, [])
    return null
}

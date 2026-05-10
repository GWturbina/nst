// ═══════════════════════════════════════════════════════════════════
// src/lib/gwadTracking.js
// ═══════════════════════════════════════════════════════════════════
// Модуль трекинга для рекламной системы gwad.ink.
//
// Используется в двух местах:
//   1. captureGwadUtm()         — вызывается при загрузке сайта,
//                                  сохраняет UTM параметры в localStorage
//                                  (если пользователь пришёл по нашей рекламе).
//
//   2. gwadTrackRegistration()  — вызывается ПОСЛЕ успешной регистрации,
//                                  отправляет уведомление на gwad.ink что
//                                  регистрация засчитана как реальная.
//
// Логика: если в URL нет utm_source=gwads — функции тихо не делают ничего.
// Это значит интеграция безопасна: пользователи не пришедшие по рекламе
// никак не затрагиваются.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'gwad_utm';
const API_URL = 'https://gwad.ink/api/track-registration';

// UTM в localStorage хранится 30 дней (чтобы не терялся между визитами)
const UTM_TTL_MS = 30 * 24 * 60 * 60 * 1000;


/**
 * Захват UTM параметров из URL текущей страницы.
 * Вызывать ОДИН РАЗ при загрузке сайта (например в layout.js).
 *
 * Если в URL есть utm_source=gwads + utm_campaign + ref —
 * сохраняет их в localStorage. Иначе ничего не делает.
 */
export function captureGwadUtm() {
    if (typeof window === 'undefined') return; // SSR-safe

    try {
        const url = new URL(window.location.href);
        const params = url.searchParams;

        if (params.get('utm_source') !== 'gwads') return;

        const ref = String(params.get('ref') || '').replace(/[^0-9]/g, '');
        const campaign = String(params.get('utm_campaign') || '').replace(/[^a-zA-Z0-9_\-]/g, '');

        if (!ref || !campaign) return;

        const data = {
            ref,
            campaign,
            source: 'gwads',
            ts: Date.now()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        // localStorage недоступен (приватный режим) — не критично
    }
}


/**
 * Чтение сохранённых UTM из localStorage.
 * Возвращает null если нет данных или они устарели (>30 дней).
 */
function readGwadUtm() {
    if (typeof window === 'undefined') return null;

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);

        if (!data.ref || !data.campaign) return null;
        if (Date.now() - (data.ts || 0) > UTM_TTL_MS) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
}


/**
 * Уведомление о регистрации в рекламную систему gwad.ink.
 * Вызывать СРАЗУ ПОСЛЕ успешной транзакции register() в смарт-контракте.
 *
 * @param {string} walletAddress — адрес кошелька зарегистрированного пользователя
 * @returns {Promise<boolean>}   — true если трекинг принят
 */
export async function gwadTrackRegistration(walletAddress) {
    if (!walletAddress) return false;

    const utm = readGwadUtm();
    if (!utm) return false; // пользователь пришёл не по нашей рекламе — это нормально

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet: walletAddress.toLowerCase(),
                ref_gw_id: utm.ref,
                campaign_slug: utm.campaign
            })
        });

        if (!res.ok) {
            console.warn('[gwad-tracking] HTTP', res.status);
            return false;
        }

        const data = await res.json();
        console.log('[gwad-tracking] tracked:', data);

        // Очищаем сохранённые UTM после успешного трекинга,
        // чтобы повторная регистрация другого аккаунта на этом же
        // устройстве не считалась дублем.
        if (data && data.ok && data.tracked) {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        }

        return !!(data && data.ok && data.tracked);
    } catch (e) {
        console.warn('[gwad-tracking] network error:', e?.message || e);
        return false;
    }
}

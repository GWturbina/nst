// ═══════════════════════════════════════════════════════════════════
// src/lib/gwadTracking.js
// ═══════════════════════════════════════════════════════════════════
// Модуль трекинга для рекламной системы gwad.ink.
//
// Используется в двух местах:
//   1. captureGwadUtm()         — вызывается при загрузке сайта,
//                                  сохраняет UTM параметры + tg_id в localStorage.
//
//   2. gwadTrackRegistration()  — вызывается ПОСЛЕ успешной регистрации,
//                                  отправляет уведомление на gwad.ink.
//                                  Если был tg_id (юзер пришёл через бота) —
//                                  gwad шлёт ему сообщение в Telegram о завершении.
// ═══════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'gwad_utm';
const API_URL = 'https://gwad.ink/api/track-registration';

// UTM в localStorage хранится 30 дней (чтобы не терялся между визитами)
const UTM_TTL_MS = 30 * 24 * 60 * 60 * 1000;


/**
 * Захват UTM параметров из URL текущей страницы.
 * Вызывать ОДИН РАЗ при загрузке сайта (например в layout.js).
 */
export function captureGwadUtm() {
    if (typeof window === 'undefined') return;

    try {
        const url = new URL(window.location.href);
        const params = url.searchParams;

        if (params.get('utm_source') !== 'gwads') return;

        const ref      = String(params.get('ref') || '').replace(/[^0-9]/g, '');
        const campaign = String(params.get('utm_campaign') || '').replace(/[^a-zA-Z0-9_\-]/g, '');
        const medium   = String(params.get('utm_medium') || '').replace(/[^a-zA-Z0-9_\-]/g, '');
        const tgId     = String(params.get('tg_id') || '').replace(/[^0-9]/g, '');

        if (!ref || !campaign) return;

        const data = {
            ref,
            campaign,
            source: 'gwads',
            medium: medium || null,
            tg_id: tgId || null,   // ★ Этап 4: ловим tg_id если юзер пришёл с бота
            ts: Date.now()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        // localStorage недоступен — не критично
    }
}


/**
 * Чтение сохранённых UTM из localStorage.
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
 *
 * @param {string} walletAddress — адрес кошелька зарегистрированного пользователя
 * @param {string|number} newGwId — новый GW ID (из MatrixRegistry, получен после регистрации)
 * @returns {Promise<boolean>}
 */
export async function gwadTrackRegistration(walletAddress, newGwId = null) {
    if (!walletAddress) return false;

    const utm = readGwadUtm();
    if (!utm) return false; // пользователь пришёл не по нашей рекламе

    try {
        const payload = {
            wallet: walletAddress.toLowerCase(),
            ref_gw_id: utm.ref,
            campaign_slug: utm.campaign,
            // ★ Этап 4: передаём для немедленного уведомления в Telegram
            new_gw_id: newGwId ? String(newGwId) : null,
            tg_id: utm.tg_id || null,
            medium: utm.medium || null
        };

        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.warn('[gwad-tracking] HTTP', res.status);
            return false;
        }

        const data = await res.json();
        console.log('[gwad-tracking] tracked:', data);

        // Очищаем UTM после успешного трекинга
        if (data && data.ok && data.tracked) {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        }

        return !!(data && data.ok && data.tracked);
    } catch (e) {
        console.warn('[gwad-tracking] network error:', e?.message || e);
        return false;
    }
}

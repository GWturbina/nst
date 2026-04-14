'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LEVELS, ENERGY_CONFIG } from './gameData'
import { translations } from '@/locales'

const useGameStore = create(
  persist(
    (set, get) => ({
  // ═══════════════════════════════════════════════════
  // LANGUAGE
  // ═══════════════════════════════════════════════════
  lang: 'ru',
  setLang: (lang) => set({ lang }),
  t: (key) => {
    const { lang } = get()
    return translations[lang]?.[key] || translations['en']?.[key] || key
  },

  // ═══════════════════════════════════════════════════
  // WALLET STATE
  // ═══════════════════════════════════════════════════
  wallet: null,
  chainId: null,
  walletType: null,
  isConnecting: false,
  registered: false,
  sponsorId: null,

  // ═══════════════════════════════════════════════════
  // БАЛАНСЫ (из блокчейна)
  // ═══════════════════════════════════════════════════
  bnb: 0,
  usdt: 0,
  dct: 0,
  dctLocked: 0,
  dctFree: 0,
  dctPrice: 0,

  // ═══════════════════════════════════════════════════
  // GAME STATE
  // Для зарегистрированных: всё приходит С СЕРВЕРА.
  // Локальные значения — только отображение между ответами.
  // Для незарегистрированных: локальный doTap (испаряется).
  // ═══════════════════════════════════════════════════
  level: 0,
  energy: ENERGY_CONFIG.maxEnergy,
  maxEnergy: ENERGY_CONFIG.maxEnergy,
  taps: 0,
  localNss: 0,

  // Evaporation (только незарегистрированные)
  evapSeconds: ENERGY_CONFIG.evapSeconds,
  evapActive: false,

  // ═══════════════════════════════════════════════════
  // UI STATE
  // ═══════════════════════════════════════════════════
  dayMode: false,
  activeTab: 'mine',
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  txPending: false,
  lastError: null,

  // Admin
  ownerWallet: null,
  isAdmin: false,

  // Auth (подпись кошелька)
  authSig: null,
  authTs: null,

  // Курс BNB
  bnbPrice: 0,
  setBnbPrice: (price) => set({ bnbPrice: price }),

  // News/Quests
  news: ['Добро пожаловать в Diamond Club!', 'DCT — токен с реальным обеспечением'],
  quests: [
    { name: 'Сделай 100 тапов', reward: '10 GST', done: false },
    { name: 'Пригласи друга', reward: '5 DCT', done: false },
  ],

  // ═══════════════════════════════════════════════════
  // WALLET ACTIONS
  // ═══════════════════════════════════════════════════
  setWallet: (data) => set((s) => ({
    wallet: data.address,
    chainId: data.chainId,
    walletType: data.walletType,
    evapActive: false,
    isAdmin: s.ownerWallet
      ? data.address.toLowerCase() === s.ownerWallet.toLowerCase()
      : false,
  })),

  clearWallet: () => set({
    wallet: null, chainId: null, walletType: null,
    registered: false, sponsorId: null,
    bnb: 0, usdt: 0, dct: 0, dctLocked: 0, dctFree: 0,
    level: 0,
    evapActive: false,
    evapSeconds: ENERGY_CONFIG.evapSeconds,
    authSig: null, authTs: null,
  }),
  setConnecting: (v) => set({ isConnecting: v }),
  setAuth: (authData) => set({ authSig: authData.authSig, authTs: authData.authTs }),

  // ═══ AUTO-REGISTER ═══
  showAutoRegister: false,
  pendingRefId: null,
  setAutoRegister: (refId) => set({ showAutoRegister: true, pendingRefId: refId }),
  clearAutoRegister: () => set({ showAutoRegister: false, pendingRefId: null }),

  // ═══════════════════════════════════════════════════
  // BLOCKCHAIN SYNC
  // ═══════════════════════════════════════════════════
  updateBalances: (balances) => set({
    bnb: parseFloat(balances.bnb) || 0,
    usdt: parseFloat(balances.usdt) || 0,
  }),
  updateDCT: (info) => set({
    dct: parseFloat(info.total) || 0,
    dctLocked: parseFloat(info.locked) || 0,
    dctFree: parseFloat(info.free) || 0,
    dctPrice: parseFloat(info.price) || 0,
  }),
  updateRegistration: (isReg, id) => set({ registered: isReg, sponsorId: id }),
  setOwnerWallet: (addr) => {
    const w = get().wallet
    set({
      ownerWallet: addr,
      isAdmin: w && addr && w.toLowerCase() === addr.toLowerCase(),
    })
  },

  // ═══════════════════════════════════════════════════
  // TX STATE
  // ═══════════════════════════════════════════════════
  setLoading: (v) => set({ isLoading: v }),
  setTxPending: (v) => set({ txPending: v }),
  setError: (err) => set({ lastError: err }),
  clearError: () => set({ lastError: null }),

  // ═══════════════════════════════════════════════════
  // GAME ACTIONS
  // ═══════════════════════════════════════════════════
  setTab: (tab) => set({ activeTab: tab }),
  toggleDayMode: () => set(s => ({ dayMode: !s.dayMode })),

  /**
   * decrementEnergy — уменьшить энергию на 1 для визуального отклика.
   * Используется ТОЛЬКО для зарегистрированных перед отправкой на сервер.
   * Реальное значение придёт в ответе сервера.
   * Возвращает false если энергия = 0 (тапать нельзя).
   */
  decrementEnergy: () => {
    const { energy } = get()
    if (energy <= 0) return false
    set({ energy: energy - 1 })
    return true
  },

  /**
   * syncFromServer — обновить ВСЁ из ответа сервера.
   * Это единственный источник правды для зарегистрированных.
   * Вызывается из: ответа serverTap(), loadTapState(), 30-сек refresh.
   */
  syncFromServer: (data) => {
    const updates = {}
    if (data.energy != null) updates.energy = data.energy
    if (data.maxEnergy != null) updates.maxEnergy = data.maxEnergy
    if (data.totalNss != null) updates.localNss = data.totalNss
    if (data.totalTaps != null) updates.taps = data.totalTaps
    // level НЕ берём из tap API — он приходит ТОЛЬКО из блокчейна (gwStatus.maxPackage)
    if (Object.keys(updates).length > 0) set(updates)
  },

  /**
   * doTap — ТОЛЬКО для незарегистрированных (локальный тап).
   * Для зарегистрированных НЕ используется.
   */
  doTap: () => {
    const { energy, level, localNss, taps, registered, wallet, evapActive } = get()
    if (energy <= 0) return null
    if (registered || wallet) return null  // Зарегистрированные — только через сервер
    const lv = LEVELS[level]
    const earned = lv.nssPerTap
    set({
      localNss: +(localNss + earned).toFixed(4),
      energy: energy - 1,
      taps: taps + 1,
    })
    if (!evapActive && taps === 0) set({ evapActive: true })
    return earned
  },

  regenEnergy: () => {
    const { energy, maxEnergy } = get()
    if (energy < maxEnergy) set({ energy: Math.min(energy + ENERGY_CONFIG.regenAmount, maxEnergy) })
  },

  tickEvap: () => {
    const { evapSeconds, evapActive, registered, wallet } = get()
    if (!evapActive || registered || wallet) return null
    if (evapSeconds <= 1) {
      set({ localNss: 0, evapActive: false, evapSeconds: ENERGY_CONFIG.evapSeconds })
      return 'expired'
    }
    set({ evapSeconds: evapSeconds - 1 })
    return null
  },
  evaporate: () => set({ localNss: 0, evapActive: false, evapSeconds: ENERGY_CONFIG.evapSeconds }),

  // ═══════════════════════════════════════════════════
  // UI ACTIONS
  // ═══════════════════════════════════════════════════
  addNotification: (text) => set(s => ({
    notifications: [{ id: Date.now(), text, read: false, time: new Date().toLocaleString() }, ...s.notifications],
    unreadCount: s.unreadCount + 1,
  })),
  markAllRead: () => set(s => ({
    notifications: s.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  addNews: (text) => set(s => ({ news: [...s.news, text] })),
  removeNews: (i) => set(s => ({ news: s.news.filter((_, idx) => idx !== i) })),
  addQuest: (quest) => set(s => ({ quests: [...s.quests, quest] })),
  removeQuest: (i) => set(s => ({ quests: s.quests.filter((_, idx) => idx !== i) })),
  setLevel: (lv) => set({ level: lv }),
}),
    {
      name: 'dc-storage-v3',
      partialize: (state) => ({
        lang: state.lang,
        ownerWallet: state.ownerWallet,
        wallet: state.wallet,
        registered: state.registered,
        sponsorId: state.sponsorId,
        authSig: state.authSig,
        authTs: state.authTs,
        level: state.level,  // Сохраняем уровень — чтобы не моргал при перезагрузке
      }),
      version: 3,
      migrate: (persisted, version) => ({
        ...persisted,
        wallet: persisted.wallet ?? null,
        registered: persisted.registered ?? false,
        authSig: persisted.authSig ?? null,
        authTs: persisted.authTs ?? null,
        level: persisted.level ?? 0,
      }),
    }
  )
)

export default useGameStore

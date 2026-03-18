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
  dct: 0,           // DCT баланс из блокчейна
  dctLocked: 0,     // Заблокированный DCT
  dctFree: 0,       // Свободный DCT
  dctPrice: 0,      // Текущая цена DCT в USDT

  // ═══════════════════════════════════════════════════
  // GAME STATE (тапалка — локальная)
  // ═══════════════════════════════════════════════════
  level: 0,
  energy: ENERGY_CONFIG.maxEnergy,
  maxEnergy: ENERGY_CONFIG.maxEnergy,
  taps: 0,
  localDct: 0,       // Локальные DCT от тапов (не блокчейн)

  // ═══════════════════════════════════════════════════
  // Evaporation (нерегистрированные)
  // ═══════════════════════════════════════════════════
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

  // Курс BNB
  bnbPrice: 0,
  setBnbPrice: (price) => set({ bnbPrice: price }),

  // News/Quests
  news: ['Добро пожаловать в Diamond Club!', 'DCT — токен с реальным обеспечением'],
  quests: [
    { name: 'Сделай 100 тапов', reward: '1 DCT', done: false },
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

  clearWallet: () => set((s) => ({
    wallet: null, chainId: null, walletType: null,
    registered: false, sponsorId: null,
    bnb: 0, usdt: 0, dct: 0, dctLocked: 0, dctFree: 0,
    level: 0,
    evapActive: false,
    evapSeconds: ENERGY_CONFIG.evapSeconds,
  })),
  setConnecting: (v) => set({ isConnecting: v }),

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
  // GAME ACTIONS (тапалка — СБАЛАНСИРОВАННАЯ)
  // ═══════════════════════════════════════════════════
  setTab: (tab) => set({ activeTab: tab }),
  toggleDayMode: () => set(s => ({ dayMode: !s.dayMode })),

  doTap: () => {
    const { energy, level, localDct, taps, registered, wallet, evapActive } = get()
    if (energy <= 0) return null
    const lv = LEVELS[level]
    const earned = lv.dctPerTap
    set({
      localDct: +(localDct + earned).toFixed(4),
      energy: energy - 1,
      taps: taps + 1,
    })
    if (!registered && !wallet && !evapActive && taps === 0) set({ evapActive: true })
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
      set({ localDct: 0, evapActive: false, evapSeconds: ENERGY_CONFIG.evapSeconds })
      return 'expired'
    }
    set({ evapSeconds: evapSeconds - 1 })
    return null
  },
  evaporate: () => set({ localDct: 0, evapActive: false, evapSeconds: ENERGY_CONFIG.evapSeconds }),

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

  // ═══ Серверная синхронизация тапов ═══
  syncServerTaps: (data) => set({
    energy: data.energy ?? get().energy,
    maxEnergy: data.maxEnergy ?? get().maxEnergy,
    localDct: data.localDct ?? get().localDct,
    taps: data.taps ?? get().taps,
  }),
}),
    {
      name: 'dc-storage-v2',
      partialize: (state) => ({
        lang: state.lang,
        ownerWallet: state.ownerWallet,
        // Кошелёк и регистрация — нужны для восстановления сессии
        wallet: state.wallet,
        registered: state.registered,
        sponsorId: state.sponsorId,
        // FIX M9: localDct и taps НЕ сохраняем — серверная тапалка для зарегистрированных
        // Для незарегистрированных (без кошелька) — тапы испаряются через 30 мин в любом случае
      }),
      version: 2,
      migrate: (persisted, version) => ({
        ...persisted,
        wallet: persisted.wallet ?? null,
        registered: persisted.registered ?? false,
      }),
    }
  )
)

export default useGameStore

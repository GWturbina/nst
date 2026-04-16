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
  // ═══════════════════════════════════════════════════
  level: 0,
  energy: ENERGY_CONFIG.maxEnergy,
  maxEnergy: ENERGY_CONFIG.maxEnergy,
  taps: 0,
  localNss: 0,

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

  // Подпись кошелька
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

  clearWallet: () => set(() => ({
    wallet: null, chainId: null, walletType: null,
    registered: false, sponsorId: null,
    bnb: 0, usdt: 0, dct: 0, dctLocked: 0, dctFree: 0,
    energy: ENERGY_CONFIG.maxEnergy,
    evapActive: false,
    evapSeconds: ENERGY_CONFIG.evapSeconds,
    // authSig/authTs НЕ стираем — SafePal session refresh
    isAdmin: false,
  })),
  clearAuth: () => set({ authSig: null, authTs: null }),
  setConnecting: (v) => set({ isConnecting: v }),

  setAuth: (authData) => set({ authSig: authData.authSig, authTs: authData.authTs }),

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
  setAdminStatus: (v) => set({ isAdmin: v }),

  setLoading: (v) => set({ isLoading: v }),
  setTxPending: (v) => set({ txPending: v }),
  setError: (err) => set({ lastError: err }),
  clearError: () => set({ lastError: null }),

  // ═══════════════════════════════════════════════════
  // GAME ACTIONS — ТАПАЛКА
  //
  // ВАЖНО: логика разная для registered / non-registered.
  //
  //   registered   → сервер — единственный источник правды.
  //                  doTap не меняет localNss и taps вообще.
  //                  Энергию локально уменьшаем на 1 для отзывчивости,
  //                  но сервер её всё равно перепишет в syncServerTaps().
  //
  //   !registered  → всё локально (как и было).
  // ═══════════════════════════════════════════════════
  setTab: (tab) => set({ activeTab: tab }),
  toggleDayMode: () => set(s => ({ dayMode: !s.dayMode })),

  doTap: () => {
    const { energy, level, localNss, taps, registered, wallet, evapActive } = get()
    if (energy <= 0) return null

    if (registered && wallet) {
      // СЕРВЕРНЫЙ режим: только уменьшаем энергию для визуальной отзывчивости.
      // localNss и taps НЕ ТРОГАЕМ — они придут с сервера.
      set({ energy: energy - 1 })
      const lv = LEVELS[level]
      return lv?.nssPerTap || 0
    }

    // ЛОКАЛЬНЫЙ режим (незарегистрированные)
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
    const { energy, maxEnergy, registered, wallet } = get()
    // Для зарегистрированных регенерация — только через сервер (loadTapState).
    // Локально не трогаем, чтобы не "наворовать" энергии.
    if (registered && wallet) return
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

  // ═══ Серверная синхронизация тапов ═══
  // Единственный способ обновить localNss/taps для зарегистрированных.
  syncServerTaps: (data) => set({
    energy: data.energy ?? get().energy,
    maxEnergy: data.maxEnergy ?? get().maxEnergy,
    localNss: data.localNss ?? get().localNss,
    taps: data.taps ?? get().taps,
  }),
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
        level: state.level,
        // localNss / taps persist-им — но это "кеш до ответа сервера",
        // не источник правды. При reload loadTapState() сразу перепишет.
        localNss: state.localNss,
        taps: state.taps,
        // Энергию НЕ persist-им для зарегистрированных — загружается с сервера.
        // Для незарегистрированных сохраняется через другой путь (LOCAL),
        // но в персисте её нет — это ок, ENERGY_CONFIG.maxEnergy по умолчанию.
        isAdmin: state.isAdmin,
      }),
      version: 3,
      migrate: (persisted) => ({
        ...persisted,
        wallet: persisted.wallet ?? null,
        registered: persisted.registered ?? false,
        authSig: persisted.authSig ?? null,
        authTs: persisted.authTs ?? null,
        localNss: persisted.localNss ?? 0,
        taps: persisted.taps ?? 0,
        isAdmin: persisted.isAdmin ?? false,
      }),
    }
  )
)

export default useGameStore

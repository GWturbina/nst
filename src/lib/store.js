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
  localNss: 0,       // Локальные NSS от тапов (не блокчейн)

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

  // FIX #7: Подпись кошелька (не сохраняется между сессиями)
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

  clearWallet: () => set((s) => ({
    wallet: null, chainId: null, walletType: null,
    registered: false, sponsorId: null,
    bnb: 0, usdt: 0, dct: 0, dctLocked: 0, dctFree: 0,
    // FIX: НЕ сбрасываем level и localNss — чтобы не моргало при переподключении
    // level: 0 — убрано, сохраняем из persist
    energy: ENERGY_CONFIG.maxEnergy,
    evapActive: false,
    evapSeconds: ENERGY_CONFIG.evapSeconds,
    authSig: null, authTs: null,
    isAdmin: false,
  })),
  setConnecting: (v) => set({ isConnecting: v }),

  // FIX #7: Установить подпись после подключения кошелька
  setAuth: (authData) => set({ authSig: authData.authSig, authTs: authData.authTs }),

  // ═══ AUTO-REGISTER (показ модала регистрации после подключения) ═══
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

  // ═══ dc_admins: установить из API ═══
  setAdminStatus: (v) => set({ isAdmin: v }),

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
    const { energy, level, localNss, taps, registered, wallet, evapActive } = get()
    if (energy <= 0) return null
    const lv = LEVELS[level]
    const earned = lv.nssPerTap
    set({
      localNss: +(localNss + earned).toFixed(4),
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
        // Кошелёк и регистрация — нужны для восстановления сессии
        wallet: state.wallet,
        registered: state.registered,
        sponsorId: state.sponsorId,
        // FIX: authSig + authTs СОХРАНЯЕМ — чтобы не спрашивать подпись каждый раз
        authSig: state.authSig,
        authTs: state.authTs,
        level: state.level,     // Сохраняем уровень — не моргает при перезагрузке
        localNss: state.localNss, // FIX: Сохраняем GST — не моргает на 0 при reload
        taps: state.taps,       // FIX: Сохраняем тапы — не моргает при reload
        isAdmin: state.isAdmin, // FIX: Сохраняем статус админа — не моргает вкладка
      }),
      version: 3,
      migrate: (persisted, version) => ({
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

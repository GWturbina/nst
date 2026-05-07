'use client'
import { useEffect, useCallback } from 'react'
import useGameStore from './store'
import web3 from './web3'
import * as C from './contracts'
// АДАПТАЦИЯ под v2.3: импорт из clubV23 вместо старого dctContracts
import { getDCTUserInfo } from './clubV23'
import { loadTapState } from './tapService'

let _refreshInterval = null
let _listenersAttached = false

/** Загрузить все данные пользователя */
async function refreshDataForAddress(address) {
  if (!address) return
  try {
    const gwStatus = await C.getGWUserStatus(address).catch(() => null)

    const [balances, bnbPrice] = await Promise.all([
      C.getBalances(address).catch(() => ({ bnb: '0', usdt: '0' })),
      C.getBNBPrice().catch(() => null),
    ])

    const store = useGameStore.getState()
    store.updateBalances(balances)
    if (bnbPrice) store.setBnbPrice(bnbPrice)

    // GlobalWay status
    if (gwStatus) {
      store.updateRegistration(gwStatus.isRegistered, gwStatus.odixId || null)
      if (gwStatus.maxPackage > 0) store.setLevel(gwStatus.maxPackage)
    }

    // ═══ FIX ISSUE-10: Загружаем тапы с сервера на уровне приложения ═══
    // Так GST баланс в Header будет актуальным на ЛЮБОЙ вкладке
    if (store.registered) {
      try {
        const tapState = await loadTapState(address)
        if (tapState) {
          store.syncServerTaps({
            energy: tapState.energy,
            maxEnergy: tapState.maxEnergy,
            localNss: tapState.totalNss,
            taps: tapState.totalTaps,
          })
        }
      } catch {}
    }

    // DCT user info (v2.3: ClubDCT)
    // Стартовая цена DCT в v2.3: $0.50 (1 USDT = 2 DCT).
    // Для конкретного пула фактическая цена считается через ClubPools.getCurrentDCTPrice(poolId),
    // но единой "цены DCT" нет — она зависит от treasury конкретного пула.
    // Здесь используем стартовую как референс для UI.
    try {
      const dctUser = await getDCTUserInfo(address)
      if (dctUser) {
        store.updateDCT({
          total: dctUser.total,
          locked: dctUser.locked,    // = frozen в v2.3
          free: dctUser.free,        // = unlocked в v2.3
          price: '0.50',             // стартовая цена DCT в Diamond Club v2.3
        })
      }
    } catch {}

    // Owner для admin-проверки (GemVaultV2)
    const owner = await C.getOwner('NSSPlatform').catch(() => null)
    if (owner && store.ownerWallet !== owner) store.setOwnerWallet(owner)

    // ═══ Проверка dc_admins (для вкладки Admin) ═══
    try {
      const adminRes = await fetch(`/api/admin?wallet=${address}`)
      const adminData = await adminRes.json()
      const shouldBeAdmin = !!(adminData.ok && adminData.isAdmin)
      if (store.isAdmin !== shouldBeAdmin) store.setAdminStatus(shouldBeAdmin)
    } catch {}
  } catch (err) {
    console.error('refreshData error:', err)
  }
}

async function doConnect() {
  const store = useGameStore.getState()
  store.setConnecting(true)
  try {
    const result = await web3.connect()
    store.setWallet(result)
    store.addNotification(`✅ Кошелёк: ${result.address.slice(0, 6)}...${result.address.slice(-4)}`)

    // ═══ СНАЧАЛА проверяем регистрацию (без подписи!) ═══
    const gwStatus = await C.getGWUserStatus(result.address).catch(() => null)
    const isReg = gwStatus?.isRegistered || false

    // Параллельно проверяем — может быть это админский кошелёк (owner / staff).
    // Для админов подпись ОБЯЗАТЕЛЬНА — иначе админка не работает.
    let isAdminWallet = false
    try {
      const adminRes = await fetch(`/api/admin?wallet=${result.address}`)
      const adminData = await adminRes.json()
      isAdminWallet = !!(adminData?.ok && adminData?.isAdmin)
    } catch {}

    if (isReg) {
      // Зарегистрирован → обновляем данные + запрашиваем подпись
      store.updateRegistration(true, gwStatus.odixId || null)
      if (gwStatus.maxPackage > 0) store.setLevel(gwStatus.maxPackage)

      // Подпись — для зарегистрированных или админов
      const authAge = store.authTs ? Date.now() - store.authTs * 1000 : Infinity
      if (!store.authSig || authAge > 12 * 60 * 60 * 1000) {
        try {
          const auth = await web3.signAuthMessage()
          store.setAuth(auth)
          window.__authDeclined = false // Успешно подписал — сброс флага
        } catch (authErr) {
          console.warn('Auth signature declined')
          window.__authDeclined = true
        }
      }

      await refreshDataForAddress(result.address)
      startRefreshCycle(result.address)
    } else if (isAdminWallet) {
      // Админ (owner/staff) — НЕ зарегистрирован, но подпись нужна для админки
      store.updateRegistration(false, null)
      const authAge = store.authTs ? Date.now() - store.authTs * 1000 : Infinity
      if (!store.authSig || authAge > 12 * 60 * 60 * 1000) {
        try {
          const auth = await web3.signAuthMessage()
          store.setAuth(auth)
          store.addNotification('🔑 Подпись админа получена')
          window.__authDeclined = false
        } catch (authErr) {
          console.warn('Admin auth signature declined')
          store.addNotification('⚠️ Подпись отклонена — админ-функции работать не будут')
          window.__authDeclined = true
        }
      }
      // Загружаем балансы для админа тоже
      const balances = await C.getBalances(result.address).catch(() => ({ bnb: '0', usdt: '0' }))
      store.updateBalances(balances)
    } else {
      // НЕ зарегистрирован → показать модал регистрации (без подписи!)
      store.updateRegistration(false, null)
      const savedRef = typeof localStorage !== 'undefined' ? localStorage.getItem('dc_ref') : null
      store.setAutoRegister(savedRef && /^\d+$/.test(savedRef) ? savedRef : null)

      // Загружаем балансы (BNB для оплаты уровня)
      const balances = await C.getBalances(result.address).catch(() => ({ bnb: '0', usdt: '0' }))
      store.updateBalances(balances)
      const bnbPrice = await C.getBNBPrice().catch(() => null)
      if (bnbPrice) store.setBnbPrice(bnbPrice)
    }

    return true
  } catch (err) {
    store.addNotification(`❌ ${err.message}`)
    return false
  } finally {
    store.setConnecting(false)
  }
}

function doDisconnect() {
  web3.disconnect()
  stopRefreshCycle()
  C.resetContractsCache()
  useGameStore.getState().clearWallet()
  useGameStore.getState().clearAuth() // Ручной disconnect — стираем подпись
}

function startRefreshCycle(address) {
  stopRefreshCycle()
  _refreshInterval = setInterval(() => refreshDataForAddress(address), 30000)
}

function stopRefreshCycle() {
  if (_refreshInterval) {
    clearInterval(_refreshInterval)
    _refreshInterval = null
  }
}

/**
 * Общая логика после успешного подключения кошелька (любым способом):
 * - проверка статуса регистрации в GlobalWay
 * - если зарегистрирован → setLevel + подпись
 * - если нет → setAutoRegister (открыть модалку регистрации)
 * - refresh + старт цикла обновления
 */
async function setupSessionForAddress(address, options = {}) {
  const store = useGameStore.getState()
  const { skipSignature = false } = options

  const gwStatus = await C.getGWUserStatus(address).catch(() => null)
  if (gwStatus?.isRegistered) {
    store.updateRegistration(true, gwStatus.odixId || null)
    if (gwStatus.maxPackage > 0) store.setLevel(gwStatus.maxPackage)

    // Подпись — только для зарегистрированных и только если она устарела
    if (!skipSignature) {
      const authAge = store.authTs ? Date.now() - store.authTs * 1000 : Infinity
      if (!store.authSig || authAge > 12 * 60 * 60 * 1000) {
        if (!window.__authDeclined) {
          try {
            const auth = await web3.signAuthMessage()
            store.setAuth(auth)
          } catch {
            console.warn('Auth signature declined on auto-reconnect')
            window.__authDeclined = true
          }
        }
      }
    }
  } else {
    // Кошелёк подключён, но НЕ зарегистрирован → открыть модалку
    store.updateRegistration(false, null)
    const savedRef = typeof localStorage !== 'undefined' ? localStorage.getItem('dc_ref') : null
    store.setAutoRegister(savedRef && /^\d+$/.test(savedRef) ? savedRef : null)
  }

  await refreshDataForAddress(address)
  startRefreshCycle(address)
}

export function useBlockchainInit() {
  const wallet = useGameStore(s => s.wallet)

  useEffect(() => {
    if (_listenersAttached) return
    _listenersAttached = true

    // FIX: SafePal extension делает session refresh (disconnect→reconnect за 1-2 сек)
    // Ждём 3 секунды — если за это время придёт accountsChanged, не отключаемся
    let disconnectTimer = null
    const onDisconnected = () => {
      if (disconnectTimer) clearTimeout(disconnectTimer)
      disconnectTimer = setTimeout(() => {
        // Если за 3 сек не переподключился — настоящий disconnect
        if (!web3.isConnected) {
          stopRefreshCycle()
          C.resetContractsCache()
          useGameStore.getState().clearWallet()
          // НЕ стираем authSig — может быть session refresh
        }
      }, 3000)
    }
    const onAccountChanged = (e) => {
      // Отменяем таймер disconnect — это был session refresh, не настоящий disconnect
      if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null }
      const newAddr = e.detail?.address
      if (newAddr) {
        const store = useGameStore.getState()
        // FIX: Не обновлять store если адрес тот же — иначе вызывает цепочку
        if (store.wallet && store.wallet.toLowerCase() === newAddr.toLowerCase()) return
        store.setWallet({ address: newAddr, chainId: web3.chainId, walletType: web3.walletType })
        refreshDataForAddress(newAddr)
        startRefreshCycle(newAddr)
      }
    }
    const onChainChanged = (e) => {
      const chainId = e.detail?.chainId
      if (chainId !== 204 && chainId !== 5611) {
        useGameStore.getState().addNotification('⚠️ Переключитесь на сеть opBNB!')
      }
    }

    window.addEventListener('wallet:disconnected', onDisconnected)
    window.addEventListener('wallet:accountChanged', onAccountChanged)
    window.addEventListener('wallet:chainChanged', onChainChanged)

    return () => {
      window.removeEventListener('wallet:disconnected', onDisconnected)
      window.removeEventListener('wallet:accountChanged', onAccountChanged)
      window.removeEventListener('wallet:chainChanged', onChainChanged)
      if (disconnectTimer) clearTimeout(disconnectTimer)
      _listenersAttached = false
    }
  }, [])

  // ═══ ТИХОЕ АВТОПОДКЛЮЧЕНИЕ при первом маунте /cabinet ═══
  // Если SafePal уже разрешил доступ к этому сайту — подключаемся
  // без всплывающего окна "Connect", даже если в zustand persist нет wallet.
  // Это решает кейс: пользователь первый раз заходит на /cabinet,
  // SafePal injected, eth_accounts уже возвращает адрес — но раньше
  // нужен был ручной клик "Подключить".
  useEffect(() => {
    let cancelled = false
    const trySilentConnect = async () => {
      // Если wallet уже есть в persist — обработка идёт во втором useEffect
      if (useGameStore.getState().wallet) return
      if (web3.isConnected) return
      try {
        const result = await web3.silentConnect()
        if (cancelled || !result) return
        const store = useGameStore.getState()
        store.setWallet(result)
        store.addNotification(`✅ Кошелёк: ${result.address.slice(0, 6)}...${result.address.slice(-4)}`)
        await setupSessionForAddress(result.address)
      } catch (e) {
        console.warn('silent autoConnect failed:', e?.message)
      }
    }
    trySilentConnect()
    return () => { cancelled = true }
  }, [])

  // ═══ FIX BUG-6: Восстановление сессии ═══
  // Если wallet восстановлен из persist, но web3 не подключён —
  // автоматически переподключаем. Подпись НЕ запрашиваем если она свежая.
  useEffect(() => {
    if (wallet && !web3.isConnected) {
      const autoReconnect = async () => {
        try {
          const walletType = web3.detectWallet()
          if (!walletType) return // нет провайдера — ждём ручного подключения

          // Сначала пробуем тихо — без всплывающего окна
          let result = await web3.silentConnect()
          // Если тихо не вышло (нет разрешения) — обычный connect (всплывёт окно)
          if (!result) {
            result = await web3.connect()
          }

          const store = useGameStore.getState()
          // FIX: Не вызывать setWallet если адрес не изменился
          if (!store.wallet || store.wallet.toLowerCase() !== result.address.toLowerCase()) {
            store.setWallet(result)
          }

          await setupSessionForAddress(result.address)
        } catch {
          // FIX: НЕ сбрасываем состояние при ошибке переподключения
          // SafePal может загружаться медленно — данные из persist остаются
          console.warn('Auto-reconnect failed, keeping persisted state')
        }
      }
      autoReconnect()
    }

    if (wallet && web3.isConnected && !_refreshInterval) {
      refreshDataForAddress(wallet)
      startRefreshCycle(wallet)
    }
    if (!wallet) stopRefreshCycle()
  }, [wallet])

  useEffect(() => {
    C.getBNBPrice().then(price => {
      if (price) useGameStore.getState().setBnbPrice(price)
    }).catch(() => {})
  }, [])
}

export function useBlockchain() {
  const wallet = useGameStore(s => s.wallet)
  return {
    connect: doConnect,
    disconnect: doDisconnect,
    refreshData: () => refreshDataForAddress(wallet),
    /** Вызвать после успешной регистрации — подпись + полная загрузка данных */
    afterRegistration: async () => {
      const store = useGameStore.getState()
      const addr = store.wallet
      if (!addr) return
      // Теперь запрашиваем подпись (пользователь уже знаком с приложением)
      try {
        const auth = await web3.signAuthMessage()
        store.setAuth(auth)
      } catch {}
      store.clearAutoRegister()
      await refreshDataForAddress(addr)
      startRefreshCycle(addr)
    },
  }
}

export function useTx() {
  const { setTxPending, addNotification } = useGameStore()
  const wallet = useGameStore(s => s.wallet)

  const exec = useCallback(async (fn, successMsg, errorMsg) => {
    setTxPending(true)
    const result = await C.safeCall(fn)
    setTxPending(false)
    if (result.ok) {
      addNotification(successMsg || '✅ Транзакция выполнена!')
      setTimeout(() => refreshDataForAddress(wallet), 2000)
      return { ok: true, data: result.data }
    } else {
      addNotification(errorMsg || `❌ ${result.error}`)
      return { ok: false, error: result.error }
    }
  }, [setTxPending, addNotification, wallet])

  return exec
}

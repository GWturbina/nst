'use client'
import { useEffect, useCallback } from 'react'
import useGameStore from './store'
import web3 from './web3'
import * as C from './contracts'

// ═══════════════════════════════════════════════════
// СИНГЛТОН: только один рефреш-цикл на всё приложение
// ═══════════════════════════════════════════════════
let _refreshInterval = null
let _listenersAttached = false

/** Загрузить все данные пользователя (модульная функция) */
async function refreshDataForAddress(address) {
  if (!address) return
  try {
    // Сначала получаем полный статус из GlobalWayBridge — это главный источник правды
    const gwStatus = await C.getGWUserStatus(address).catch(() => null)

    const [balances, tables, pending, charity, house, bnbPrice] = await Promise.all([
      C.getBalances(address).catch(() => ({ bnb: '0', usdt: '0', cgt: '0', nst: '0' })),
      C.getUserAllTables(address).catch(() => [null, null, null]),
      C.getMyPendingWithdrawal(address).catch(() => 0n),
      C.canGiveGift(address).catch(() => null),
      C.getHouseInfo(address).catch(() => null),
      C.getBNBPrice().catch(() => null),
    ])

    const store = useGameStore.getState()
    store.updateBalances(balances)
    if (bnbPrice) store.setBnbPrice(bnbPrice)

    // Синхронизируем статус регистрации и уровень из GlobalWay
    if (gwStatus) {
      // isRegistered = зарегистрирован в GlobalWay (достаточно для покупки уровней)
      store.updateRegistration(gwStatus.isRegistered, gwStatus.odixId || null)
      // maxPackage = реальный уровень из GlobalWay (0-12), НЕ ранг (0-5)!
      if (gwStatus.maxPackage > 0) store.setLevel(gwStatus.maxPackage)
    } else {
      // Fallback: читаем из NSSPlatform напрямую
      const nssReg = await C.isNSSRegistered(address).catch(() => false)
      store.updateRegistration(nssReg, null)
    }

    store.updateTables(tables)
    if (pending) store.updatePending((Number(pending) / 1e18).toFixed(2))
    if (charity) store.updateCharity((Number(charity[1]) / 1e18).toFixed(2), charity[2])
    if (house) store.updateHouse(house)

    // owner для admin-проверки
    const owner = await C.getOwner('RealEstateMatrix').catch(() => null)
    if (owner) store.setOwnerWallet(owner)

    // Синхронизация тапалки с сервером (Supabase)
    store.syncTapState()

    // Загрузка бонусов за уровни
    try {
      const { getUserBonuses, isSupabaseAvailable } = await import('./tapService')
      if (isSupabaseAvailable()) {
        const bonuses = await getUserBonuses(address)
        if (bonuses) store.setLevelBonuses(bonuses)
      }
    } catch {}
  } catch (err) {
    console.error('refreshData error:', err)
  }
}

/** Подключить кошелёк */
async function doConnect() {
  const store = useGameStore.getState()
  store.setConnecting(true)
  try {
    const result = await web3.connect()
    store.setWallet(result)
    store.addNotification(`✅ Кошелёк: ${result.address.slice(0, 6)}...${result.address.slice(-4)}`)

    // Загрузить данные один раз
    await refreshDataForAddress(result.address)

    // Запустить авторефреш (если ещё нет)
    startRefreshCycle(result.address)

    // ═══ AUTO-REGISTER: если не зарегистрирован — показать модал ═══
    const currentStore = useGameStore.getState()
    if (!currentStore.registered) {
      const savedRef = typeof localStorage !== 'undefined' ? localStorage.getItem('nss_ref') : null
      if (savedRef && /^\d+$/.test(savedRef)) {
        store.setAutoRegister(parseInt(savedRef, 10))
      } else {
        store.setAutoRegister(null) // Покажет модал с ручным вводом
      }
    }

    return true
  } catch (err) {
    store.addNotification(`❌ ${err.message}`)
    return false
  } finally {
    store.setConnecting(false)
  }
}

/** Отключить кошелёк */
function doDisconnect() {
  web3.disconnect()
  stopRefreshCycle()
  C.resetContractsCache()        // сброс кеша bridge адреса
  useGameStore.getState().clearWallet()
}

/** Запуск авторефреша (30 сек) — ОДИН на всё приложение */
function startRefreshCycle(address) {
  stopRefreshCycle()
  _refreshInterval = setInterval(() => refreshDataForAddress(address), 30000)
}

/** Остановка авторефреша */
function stopRefreshCycle() {
  if (_refreshInterval) {
    clearInterval(_refreshInterval)
    _refreshInterval = null
  }
}

// ═══════════════════════════════════════════════════
// ХУКИ
// ═══════════════════════════════════════════════════

/**
 * useBlockchainInit() — вызывается ОДИН РАЗ в корневом page.js
 * Подписывается на события кошелька и запускает рефреш при наличии wallet.
 */
export function useBlockchainInit() {
  const wallet = useGameStore(s => s.wallet)

  // Слушаем события кошелька — один раз
  useEffect(() => {
    if (_listenersAttached) return
    _listenersAttached = true

    const onDisconnected = () => {
      doDisconnect()
    }
    const onAccountChanged = (e) => {
      const newAddr = e.detail?.address
      if (newAddr) {
        const store = useGameStore.getState()
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
      _listenersAttached = false
    }
  }, [])

  // Если wallet уже есть (reload) — попробовать восстановить signer
  useEffect(() => {
    if (wallet && !_refreshInterval) {
      // После перезагрузки signer = null, нужно переподключить
      if (!web3.signer) {
        // Тихое переподключение без уведомлений
        web3.connect().then((result) => {
          const store = useGameStore.getState()
          store.setWallet(result)
          refreshDataForAddress(result.address)
          startRefreshCycle(result.address)
        }).catch(() => {
          // Кошелёк недоступен — сбрасываем
          useGameStore.getState().clearWallet()
        })
      } else {
        refreshDataForAddress(wallet)
        startRefreshCycle(wallet)
      }
    }
    if (!wallet) {
      stopRefreshCycle()
    }
  }, [wallet])

  // Загружаем курс BNB при старте (даже без кошелька — для отображения цен)
  useEffect(() => {
    C.getBNBPrice().then(price => {
      if (price) useGameStore.getState().setBnbPrice(price)
    }).catch(() => {})
  }, [])
}

/**
 * useBlockchain() — безопасно вызывать из ЛЮБОГО компонента.
 * НЕ создаёт интервалы, НЕ подписывается на события.
 * Просто возвращает connect / disconnect / refreshData.
 */
export function useBlockchain() {
  const wallet = useGameStore(s => s.wallet)

  return {
    connect: doConnect,
    disconnect: doDisconnect,
    refreshData: () => refreshDataForAddress(wallet),
  }
}

/**
 * useTx() — обёртка для транзакций с loading state и уведомлениями
 */
export function useTx() {
  const { setTxPending, addNotification } = useGameStore()
  const wallet = useGameStore(s => s.wallet)

  const exec = useCallback(async (fn, successMsg, errorMsg) => {
    setTxPending(true)
    const result = await C.safeCall(fn)
    setTxPending(false)

    if (result.ok) {
      addNotification(successMsg || '✅ Транзакция выполнена!')
      // Рефреш данных через 2 сек (дождаться блок)
      setTimeout(() => refreshDataForAddress(wallet), 2000)
      return { ok: true, data: result.data }
    } else {
      addNotification(errorMsg || `❌ ${result.error}`)
      return { ok: false, error: result.error }
    }
  }, [setTxPending, addNotification, wallet])

  return exec
}

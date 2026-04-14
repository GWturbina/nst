'use client'
import { useEffect, useCallback } from 'react'
import useGameStore from './store'
import web3 from './web3'
import * as C from './contracts'
import { getDCTTokenInfo, getDCTUserInfo } from './dctContracts'
import { loadTapState } from './tapService'

let _refreshInterval = null
let _listenersAttached = false
let _reconnectAttempt = 0
const MAX_RECONNECT_ATTEMPTS = 3

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

    // GlobalWay status — обновляем ТОЛЬКО если RPC вернул данные
    // Если gwStatus === null (RPC упал) — НЕ трогаем registered
    if (gwStatus) {
      store.updateRegistration(gwStatus.isRegistered, gwStatus.odixId || null)
      if (gwStatus.maxPackage > 0) store.setLevel(gwStatus.maxPackage)
    }

    // ═══ Загружаем тапы с сервера ═══
    // Сервер — единственный источник правды для зарегистрированных
    if (store.registered) {
      try {
        const tapState = await loadTapState(address)
        if (tapState) {
          store.syncFromServer(tapState)
        }
      } catch {}
    }

    // DCT token info
    try {
      const dctUser = await getDCTUserInfo(address)
      if (dctUser) {
        store.updateDCT({
          total: dctUser.total,
          locked: dctUser.locked,
          free: dctUser.free,
          price: dctUser.valueUSDT && dctUser.total > 0
            ? (parseFloat(dctUser.valueUSDT) / parseFloat(dctUser.total)).toFixed(6)
            : '0',
        })
      }
    } catch {}

    // DCT price (if no user balance)
    try {
      const tokenInfo = await getDCTTokenInfo()
      if (tokenInfo) {
        const current = store
        store.updateDCT({
          total: current.dct || 0,
          locked: current.dctLocked || 0,
          free: current.dctFree || 0,
          price: tokenInfo.price,
        })
      }
    } catch {}

    // Owner для admin-проверки
    const owner = await C.getOwner('NSSPlatform').catch(() => null)
    if (owner) store.setOwnerWallet(owner)
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

    const gwStatus = await C.getGWUserStatus(result.address).catch(() => null)
    const isReg = gwStatus?.isRegistered || false

    if (isReg) {
      store.updateRegistration(true, gwStatus.odixId || null)
      if (gwStatus.maxPackage > 0) store.setLevel(gwStatus.maxPackage)

      const authAge = store.authTs ? Date.now() - store.authTs * 1000 : Infinity
      if (!store.authSig || authAge > 12 * 60 * 60 * 1000) {
        try {
          const auth = await web3.signAuthMessage()
          store.setAuth(auth)
        } catch (authErr) {
          console.warn('Auth signature declined')
        }
      }

      await refreshDataForAddress(result.address)
      startRefreshCycle(result.address)
    } else {
      store.updateRegistration(false, null)
      const savedRef = typeof localStorage !== 'undefined' ? localStorage.getItem('dc_ref') : null
      store.setAutoRegister(savedRef && /^\d+$/.test(savedRef) ? savedRef : null)

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

export function useBlockchainInit() {
  const wallet = useGameStore(s => s.wallet)

  useEffect(() => {
    if (_listenersAttached) return
    _listenersAttached = true

    const onDisconnected = () => doDisconnect()
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

  // ═══ Безопасное восстановление сессии ═══
  // Если wallet восстановлен из persist, но web3 не подключён —
  // пробуем переподключить. При ошибке НЕ сбрасываем состояние,
  // а ждём и пробуем снова (SafePal может загружаться медленно).
  useEffect(() => {
    if (wallet && !web3.isConnected) {
      _reconnectAttempt = 0

      const autoReconnect = async () => {
        const store = useGameStore.getState()

        try {
          const walletType = web3.detectWallet()

          if (!walletType) {
            // SafePal ещё не загрузился — пробуем через 1 секунду
            if (_reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
              _reconnectAttempt++
              setTimeout(autoReconnect, 1000)
              return
            }
            // Все попытки исчерпаны, но НЕ сбрасываем —
            // подгружаем данные тапов с сервера (GET не требует web3)
            if (store.registered && wallet) {
              try {
                const tapState = await loadTapState(wallet)
                if (tapState) store.syncFromServer(tapState)
              } catch {}
            }
            return
          }

          const result = await web3.connect()
          store.setWallet(result)
          _reconnectAttempt = 0

          // Проверяем регистрацию
          const gwStatus = await C.getGWUserStatus(result.address).catch(() => null)
          if (gwStatus?.isRegistered) {
            store.updateRegistration(true, gwStatus.odixId || null)
            if (gwStatus.maxPackage > 0) store.setLevel(gwStatus.maxPackage)

            const authAge = store.authTs ? Date.now() - store.authTs * 1000 : Infinity
            if (!store.authSig || authAge > 12 * 60 * 60 * 1000) {
              try {
                const auth = await web3.signAuthMessage()
                store.setAuth(auth)
              } catch {
                console.warn('Auth signature declined on auto-reconnect')
              }
            }
          }
          // Если gwStatus === null (RPC упал) — НЕ трогаем registered.
          // Persist хранит registered: true — доверяем ему.

          await refreshDataForAddress(result.address)
          startRefreshCycle(result.address)

        } catch (err) {
          console.warn('Auto-reconnect failed:', err.message || err)

          // ═══ КРИТИЧНЫЙ FIX: НЕ вызываем clearWallet() ═══
          // Данные из persist остаются. Лучше показать старые данные
          // чем сбросить всё в ноль.

          // Retry если ещё не исчерпали попытки
          if (_reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
            _reconnectAttempt++
            setTimeout(autoReconnect, 1500)
            return
          }

          // Все попытки исчерпаны — подгружаем хотя бы тапы с сервера
          if (store.registered && wallet) {
            try {
              const tapState = await loadTapState(wallet)
              if (tapState) store.syncFromServer(tapState)
            } catch {}
          }
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
    afterRegistration: async () => {
      const store = useGameStore.getState()
      const addr = store.wallet
      if (!addr) return
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

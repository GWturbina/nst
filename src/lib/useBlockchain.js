'use client'
import { useEffect, useCallback } from 'react'
import useGameStore from './store'
import web3 from './web3'
import * as C from './contracts'
import { getDCTTokenInfo, getDCTUserInfo } from './dctContracts'

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
        store.updateDCT(prev => ({
          ...prev,
          price: tokenInfo.price,
        }))
      }
    } catch {}

    // Owner для admin-проверки (GemVaultV2)
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
    await refreshDataForAddress(result.address)
    startRefreshCycle(result.address)
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

  useEffect(() => {
    if (wallet && !_refreshInterval) {
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

'use client'
/**
 * DeliverySection — Зашифрованная доставка физических активов
 * Интегрируется в DiamondClubPage как дополнительный sub-таб "Доставка"
 * 
 * Фронтенд-шифрование: Web Crypto API (RSA-OAEP)
 * Куратор расшифровывает своим приватным ключом off-chain
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { safeCall } from '@/lib/contracts'
import { ethers } from 'ethers'
import web3 from '@/lib/web3'
import ADDRESSES from '@/contracts/addresses'

// ═══════════════════════════════════════════════════
// ABI PrivateMailbox
// ═══════════════════════════════════════════════════
const MAILBOX_ABI = [
  'function getRegionCount() view returns (uint256)',
  'function getRegionInfo(uint256) view returns (string name, address curator, bool active, uint256 orderCount, uint256 deliveredCount)',
  'function getRegionPublicKey(uint256) view returns (bytes)',
  'function getOrder(uint256) view returns (tuple(uint256 id, uint256 purchaseId, uint8 assetSource, address buyer, uint256 regionId, bytes encryptedData, bytes encryptedTrack, uint8 status, uint64 createdAt, uint64 updatedAt, string curatorNote))',
  'function getBuyerOrders(address) view returns (uint256[])',
  'function getOrderByPurchase(uint256, uint8) view returns (uint256)',
  'function submitDelivery(uint256 purchaseId, uint8 assetSource, uint256 regionId, bytes encryptedData)',
  'function confirmDelivery(uint256 orderId)',
  'function openDispute(uint256 orderId)',
  'function cancelOrder(uint256 orderId)',
  'function purgeDeliveryData(uint256 orderId)',
]

const READ_RPC = 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)

function getMailboxRead() {
  const addr = ADDRESSES.PrivateMailbox
  if (!addr || addr.startsWith('0x_')) return null
  return new ethers.Contract(addr, MAILBOX_ABI, readProvider)
}

function getMailboxWrite() {
  if (!web3.signer) throw new Error('Кошелёк не подключён')
  return new ethers.Contract(ADDRESSES.PrivateMailbox, MAILBOX_ABI, web3.signer)
}

// ═══════════════════════════════════════════════════
// ШИФРОВАНИЕ (Web Crypto API — RSA-OAEP)
// ═══════════════════════════════════════════════════

/**
 * Шифрует строку публичным ключом куратора
 * @param pubKeyHex Публичный ключ куратора (hex из контракта)
 * @param plaintext Адрес доставки (JSON строка с полями)
 * @returns bytes hex для передачи в контракт
 */
async function encryptForCurator(pubKeyHex, plaintext) {
  // Публичный ключ хранится как raw bytes в контракте
  const pubKeyBytes = hexToBytes(pubKeyHex)

  // Импортируем RSA публичный ключ
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    pubKeyBytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )

  // Шифруем
  const encoded = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    cryptoKey,
    encoded
  )

  return bytesToHex(new Uint8Array(encrypted))
}

function hexToBytes(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substr(i, 2), 16)
  }
  return bytes
}

function bytesToHex(bytes) {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ═══════════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════════

const STATUS_MAP = {
  0: { label: '—', emoji: '⚪', color: 'text-slate-500' },
  1: { label: 'submitted', emoji: '📨', color: 'text-blue-400' },
  2: { label: 'confirmed', emoji: '✅', color: 'text-emerald-400' },
  3: { label: 'preparing', emoji: '📦', color: 'text-purple-400' },
  4: { label: 'shipped', emoji: '🚚', color: 'text-gold-400' },
  5: { label: 'delivered', emoji: '🎉', color: 'text-emerald-400' },
  6: { label: 'dispute', emoji: '⚠️', color: 'text-red-400' },
  7: { label: 'cancelled', emoji: '❌', color: 'text-slate-500' },
}

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════

export default function DeliverySection() {
  const { wallet, addNotification, setTxPending, txPending, t } = useGameStore()
  const [regions, setRegions] = useState([])
  const [myOrders, setMyOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Форма
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('')
  const [assetSource, setAssetSource] = useState(0) // 0=gems, 1=metals
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [deliveryName, setDeliveryName] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryPhone, setDeliveryPhone] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [encrypting, setEncrypting] = useState(false)

  const reload = useCallback(async () => {
    const c = getMailboxRead()
    if (!c || !wallet) { setLoading(false); return }

    try {
      setLoading(true)

      // Загружаем регионы
      const regionCount = await c.getRegionCount()
      const regionList = []
      for (let i = 0; i < Number(regionCount); i++) {
        const info = await c.getRegionInfo(i)
        regionList.push({
          id: i,
          name: info.name,
          curator: info.curator,
          active: info.active,
          orderCount: Number(info.orderCount),
          deliveredCount: Number(info.deliveredCount),
        })
      }
      setRegions(regionList)

      // Загружаем мои заказы
      const orderIds = await c.getBuyerOrders(wallet)
      const orderList = []
      for (const id of orderIds) {
        try {
          const o = await c.getOrder(id)
          orderList.push({
            id: Number(o.id),
            purchaseId: Number(o.purchaseId),
            assetSource: Number(o.assetSource),
            regionId: Number(o.regionId),
            status: Number(o.status),
            createdAt: Number(o.createdAt),
            updatedAt: Number(o.updatedAt),
            curatorNote: o.curatorNote,
            hasTrack: o.encryptedTrack.length > 2, // "0x" = нет
          })
        } catch {}
      }
      setMyOrders(orderList.reverse()) // новые сверху
    } catch (err) {
      console.error('Delivery load error:', err)
    } finally {
      setLoading(false)
    }
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  // ═══════════════════════════════════════════════════
  // SUBMIT DELIVERY
  // ═══════════════════════════════════════════════════

  const handleSubmit = async () => {
    if (!selectedPurchaseId || !deliveryName || !deliveryAddress || selectedRegion === null) {
      addNotification(`❌ ${t('dcDeliveryFillAll')}`)
      return
    }

    const region = regions[selectedRegion]
    if (!region || !region.active) {
      addNotification(`❌ ${t('dcRegionInactive')}`)
      return
    }

    try {
      setEncrypting(true)

      // Собираем данные для шифрования
      const deliveryData = JSON.stringify({
        name: deliveryName,
        address: deliveryAddress,
        phone: deliveryPhone,
        note: deliveryNote,
        purchaseId: selectedPurchaseId,
        timestamp: Date.now(),
      })

      // Получаем публичный ключ куратора
      const c = getMailboxRead()
      const pubKeyBytes = await c.getRegionPublicKey(selectedRegion)
      const pubKeyHex = pubKeyBytes

      // Шифруем
      const encryptedHex = await encryptForCurator(pubKeyHex, deliveryData)
      setEncrypting(false)

      // Отправляем в блокчейн
      setTxPending(true)
      const mailbox = getMailboxWrite()
      const result = await safeCall(async () => {
        const tx = await mailbox.submitDelivery(
          selectedPurchaseId,
          assetSource,
          selectedRegion,
          encryptedHex
        )
        return await tx.wait()
      })

      setTxPending(false)
      if (result.ok) {
        addNotification(`✅ 📨 ${t('dcDeliverySubmitted')}`)
        setShowForm(false)
        resetForm()
        reload()
      } else {
        addNotification(`❌ ${result.error}`)
      }
    } catch (err) {
      setEncrypting(false)
      setTxPending(false)
      addNotification(`❌ ${t('dcEncryptionError')}: ${err.message}`)
    }
  }

  const handleConfirmDelivery = async (orderId) => {
    setTxPending(true)
    const mailbox = getMailboxWrite()
    const result = await safeCall(async () => {
      const tx = await mailbox.confirmDelivery(orderId)
      return await tx.wait()
    })
    setTxPending(false)
    if (result.ok) {
      addNotification(`✅ 🎉 ${t('dcDeliveryConfirmed')}`)
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
  }

  const handleDispute = async (orderId) => {
    setTxPending(true)
    const mailbox = getMailboxWrite()
    const result = await safeCall(async () => {
      const tx = await mailbox.openDispute(orderId)
      return await tx.wait()
    })
    setTxPending(false)
    if (result.ok) {
      addNotification(`⚠️ ${t('dcDisputeOpened')}`)
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
  }

  const handlePurge = async (orderId) => {
    setTxPending(true)
    const mailbox = getMailboxWrite()
    const result = await safeCall(async () => {
      const tx = await mailbox.purgeDeliveryData(orderId)
      return await tx.wait()
    })
    setTxPending(false)
    if (result.ok) {
      addNotification(`🗑️ ${t('dcDataPurged')}`)
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
  }

  const resetForm = () => {
    setSelectedPurchaseId('')
    setDeliveryName('')
    setDeliveryAddress('')
    setDeliveryPhone('')
    setDeliveryNote('')
    setSelectedRegion(null)
  }

  if (loading) return <div className="flex items-center justify-center py-12"><div className="text-2xl animate-spin">📦</div></div>

  return (
    <div className="px-3 mt-2 space-y-2">

      {/* Мои заказы на доставку */}
      {myOrders.length > 0 && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-gold-400 mb-2">📦 {t('dcMyDeliveries')} ({myOrders.length})</div>
          <div className="space-y-1.5">
            {myOrders.map(order => {
              const s = STATUS_MAP[order.status]
              const regionName = regions[order.regionId]?.name || '—'
              return (
                <div key={order.id} className="p-2.5 rounded-xl bg-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{s.emoji}</span>
                      <div>
                        <span className="text-[11px] font-bold text-white">
                          #{order.purchaseId} ({order.assetSource === 0 ? '💎' : '🥇'})
                        </span>
                        <span className="text-[9px] text-slate-500 ml-2">{regionName}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold ${s.color}`}>
                      {t(`dcStatus_${s.label}`) || s.label}
                    </span>
                  </div>

                  {order.curatorNote && (
                    <div className="text-[9px] text-slate-400 mb-1">💬 {order.curatorNote}</div>
                  )}

                  <div className="text-[8px] text-slate-600">
                    {new Date(order.createdAt * 1000).toLocaleDateString()} → {new Date(order.updatedAt * 1000).toLocaleDateString()}
                  </div>

                  {/* Действия */}
                  <div className="flex gap-1 mt-1.5">
                    {order.status === 4 && ( /* SHIPPED → confirm */
                      <button onClick={() => handleConfirmDelivery(order.id)} disabled={txPending}
                        className="px-2 py-1 rounded-lg text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        🎉 {t('dcConfirmReceived')}
                      </button>
                    )}
                    {[2, 3, 4].includes(order.status) && ( /* CONFIRMED/PREPARING/SHIPPED → dispute */
                      <button onClick={() => handleDispute(order.id)} disabled={txPending}
                        className="px-2 py-1 rounded-lg text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        ⚠️ {t('dcDispute')}
                      </button>
                    )}
                    {[5, 7].includes(order.status) && ( /* DELIVERED/CANCELLED → purge */
                      <button onClick={() => handlePurge(order.id)} disabled={txPending}
                        className="px-2 py-1 rounded-lg text-[9px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        🗑️ {t('dcPurgeData')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Кнопка создания заказа */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-2xl text-[12px] font-bold border border-dashed border-gold-400/25 text-gold-400/70 hover:border-gold-400/50 hover:text-gold-400 transition-all">
          📨 {t('dcNewDelivery')}
        </button>
      ) : (
        /* Форма создания заказа */
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-gold-400 mb-3">📨 {t('dcNewDeliveryForm')}</div>

          {/* Тип актива */}
          <div className="flex gap-1 mb-2">
            <button onClick={() => setAssetSource(0)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold border ${assetSource === 0 ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'}`}>
              💎 {t('dcGems')}
            </button>
            <button onClick={() => setAssetSource(1)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold border ${assetSource === 1 ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'}`}>
              🥇 {t('dcMetals')}
            </button>
          </div>

          {/* Purchase ID */}
          <input type="number" value={selectedPurchaseId} onChange={e => setSelectedPurchaseId(e.target.value)}
            placeholder={t('dcPurchaseIdPlaceholder')}
            className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none mb-2" />

          {/* Регион */}
          <div className="text-[10px] text-slate-500 mb-1">{t('dcSelectRegion')}:</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {regions.filter(r => r.active).map(r => (
              <button key={r.id} onClick={() => setSelectedRegion(r.id)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border ${
                  selectedRegion === r.id
                    ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
                    : 'border-white/8 text-slate-500'
                }`}>
                🌐 {r.name}
              </button>
            ))}
          </div>

          {/* Адрес доставки (будет зашифрован) */}
          <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15 mb-2">
            <div className="text-[9px] text-emerald-400 font-bold mb-1">🔒 {t('dcEncryptedFields')}</div>

            <input value={deliveryName} onChange={e => setDeliveryName(e.target.value)}
              placeholder={t('dcRecipientName')}
              className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none mb-1.5" />

            <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
              placeholder={t('dcDeliveryAddress')}
              rows={2}
              className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none mb-1.5 resize-none" />

            <input value={deliveryPhone} onChange={e => setDeliveryPhone(e.target.value)}
              placeholder={t('dcPhone')}
              className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none mb-1.5" />

            <input value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)}
              placeholder={t('dcDeliveryNote')}
              className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
          </div>

          {/* Кнопки */}
          <div className="flex gap-2">
            <button onClick={handleSubmit}
              disabled={txPending || encrypting || !selectedPurchaseId || !deliveryName || !deliveryAddress || selectedRegion === null}
              className="flex-1 py-2.5 rounded-xl text-[11px] font-bold gold-btn"
              style={{ opacity: (txPending || encrypting || !selectedPurchaseId || !deliveryName) ? 0.5 : 1 }}>
              {encrypting ? `🔐 ${t('dcEncrypting')}...` : txPending ? `⏳ ${t('loading')}` : `📨 ${t('dcSubmitDelivery')}`}
            </button>
            <button onClick={() => { setShowForm(false); resetForm() }}
              className="py-2.5 px-4 rounded-xl text-[11px] font-bold text-slate-500 border border-white/8">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Как это работает */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-blue-400 mb-2">🔐 {t('dcHowDeliveryWorks')}</div>
        <div className="space-y-1 text-[11px] text-slate-300">
          <p>1. {t('dcDelivStep1')}</p>
          <p>2. {t('dcDelivStep2')}</p>
          <p>3. {t('dcDelivStep3')}</p>
          <p>4. {t('dcDelivStep4')}</p>
          <p>5. {t('dcDelivStep5')}</p>
        </div>
      </div>

      {/* Регионы */}
      {regions.length > 0 && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-purple-400 mb-2">🌐 {t('dcRegions')}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {regions.map(r => (
              <div key={r.id} className={`p-2 rounded-xl text-center ${r.active ? 'bg-white/5' : 'bg-white/3 opacity-50'}`}>
                <div className="text-[11px] font-bold text-white">{r.name}</div>
                <div className="text-[9px] text-slate-500">
                  {r.deliveredCount}/{r.orderCount} {t('dcDelivered')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

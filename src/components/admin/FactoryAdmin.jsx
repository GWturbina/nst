'use client'
/**
 * FactoryAdmin.jsx — Управление заводами и выводы USDT (v2.4) — v3
 *
 * v3: Исправлено отображение "0 заводов" когда они на самом деле есть.
 *     Теперь:
 *      • Хранение списка заводов в localStorage (надёжнее чем queryFilter)
 *      • Можно ввести адрес вручную для проверки/вывода
 *      • Параллельно пытается загрузить через events (если получится)
 *      • Секция "Вывод" показывается всегда для owner — можно ввести адрес
 */
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import ADDRESSES from '@/contracts/addresses'

const POOLS_ABI = [
  'function approvedFactories(address) view returns (bool)',
  'function addFactory(address factory)',
  'function revokeFactory(address factory)',
  'function withdrawForGemPurchase(address to, uint256 amount)',
  'function recordGemPurchased(uint256 poolId, uint256 itemId, uint256 cost)',
  'function multisig() view returns (address)',
  'function owner() view returns (address)',
  'function getReserveBalance() view returns (uint256)',
  'function poolsCount() view returns (uint256)',
  'function getPool(uint256) view returns (tuple(uint256 id, string name, uint256 targetUSDT, uint256 raisedUSDT, uint256 treasuryUSDT, uint256 totalDCT, uint8 status, uint64 createdAt, uint64 unlocksAt, uint8 cyclesCompleted, uint256 currentItemId, string metaUrl))',
  'event FactoryAdded(address indexed factory)',
  'event FactoryRevoked(address indexed factory)',
  'event GemPurchaseWithdraw(address indexed recipient, uint256 amount)',
]

const USDT_ABI = ['function balanceOf(address) view returns (uint256)']

const RPC = 'https://opbnb-mainnet-rpc.bnbchain.org'
const STORAGE_KEY = 'dc-known-factories'

// ═══ Хелперы для localStorage ═══
function loadKnownFactories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw).filter(a => /^0x[a-fA-F0-9]{40}$/.test(a))
  } catch {
    return []
  }
}

function saveKnownFactories(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(list.map(a => a.toLowerCase()))]))
  } catch {}
}

export default function FactoryAdmin() {
  const { wallet, addNotification } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [txPending, setTxPending] = useState(false)

  const [newFactoryAddr, setNewFactoryAddr] = useState('')
  const [withdrawAddr, setWithdrawAddr] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [recordPoolId, setRecordPoolId] = useState('')
  const [recordItemId, setRecordItemId] = useState('')
  const [recordCost, setRecordCost] = useState('')
  const [checkAddr, setCheckAddr] = useState('')

  const provider = new ethers.JsonRpcProvider(RPC)
  const pools = new ethers.Contract(ADDRESSES.ClubPools, POOLS_ABI, provider)
  const usdt = new ethers.Contract(ADDRESSES.USDT, USDT_ABI, provider)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [
        multisig, owner, reserveBalance, contractBalance, poolsCount
      ] = await Promise.all([
        pools.multisig(),
        pools.owner(),
        pools.getReserveBalance(),
        usdt.balanceOf(ADDRESSES.ClubPools),
        pools.poolsCount(),
      ])

      // ═══ Список заводов: localStorage + попытка прочитать events ═══
      const knownAddresses = new Set(loadKnownFactories())

      // Пробуем прочитать события — но не блокируемся если не получится
      try {
        const currentBlock = await provider.getBlockNumber()
        const fromBlock = Math.max(0, currentBlock - 200000)  // ~2-3 дня на opBNB

        const filter = pools.filters.FactoryAdded()
        const events = await pools.queryFilter(filter, fromBlock, 'latest')
        for (const ev of events) {
          const addr = ev.args.factory.toLowerCase()
          knownAddresses.add(addr)
        }
        console.log('[FactoryAdmin] Loaded', events.length, 'FactoryAdded events from block', fromBlock)
      } catch (e) {
        console.warn('[FactoryAdmin] queryFilter не сработал, используем localStorage:', e?.message)
      }

      // Проверяем актуальный статус каждого + получаем баланс
      const factories = []
      for (const addr of knownAddresses) {
        try {
          const [isApproved, balance] = await Promise.all([
            pools.approvedFactories(addr),
            usdt.balanceOf(addr),
          ])
          if (isApproved) {
            factories.push({
              address: addr,
              balance: ethers.formatEther(balance),
            })
          }
        } catch {}
      }

      // Сохраняем актуальный список в localStorage
      saveKnownFactories(factories.map(f => f.address))

      // История выводов
      let withdrawHistory = []
      try {
        const currentBlock = await provider.getBlockNumber()
        const fromBlock = Math.max(0, currentBlock - 200000)
        const filter = pools.filters.GemPurchaseWithdraw()
        const events = await pools.queryFilter(filter, fromBlock, 'latest')
        withdrawHistory = events
          .map(ev => ({
            recipient: ev.args.recipient,
            amount: ethers.formatEther(ev.args.amount),
            blockNumber: ev.blockNumber,
            txHash: ev.transactionHash,
          }))
          .sort((a, b) => b.blockNumber - a.blockNumber)
          .slice(0, 20)
      } catch {}

      // Список пулов с funded/cycling статусом
      const poolsList = []
      const cnt = Number(poolsCount)
      for (let i = 1; i <= cnt; i++) {
        try {
          const p = await pools.getPool(i)
          if ([1, 3].includes(Number(p.status))) {
            poolsList.push({
              id: Number(p.id),
              name: p.name,
              treasury: ethers.formatEther(p.treasuryUSDT),
              status: Number(p.status),
            })
          }
        } catch {}
      }

      const me = wallet?.toLowerCase() || ''
      setData({
        multisig,
        owner,
        isMultisig: me === multisig.toLowerCase(),
        isOwner: me === owner.toLowerCase(),
        reserveBalance: ethers.formatEther(reserveBalance),
        contractBalance: ethers.formatEther(contractBalance),
        availableForWithdraw: ethers.formatEther(contractBalance - reserveBalance),
        factories,
        withdrawHistory,
        poolsList,
      })
    } catch (e) {
      console.error('FactoryAdmin reload:', e)
    }
    setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  // ═══ Проверить адрес вручную (если не в списке но может быть в whitelist) ═══
  const handleCheckAddress = async () => {
    if (!checkAddr || !ethers.isAddress(checkAddr)) {
      addNotification('❌ Неверный адрес')
      return
    }
    try {
      const [isApproved, balance] = await Promise.all([
        pools.approvedFactories(checkAddr),
        usdt.balanceOf(checkAddr),
      ])
      if (isApproved) {
        addNotification(`✅ Адрес В WHITELIST. Баланс: $${ethers.formatEther(balance)}`)
        // Добавляем в локальный список
        const known = loadKnownFactories()
        known.push(checkAddr.toLowerCase())
        saveKnownFactories(known)
        setCheckAddr('')
        await reload()
      } else {
        addNotification(`❌ Адрес НЕ в whitelist. Используй "+ Добавить завод" если нужно.`)
      }
    } catch (e) {
      addNotification(`❌ ${e?.message || 'Ошибка проверки'}`)
    }
  }

  // ═══ Добавить завод ═══
  const handleAddFactory = async () => {
    if (!newFactoryAddr || !ethers.isAddress(newFactoryAddr)) {
      addNotification('❌ Неверный адрес')
      return
    }
    if (!data?.isMultisig) {
      addNotification('❌ Только multisig может добавлять заводы')
      return
    }

    const isApproved = await pools.approvedFactories(newFactoryAddr).catch(() => false)
    if (isApproved) {
      addNotification('⚠️ Этот адрес уже в whitelist — добавляю в видимый список')
      const known = loadKnownFactories()
      known.push(newFactoryAddr.toLowerCase())
      saveKnownFactories(known)
      setNewFactoryAddr('')
      await reload()
      return
    }

    setTxPending(true)
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      const signer = await browserProvider.getSigner()
      const poolsW = new ethers.Contract(ADDRESSES.ClubPools, POOLS_ABI, signer)

      addNotification('⏳ Подтверди в SafePal...')
      const tx = await poolsW.addFactory(newFactoryAddr)
      addNotification(`📤 TX: ${tx.hash.slice(0, 10)}...`)

      await tx.wait()
      addNotification(`✅ Завод добавлен в whitelist!`)

      const known = loadKnownFactories()
      known.push(newFactoryAddr.toLowerCase())
      saveKnownFactories(known)
      setNewFactoryAddr('')
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }

  // ═══ Отозвать завод ═══
  const handleRevokeFactory = async (addr) => {
    const ok = window.confirm(`Отозвать завод ${shortAddress(addr)}?`)
    if (!ok) return
    if (!data?.isMultisig) { addNotification('❌ Только multisig'); return }

    setTxPending(true)
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      const signer = await browserProvider.getSigner()
      const poolsW = new ethers.Contract(ADDRESSES.ClubPools, POOLS_ABI, signer)
      const tx = await poolsW.revokeFactory(addr)
      await tx.wait()
      addNotification('✅ Завод отозван')
      // Удаляем из локального списка
      const known = loadKnownFactories().filter(a => a !== addr.toLowerCase())
      saveKnownFactories(known)
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }

  // ═══ Вывод USDT ═══
  const handleWithdraw = async () => {
    if (!withdrawAddr || !ethers.isAddress(withdrawAddr)) {
      addNotification('❌ Введи адрес завода')
      return
    }
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) { addNotification('❌ Неверная сумма'); return }
    const available = parseFloat(data?.availableForWithdraw || 0)
    if (amount > available) {
      addNotification(`❌ Доступно только $${available.toFixed(2)}`)
      return
    }
    if (!data?.isOwner) { addNotification('❌ Только owner'); return }

    // Проверяем что адрес в whitelist (контракт всё равно проверит, но дадим понятную ошибку)
    const isApproved = await pools.approvedFactories(withdrawAddr).catch(() => false)
    if (!isApproved) {
      addNotification('❌ Этот адрес НЕ в whitelist. Сначала добавь его.')
      return
    }

    const confirm = window.confirm(
      `Вывести $${amount.toFixed(2)} USDT?\n\n` +
      `Куда: ${shortAddress(withdrawAddr)}\n` +
      `Сумма: $${amount.toFixed(2)} USDT\n\n` +
      `Это on-chain транзакция, не отменяется.`
    )
    if (!confirm) return

    setTxPending(true)
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      const signer = await browserProvider.getSigner()
      const poolsW = new ethers.Contract(ADDRESSES.ClubPools, POOLS_ABI, signer)

      addNotification('⏳ Подтверди в SafePal...')
      const amountWei = ethers.parseEther(String(amount))
      const tx = await poolsW.withdrawForGemPurchase(withdrawAddr, amountWei)
      addNotification(`📤 TX: ${tx.hash.slice(0, 10)}...`)
      await tx.wait()
      addNotification(`✅ Вывод $${amount.toFixed(2)} выполнен!`)

      // Сохраняем адрес в локальный список (на случай если ещё не там)
      const known = loadKnownFactories()
      known.push(withdrawAddr.toLowerCase())
      saveKnownFactories(known)

      setWithdrawAmount('')
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }

  // ═══ Регистрация камня ═══
  const handleRecordGem = async () => {
    const pid = parseInt(recordPoolId)
    const iid = parseInt(recordItemId)
    const cost = parseFloat(recordCost)
    if (!pid || pid < 1) { addNotification('❌ Pool ID'); return }
    if (!iid || iid < 1) { addNotification('❌ Item ID'); return }
    if (!cost || cost <= 0) { addNotification('❌ Cost'); return }

    const confirm = window.confirm(
      `Зарегистрировать камень?\n` +
      `Pool: #${pid}, Item: #${iid}, Cost: $${cost.toFixed(2)}`
    )
    if (!confirm) return

    setTxPending(true)
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      const signer = await browserProvider.getSigner()
      const poolsW = new ethers.Contract(ADDRESSES.ClubPools, POOLS_ABI, signer)
      const costWei = ethers.parseEther(String(cost))
      const tx = await poolsW.recordGemPurchased(pid, iid, costWei)
      await tx.wait()
      addNotification(`✅ Камень зарегистрирован!`)
      setRecordPoolId(''); setRecordItemId(''); setRecordCost('')
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-3xl animate-spin">🏭</div>
        <div className="text-xs text-slate-500 mt-2">Загружаю...</div>
      </div>
    )
  }

  if (!data) return <div className="text-center py-8 text-red-400 text-xs">Ошибка</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-black text-gold-400">🏭 Заводы и закупки</div>
        <button onClick={reload} disabled={txPending}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-300 bg-white/5 border border-white/10 disabled:opacity-50">
          🔄 Обновить
        </button>
      </div>

      {/* ═══ ПРАВА ═══ */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className={`p-2 rounded-lg border ${data.isMultisig ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/15 text-red-400'}`}>
          {data.isMultisig ? '✅' : '❌'} Multisig
        </div>
        <div className={`p-2 rounded-lg border ${data.isOwner ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/15 text-red-400'}`}>
          {data.isOwner ? '✅' : '❌'} Owner
        </div>
      </div>

      {/* ═══ БАЛАНС ═══ */}
      <div className="p-3 rounded-2xl border" style={{ background: 'rgba(212,168,67,0.06)', borderColor: 'rgba(212,168,67,0.2)' }}>
        <div className="text-[11px] font-bold text-gold-400 mb-2">🏦 Баланс ClubPools</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-white/4">
            <div className="text-[9px] text-slate-500">На контракте</div>
            <div className="text-[14px] font-black text-white">${parseFloat(data.contractBalance).toFixed(2)}</div>
          </div>
          <div className="p-2 rounded-lg bg-red-500/8 border border-red-500/15">
            <div className="text-[9px] text-slate-500">Reserve (защищён)</div>
            <div className="text-[14px] font-black text-red-400">${parseFloat(data.reserveBalance).toFixed(2)}</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
            <div className="text-[9px] text-slate-500">Можно вывести</div>
            <div className="text-[14px] font-black text-emerald-400">${parseFloat(data.availableForWithdraw).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* ═══ СПИСОК ЗАВОДОВ ═══ */}
      <div className="p-3 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="text-[11px] font-bold text-white mb-2">✅ Одобренные заводы ({data.factories.length})</div>

        {data.factories.length === 0 ? (
          <div className="text-[10px] text-slate-500 py-2 text-center">
            Список пуст. Если у тебя уже добавлен завод — введи его адрес ниже в «Проверить адрес» для добавления в видимый список.
          </div>
        ) : (
          <div className="space-y-1.5 mb-3">
            {data.factories.map(f => (
              <div key={f.address} className="flex items-center gap-2 p-2 rounded-lg bg-white/4 border border-white/8">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-white truncate">{f.address}</div>
                  <div className="text-[9px] text-slate-500">Получено: ${parseFloat(f.balance).toFixed(2)} USDT</div>
                </div>
                <button onClick={() => setWithdrawAddr(f.address)}
                  className="px-2 py-1 rounded-lg text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                  💸
                </button>
                <a href={`https://opbnb.bscscan.com/address/${f.address}`} target="_blank" rel="noreferrer"
                  className="px-2 py-1 rounded-lg text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20">
                  🔍
                </a>
                {data.isMultisig && (
                  <button onClick={() => handleRevokeFactory(f.address)} disabled={txPending}
                    className="px-2 py-1 rounded-lg text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 disabled:opacity-50">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Проверить адрес — для подгрузки уже одобренных */}
        <div className="mt-3 p-2 rounded-lg bg-blue-500/5 border border-blue-500/15">
          <div className="text-[10px] text-blue-400 mb-1">🔍 Проверить адрес (если уже одобрен — добавится в список)</div>
          <div className="flex gap-2">
            <input value={checkAddr} onChange={e => setCheckAddr(e.target.value)}
              placeholder="0x..." className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white font-mono outline-none" />
            <button onClick={handleCheckAddress} disabled={!checkAddr}
              className="px-3 py-2 rounded-lg text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 disabled:opacity-50">
              🔍
            </button>
          </div>
        </div>

        {/* Добавить новый — multisig */}
        {data.isMultisig && (
          <div className="mt-2">
            <div className="text-[10px] text-slate-400 mb-1">➕ Добавить новый завод (multisig only)</div>
            <div className="flex gap-2">
              <input value={newFactoryAddr} onChange={e => setNewFactoryAddr(e.target.value)}
                placeholder="0x..." className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white font-mono outline-none" />
              <button onClick={handleAddFactory} disabled={txPending || !newFactoryAddr}
                className="px-3 py-2 rounded-lg text-[10px] font-bold gold-btn disabled:opacity-50">
                {txPending ? '⏳' : '➕'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ ВЫВОД USDT — ПОКАЗЫВАЕМ ВСЕГДА ДЛЯ OWNER ═══ */}
      {data.isOwner && (
        <div className="p-3 rounded-2xl border" style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)' }}>
          <div className="text-[11px] font-bold text-emerald-400 mb-2">💸 Вывод USDT на завод</div>

          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Адрес завода</div>
              <input value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)}
                placeholder="0x..." className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white font-mono outline-none" />
              {data.factories.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {data.factories.map(f => (
                    <button key={f.address} onClick={() => setWithdrawAddr(f.address)}
                      className="px-2 py-1 rounded-lg text-[9px] font-bold text-slate-300 bg-white/5 border border-white/10 font-mono">
                      {shortAddress(f.address)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] text-slate-400 mb-1">
                Сумма (USDT) — доступно ${parseFloat(data.availableForWithdraw).toFixed(2)}
              </div>
              <input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                type="number" step="0.01" placeholder="0.00"
                className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[14px] text-white outline-none" />
              <div className="flex gap-1 mt-2 flex-wrap">
                {[1, 10, 50, 100, 500, 1000].filter(v => v <= parseFloat(data.availableForWithdraw)).map(v => (
                  <button key={v} onClick={() => setWithdrawAmount(String(v))} disabled={txPending}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 bg-white/5 border border-white/10 disabled:opacity-50">
                    ${v}
                  </button>
                ))}
                {parseFloat(data.availableForWithdraw) > 0 && (
                  <button onClick={() => setWithdrawAmount(data.availableForWithdraw)} disabled={txPending}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 disabled:opacity-50">
                    Всё (${parseFloat(data.availableForWithdraw).toFixed(2)})
                  </button>
                )}
              </div>
            </div>

            <button onClick={handleWithdraw} disabled={txPending || !withdrawAddr || !withdrawAmount}
              className="w-full py-3 rounded-xl text-[13px] font-black gold-btn disabled:opacity-50">
              {txPending ? '⏳ Транзакция...' : `💸 Вывести $${parseFloat(withdrawAmount || 0).toFixed(2)} USDT`}
            </button>
          </div>
        </div>
      )}

      {/* ═══ РЕГИСТРАЦИЯ КАМНЯ ═══ */}
      {data.isOwner && data.poolsList.length > 0 && (
        <div className="p-3 rounded-2xl border" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)' }}>
          <div className="text-[11px] font-bold text-blue-400 mb-1">📝 Зарегистрировать камень в пуле</div>
          <div className="text-[9px] text-slate-500 mb-2">
            После доставки камня. Списывает с treasury пула, статус → InGem.
          </div>
          <div className="space-y-2">
            <select value={recordPoolId} onChange={e => setRecordPoolId(e.target.value)}
              className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none">
              <option value="">— выбери пул —</option>
              {data.poolsList.map(p => (
                <option key={p.id} value={p.id}>
                  #{p.id} {p.name} • Treasury: ${parseFloat(p.treasury).toFixed(0)}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={recordItemId} onChange={e => setRecordItemId(e.target.value)}
                type="number" placeholder="Item ID"
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white outline-none" />
              <input value={recordCost} onChange={e => setRecordCost(e.target.value)}
                type="number" step="0.01" placeholder="Cost USDT"
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white outline-none" />
            </div>
            <button onClick={handleRecordGem} disabled={txPending || !recordPoolId || !recordItemId || !recordCost}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold bg-blue-500/15 border border-blue-500/25 text-blue-400 disabled:opacity-50">
              {txPending ? '⏳' : '📝 Зарегистрировать'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ ИСТОРИЯ ═══ */}
      <div className="p-3 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="text-[11px] font-bold text-slate-300 mb-2">📜 История выводов ({data.withdrawHistory.length})</div>
        {data.withdrawHistory.length === 0 ? (
          <div className="text-[10px] text-slate-500 py-2 text-center">Выводов ещё не было</div>
        ) : (
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {data.withdrawHistory.map((w, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/3 border border-white/6 text-[10px]">
                <div className="flex-1 min-w-0">
                  <div className="text-emerald-400 font-bold">${parseFloat(w.amount).toFixed(2)}</div>
                  <div className="text-slate-500 font-mono truncate">→ {shortAddress(w.recipient)}</div>
                </div>
                <a href={`https://opbnb.bscscan.com/tx/${w.txHash}`} target="_blank" rel="noreferrer"
                  className="px-2 py-1 rounded-lg text-blue-400 bg-blue-500/10 border border-blue-500/20 ml-2">
                  TX
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

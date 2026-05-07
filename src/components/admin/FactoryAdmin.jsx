'use client'
/**
 * FactoryAdmin.jsx — Управление заводами и выводы USDT (v2.4)
 *
 * Позволяет:
 *  • Добавлять новые заводы в whitelist (multisig only)
 *  • Видеть список одобренных заводов с их балансами
 *  • Выводить USDT на завод (owner only) — withdrawForGemPurchase
 *  • Видеть историю выводов
 *  • Регистрировать камень в пуле после off-chain доставки (recordGemPurchased)
 *
 * Защиты соблюдаются автоматически контрактом:
 *  - Только multisig может addFactory
 *  - Только owner может withdrawForGemPurchase
 *  - Reserve fund не трогается
 *  - to должен быть в whitelist
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

export default function FactoryAdmin() {
  const { wallet, addNotification } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [txPending, setTxPending] = useState(false)

  // Формы
  const [newFactoryAddr, setNewFactoryAddr] = useState('')
  const [withdrawAddr, setWithdrawAddr] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [recordPoolId, setRecordPoolId] = useState('')
  const [recordItemId, setRecordItemId] = useState('')
  const [recordCost, setRecordCost] = useState('')

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

      // Получаем все события FactoryAdded
      const factoryAddedFilter = pools.filters.FactoryAdded()
      const factoryRevokedFilter = pools.filters.FactoryRevoked()
      const withdrawFilter = pools.filters.GemPurchaseWithdraw()

      const [addedEvents, revokedEvents, withdrawEvents] = await Promise.all([
        pools.queryFilter(factoryAddedFilter, -100000).catch(() => []),
        pools.queryFilter(factoryRevokedFilter, -100000).catch(() => []),
        pools.queryFilter(withdrawFilter, -100000).catch(() => []),
      ])

      // Собираем адреса заводов: добавлены минус отозваны + проверка через approvedFactories
      const factoryAddresses = new Set()
      for (const ev of addedEvents) {
        factoryAddresses.add(ev.args.factory.toLowerCase())
      }
      for (const ev of revokedEvents) {
        factoryAddresses.delete(ev.args.factory.toLowerCase())
      }

      // Проверяем актуальный статус каждого завода + получаем его баланс USDT
      const factories = []
      for (const addr of factoryAddresses) {
        const [isApproved, balance] = await Promise.all([
          pools.approvedFactories(addr).catch(() => false),
          usdt.balanceOf(addr).catch(() => 0n),
        ])
        if (isApproved) {
          factories.push({
            address: addr,
            balance: ethers.formatEther(balance),
          })
        }
      }

      // История выводов — последние 20
      const withdrawHistory = withdrawEvents
        .map(ev => ({
          recipient: ev.args.recipient,
          amount: ethers.formatEther(ev.args.amount),
          blockNumber: ev.blockNumber,
          txHash: ev.transactionHash,
        }))
        .sort((a, b) => b.blockNumber - a.blockNumber)
        .slice(0, 20)

      // Список пулов с funded/cycling статусом (для recordGemPurchased)
      const poolsList = []
      const cnt = Number(poolsCount)
      for (let i = 1; i <= cnt; i++) {
        try {
          const p = await pools.getPool(i)
          if ([1, 3].includes(Number(p.status))) {  // Funded или Cycling
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

  // ═══ Добавить завод ═══
  const handleAddFactory = async () => {
    if (!newFactoryAddr || !ethers.isAddress(newFactoryAddr)) {
      addNotification('❌ Неверный адрес завода')
      return
    }
    if (!data?.isMultisig) {
      addNotification('❌ Только multisig может добавлять заводы')
      return
    }

    // Проверка что не уже добавлен
    const isApproved = await pools.approvedFactories(newFactoryAddr).catch(() => false)
    if (isApproved) {
      addNotification('⚠️ Этот адрес уже в whitelist')
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
      setNewFactoryAddr('')
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }

  // ═══ Отозвать завод ═══
  const handleRevokeFactory = async (addr) => {
    const ok = window.confirm(`Отозвать завод ${shortAddress(addr)} из whitelist?\n\nПосле этого нельзя будет выводить USDT на этот адрес.`)
    if (!ok) return
    if (!data?.isMultisig) {
      addNotification('❌ Только multisig может отзывать заводы')
      return
    }

    setTxPending(true)
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      const signer = await browserProvider.getSigner()
      const poolsW = new ethers.Contract(ADDRESSES.ClubPools, POOLS_ABI, signer)

      addNotification('⏳ Подтверди в SafePal...')
      const tx = await poolsW.revokeFactory(addr)
      await tx.wait()
      addNotification('✅ Завод отозван')
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }

  // ═══ Вывод USDT ═══
  const handleWithdraw = async () => {
    if (!withdrawAddr || !ethers.isAddress(withdrawAddr)) {
      addNotification('❌ Выбери завод')
      return
    }
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) {
      addNotification('❌ Неверная сумма')
      return
    }
    const available = parseFloat(data?.availableForWithdraw || 0)
    if (amount > available) {
      addNotification(`❌ Доступно только $${available.toFixed(2)}`)
      return
    }
    if (!data?.isOwner) {
      addNotification('❌ Только owner может выводить')
      return
    }

    const confirm = window.confirm(
      `Вывести $${amount.toFixed(2)} USDT?\n\n` +
      `Куда: ${shortAddress(withdrawAddr)}\n` +
      `Сумма: $${amount.toFixed(2)} USDT\n\n` +
      `Это действие подтверждается на блокчейне и не отменяется.`
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
      setWithdrawAmount('')
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }

  // ═══ Зарегистрировать камень ═══
  const handleRecordGem = async () => {
    const pid = parseInt(recordPoolId)
    const iid = parseInt(recordItemId)
    const cost = parseFloat(recordCost)
    if (!pid || pid < 1) { addNotification('❌ Pool ID'); return }
    if (!iid || iid < 1) { addNotification('❌ Item ID'); return }
    if (!cost || cost <= 0) { addNotification('❌ Cost'); return }

    const confirm = window.confirm(
      `Зарегистрировать камень в пуле?\n\n` +
      `Pool: #${pid}\n` +
      `Item: #${iid}\n` +
      `Списать с treasury: $${cost.toFixed(2)} USDT\n\n` +
      `Статус пула изменится на InGem.`
    )
    if (!confirm) return

    setTxPending(true)
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum)
      const signer = await browserProvider.getSigner()
      const poolsW = new ethers.Contract(ADDRESSES.ClubPools, POOLS_ABI, signer)

      addNotification('⏳ Подтверди в SafePal...')
      const costWei = ethers.parseEther(String(cost))
      const tx = await poolsW.recordGemPurchased(pid, iid, costWei)
      await tx.wait()
      addNotification(`✅ Камень зарегистрирован в пуле #${pid}!`)
      setRecordPoolId('')
      setRecordItemId('')
      setRecordCost('')
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
        <div className="text-xs text-slate-500 mt-2">Загружаю данные с блокчейна...</div>
      </div>
    )
  }

  if (!data) return <div className="text-center py-8 text-red-400 text-xs">Ошибка загрузки</div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-black text-gold-400">🏭 Заводы и закупки</div>
        <button onClick={reload} disabled={txPending}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-300 bg-white/5 border border-white/10 disabled:opacity-50">
          🔄 Обновить
        </button>
      </div>

      {/* ═══ ТВОИ ПРАВА ═══ */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className={`p-2 rounded-lg border ${data.isMultisig ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/15 text-red-400'}`}>
          {data.isMultisig ? '✅' : '❌'} Multisig (можно добавлять заводы)
        </div>
        <div className={`p-2 rounded-lg border ${data.isOwner ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/15 text-red-400'}`}>
          {data.isOwner ? '✅' : '❌'} Owner (можно выводить и регистрировать)
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

      {/* ═══ ОДОБРЕННЫЕ ЗАВОДЫ ═══ */}
      <div className="p-3 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="text-[11px] font-bold text-white mb-2">✅ Одобренные заводы ({data.factories.length})</div>

        {data.factories.length === 0 ? (
          <div className="text-[10px] text-slate-500 py-2 text-center">Заводов пока нет</div>
        ) : (
          <div className="space-y-1.5 mb-3">
            {data.factories.map(f => (
              <div key={f.address} className="flex items-center gap-2 p-2 rounded-lg bg-white/4 border border-white/8">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-white truncate">{f.address}</div>
                  <div className="text-[9px] text-slate-500">Получено всего: ${parseFloat(f.balance).toFixed(2)} USDT</div>
                </div>
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

        {/* Добавить новый */}
        {data.isMultisig && (
          <>
            <div className="text-[10px] text-slate-400 mb-1">➕ Добавить завод (multisig only)</div>
            <div className="flex gap-2">
              <input value={newFactoryAddr} onChange={e => setNewFactoryAddr(e.target.value)}
                placeholder="0x..." className="flex-1 p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white font-mono outline-none" />
              <button onClick={handleAddFactory} disabled={txPending || !newFactoryAddr}
                className="px-3 py-2 rounded-lg text-[10px] font-bold gold-btn disabled:opacity-50">
                {txPending ? '⏳' : '➕'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ═══ ВЫВОД USDT ═══ */}
      {data.isOwner && data.factories.length > 0 && (
        <div className="p-3 rounded-2xl border" style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)' }}>
          <div className="text-[11px] font-bold text-emerald-400 mb-2">💸 Вывод USDT на завод</div>

          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Завод</div>
              <select value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)}
                className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none">
                <option value="">— выбери завод —</option>
                {data.factories.map(f => (
                  <option key={f.address} value={f.address}>{shortAddress(f.address)}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 mb-1">
                Сумма (USDT) — доступно ${parseFloat(data.availableForWithdraw).toFixed(2)}
              </div>
              <input value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                type="number" step="0.01" placeholder="0.00"
                className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[14px] text-white outline-none" />
              <div className="flex gap-1 mt-2 flex-wrap">
                {[10, 50, 100, 500, 1000].filter(v => v <= parseFloat(data.availableForWithdraw)).map(v => (
                  <button key={v} onClick={() => setWithdrawAmount(String(v))} disabled={txPending}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 bg-white/5 border border-white/10 disabled:opacity-50">
                    ${v}
                  </button>
                ))}
                <button onClick={() => setWithdrawAmount(data.availableForWithdraw)} disabled={txPending}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 disabled:opacity-50">
                  Всё (${parseFloat(data.availableForWithdraw).toFixed(2)})
                </button>
              </div>
            </div>

            <button onClick={handleWithdraw} disabled={txPending || !withdrawAddr || !withdrawAmount}
              className="w-full py-2.5 rounded-xl text-[12px] font-black gold-btn disabled:opacity-50">
              {txPending ? '⏳ Транзакция...' : `💸 Вывести $${parseFloat(withdrawAmount || 0).toFixed(2)} USDT`}
            </button>
          </div>
        </div>
      )}

      {/* ═══ РЕГИСТРАЦИЯ КАМНЯ В ПУЛЕ ═══ */}
      {data.isOwner && data.poolsList.length > 0 && (
        <div className="p-3 rounded-2xl border" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)' }}>
          <div className="text-[11px] font-bold text-blue-400 mb-1">📝 Зарегистрировать камень в пуле</div>
          <div className="text-[9px] text-slate-500 mb-2">
            После доставки камня. Списывает с treasury пула, статус → InGem.
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-slate-400 mb-1">Пул (Funded или Cycling)</div>
              <select value={recordPoolId} onChange={e => setRecordPoolId(e.target.value)}
                className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none">
                <option value="">— выбери пул —</option>
                {data.poolsList.map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.id} {p.name} • Treasury: ${parseFloat(p.treasury).toFixed(0)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] text-slate-400 mb-1">Item ID (из ClubMarket)</div>
                <input value={recordItemId} onChange={e => setRecordItemId(e.target.value)}
                  type="number" placeholder="123"
                  className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white outline-none" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 mb-1">Cost (USDT)</div>
                <input value={recordCost} onChange={e => setRecordCost(e.target.value)}
                  type="number" step="0.01" placeholder="5600"
                  className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white outline-none" />
              </div>
            </div>

            <button onClick={handleRecordGem} disabled={txPending || !recordPoolId || !recordItemId || !recordCost}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold bg-blue-500/15 border border-blue-500/25 text-blue-400 disabled:opacity-50">
              {txPending ? '⏳ Транзакция...' : '📝 Зарегистрировать камень'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ ИСТОРИЯ ВЫВОДОВ ═══ */}
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

      {/* ═══ ПОДСКАЗКА ═══ */}
      <div className="p-3 rounded-2xl bg-yellow-500/5 border border-yellow-500/15">
        <div className="text-[11px] font-bold text-yellow-400 mb-1">💡 Workflow закупки камня</div>
        <div className="text-[10px] text-slate-300 space-y-1">
          <div>1️⃣ Добавить завод в whitelist (один раз)</div>
          <div>2️⃣ Вывести USDT на завод (любую сумму, до доступной)</div>
          <div>3️⃣ Off-chain: завод доставляет камень</div>
          <div>4️⃣ Создать item в ClubMarket (отдельный шаг)</div>
          <div>5️⃣ Зарегистрировать камень в пуле (recordGemPurchased)</div>
        </div>
      </div>
    </div>
  )
}

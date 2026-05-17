'use client'
/**
 * SalesAdmin.jsx — Управление продажами камней (v2.6 двухфазная)
 * 
 * Логика v2.6:
 *   Фаза А — recordSaleAccounting(poolId, saleAmount, costPart)
 *            Фиксирует продажу БЕЗ движения денег. Дедлайн 14 дней.
 *   Фаза Б — payObligations(saleId)
 *            Заводит только obligationsTotal (~25% от прибыли)
 *            = маркетинг 15% + реклама 5% + резерв 5% от прибыли
 *            Остальные 75% backing остаются у owner (виртуально)
 * 
 * При просрочке >14 дней — любой может вызвать seizeFromGuarantor
 * (тогда долги забираются с гарантского кошелька, если есть USDT и approve).
 */
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import useGameStore from '@/lib/store'
import * as Club from '@/lib/clubV23'
import ADDRESSES from '@/contracts/addresses'

const RPC = 'https://opbnb-mainnet-rpc.bnbchain.org'

// Форматирование даты-времени
function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts * 1000)
  return d.toLocaleString('ru-RU', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// Сколько осталось до дедлайна (в днях/часах)
function timeUntilDeadline(deadline) {
  const now = Math.floor(Date.now() / 1000)
  const diff = deadline - now
  if (diff <= 0) {
    const overdueSec = -diff
    const overdueDays = Math.floor(overdueSec / 86400)
    if (overdueDays > 0) return { overdue: true, text: `Просрочка ${overdueDays}д` }
    const overdueHours = Math.floor(overdueSec / 3600)
    return { overdue: true, text: `Просрочка ${overdueHours}ч` }
  }
  const days = Math.floor(diff / 86400)
  if (days > 0) return { overdue: false, text: `${days}д осталось` }
  const hours = Math.floor(diff / 3600)
  return { overdue: false, text: `${hours}ч осталось` }
}

export default function SalesAdmin() {
  const { wallet, addNotification } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [txPending, setTxPending] = useState(false)
  
  // Форма "Записать продажу"
  const [salePoolId, setSalePoolId] = useState('')
  const [saleAmount, setSaleAmount] = useState('')
  const [saleCostPart, setSaleCostPart] = useState('')
  
  // ═══ Загрузка данных ═══
  const reload = useCallback(async () => {
    if (!wallet) { setLoading(false); return }
    setLoading(true)
    
    try {
      // Параллельно: продажи, пулы, гарант, баланс гаранта
      const [sales, pools, guarantorAddr, paymentDeadline] = await Promise.all([
        Club.getAllSales(),
        Club.getAllPools(),
        Club.getGuarantor(),
        Club.getPaymentDeadline(),
      ])
      
      // Баланс USDT гаранта (и allowance)
      let guarantorBalance = '0'
      let guarantorAllowance = '0'
      if (guarantorAddr && guarantorAddr !== ethers.ZeroAddress) {
        try {
          const provider = new ethers.JsonRpcProvider(RPC)
          const usdt = new ethers.Contract(
            ADDRESSES.USDT,
            [
              'function balanceOf(address) view returns (uint256)',
              'function allowance(address, address) view returns (uint256)',
            ],
            provider
          )
          const [bal, allow] = await Promise.all([
            usdt.balanceOf(guarantorAddr),
            usdt.allowance(guarantorAddr, ADDRESSES.ClubPools),
          ])
          guarantorBalance = ethers.formatEther(bal)
          guarantorAllowance = ethers.formatEther(allow)
        } catch {}
      }
      
      // Проверка owner
      let isOwner = false
      try {
        const provider = new ethers.JsonRpcProvider(RPC)
        const pools = new ethers.Contract(
          ADDRESSES.ClubPools,
          ['function owner() view returns (address)'],
          provider
        )
        const owner = await pools.owner()
        isOwner = owner.toLowerCase() === wallet.toLowerCase()
      } catch {}
      
      // Группируем продажи: непогашенные / погашенные / просроченные
      const now = Math.floor(Date.now() / 1000)
      const unpaid = sales.filter(s => !s.paid)
      const overdue = unpaid.filter(s => now > s.deadline)
      const paid = sales.filter(s => s.paid)
      
      setData({
        sales,
        unpaid,
        overdue,
        paid,
        pools: pools.filter(p => p.status === 'InGem' || p.costBasis > 0),
        allPools: pools,
        guarantorAddr,
        guarantorBalance,
        guarantorAllowance,
        paymentDeadlineDays: Math.floor(paymentDeadline / 86400),
        isOwner,
      })
    } catch (e) {
      console.error('Ошибка загрузки:', e)
      addNotification(`❌ Ошибка: ${e?.message || 'Не удалось загрузить'}`)
    }
    setLoading(false)
  }, [wallet, addNotification])
  
  useEffect(() => { reload() }, [reload])
  
  // ═══ Записать продажу (Фаза А) ═══
  const handleRecordSale = async () => {
    const pid = parseInt(salePoolId)
    const amount = parseFloat(saleAmount)
    const cost = parseFloat(saleCostPart)
    
    if (!pid || pid < 1) { addNotification('❌ Выбери пул'); return }
    if (!amount || amount <= 0) { addNotification('❌ Сумма продажи > 0'); return }
    if (!cost || cost <= 0) { addNotification('❌ Закупка > 0'); return }
    if (cost >= amount) { addNotification('❌ Запрещено продавать в убыток'); return }
    
    const profit = amount - cost
    const obligations = profit * 0.25  // ~25% от прибыли (15% маркетинг + 5% реклама + 5% резерв)
    
    const confirm = window.confirm(
      `Записать продажу?\n\n` +
      `Пул: #${pid}\n` +
      `Продажа: $${amount.toFixed(2)}\n` +
      `Закупка: $${cost.toFixed(2)}\n` +
      `Прибыль: $${profit.toFixed(2)}\n\n` +
      `Обязательства (для оплаты в течение ${data.paymentDeadlineDays} дней):\n` +
      `~$${obligations.toFixed(2)} (25% от прибыли)\n\n` +
      `ВАЖНО: контракт НЕ заберёт деньги сейчас.\n` +
      `Ты должен сам потом завести ${data.paymentDeadlineDays}-дневным таймером.`
    )
    if (!confirm) return
    
    setTxPending(true)
    try {
      await Club.recordSaleAccounting(pid, amount, cost)
      addNotification(`✅ Продажа записана! Не забудь оплатить в течение ${data.paymentDeadlineDays} дней.`)
      setSalePoolId(''); setSaleAmount(''); setSaleCostPart('')
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }
  
  // ═══ Оплатить обязательства (Фаза Б) ═══
  const handlePayObligations = async (sale) => {
    const confirm = window.confirm(
      `Оплатить обязательства?\n\n` +
      `SaleId: #${sale.saleId}\n` +
      `Пул: #${sale.poolId}\n` +
      `Заводишь: $${parseFloat(sale.obligationsTotal).toFixed(2)} USDT\n\n` +
      `Распределение:\n` +
      `• Маркетинг партнёрам: $${parseFloat(sale.marketingPart).toFixed(2)}\n` +
      `• Реклама: $${parseFloat(sale.adsPart).toFixed(2)}\n` +
      `• Резерв: $${parseFloat(sale.reservePart).toFixed(2)}\n\n` +
      `Backing $${parseFloat(sale.backingPart).toFixed(2)} остаётся у тебя (виртуально учтён в treasury).`
    )
    if (!confirm) return
    
    setTxPending(true)
    try {
      await Club.payObligations(sale.saleId)
      addNotification(`✅ Обязательства оплачены!`)
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }
  
  // ═══ Взыскать с гаранта ═══
  const handleSeize = async (sale) => {
    const confirm = window.confirm(
      `Взыскать обязательства с гаранта?\n\n` +
      `SaleId: #${sale.saleId}\n` +
      `Сумма: $${parseFloat(sale.obligationsTotal).toFixed(2)} USDT\n` +
      `С кошелька: ${data.guarantorAddr}\n\n` +
      `Внимание: на кошельке гаранта должно быть достаточно USDT\n` +
      `и approve для ClubPools >= ${parseFloat(sale.obligationsTotal).toFixed(2)} USDT.`
    )
    if (!confirm) return
    
    setTxPending(true)
    try {
      await Club.seizeFromGuarantor(sale.saleId)
      addNotification(`✅ Взыскано с гаранта!`)
      await reload()
    } catch (e) {
      addNotification(`❌ ${e?.shortMessage || e?.reason || e?.message || 'Ошибка'}`)
    }
    setTxPending(false)
  }
  
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-3xl animate-spin">💎</div>
        <div className="text-xs text-slate-500 mt-2">Загружаю продажи...</div>
      </div>
    )
  }
  
  if (!data) return <div className="text-center py-8 text-red-400 text-xs">Ошибка</div>
  
  if (!data.isOwner) {
    return (
      <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
        <div className="text-red-400 font-bold text-[12px]">🔒 Доступ только для owner</div>
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-black text-white">💎 Продажи камней</h2>
        <button onClick={reload}
          className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300">
          🔄 Обновить
        </button>
      </div>
      
      {/* ═══ СТАТИСТИКА ═══ */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-center">
          <div className="text-[9px] text-yellow-300 mb-0.5">Ждут оплаты</div>
          <div className="text-[16px] font-black text-yellow-400">{data.unpaid.length}</div>
        </div>
        <div className="p-2 rounded-xl bg-red-500/5 border border-red-500/20 text-center">
          <div className="text-[9px] text-red-300 mb-0.5">Просрочки</div>
          <div className="text-[16px] font-black text-red-400">{data.overdue.length}</div>
        </div>
        <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
          <div className="text-[9px] text-emerald-300 mb-0.5">Оплачено</div>
          <div className="text-[16px] font-black text-emerald-400">{data.paid.length}</div>
        </div>
      </div>
      
      {/* ═══ ГАРАНТ ═══ */}
      {data.guarantorAddr && data.guarantorAddr !== ethers.ZeroAddress && (
        <div className="p-3 rounded-2xl border bg-purple-500/5 border-purple-500/20">
          <div className="text-[11px] font-bold text-purple-300 mb-1">🛡️ Гарант</div>
          <div className="text-[10px] text-slate-400 font-mono break-all mb-2">
            {data.guarantorAddr}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <div className="text-slate-500">USDT баланс</div>
              <div className="font-bold text-white">${parseFloat(data.guarantorBalance).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-500">Allowance для Pools</div>
              <div className="font-bold text-white">${parseFloat(data.guarantorAllowance).toFixed(2)}</div>
            </div>
          </div>
          {parseFloat(data.guarantorAllowance) === 0 && (
            <div className="mt-2 text-[9px] text-yellow-400">
              ⚠️ Гарант не сделал approve. Без approve seizeFromGuarantor не сработает.
            </div>
          )}
        </div>
      )}
      
      {/* ═══ ФОРМА: ЗАПИСАТЬ ПРОДАЖУ (ФАЗА А) ═══ */}
      <div className="p-3 rounded-2xl border bg-blue-500/5 border-blue-500/20">
        <div className="text-[11px] font-bold text-blue-400 mb-1">📝 Записать продажу (Фаза А)</div>
        <div className="text-[9px] text-slate-500 mb-2">
          Зафиксировать продажу БЕЗ движения денег. После этого {data.paymentDeadlineDays} дней
          на оплату обязательств (Фаза Б).
        </div>
        <div className="space-y-2">
          <select value={salePoolId} onChange={e => setSalePoolId(e.target.value)}
            className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none">
            <option value="">— выбери пул с камнем —</option>
            {data.pools.map(p => (
              <option key={p.poolId} value={p.poolId}>
                #{p.poolId} {p.name} • costBasis: ${parseFloat(p.costBasis || 0).toFixed(0)}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input value={saleAmount} onChange={e => setSaleAmount(e.target.value)}
              type="number" step="0.01" placeholder="Сумма продажи $"
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white outline-none" />
            <input value={saleCostPart} onChange={e => setSaleCostPart(e.target.value)}
              type="number" step="0.01" placeholder="Закупка камня $"
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white outline-none" />
          </div>
          {salePoolId && saleAmount && saleCostPart && parseFloat(saleAmount) > parseFloat(saleCostPart) && (
            <div className="text-[10px] text-slate-400 p-2 rounded-lg bg-white/5">
              Прибыль: ${(parseFloat(saleAmount) - parseFloat(saleCostPart)).toFixed(2)}
              <br/>Обязательства (25%): ${((parseFloat(saleAmount) - parseFloat(saleCostPart)) * 0.25).toFixed(2)}
              <br/>Останется у тебя: ${(parseFloat(saleAmount) - (parseFloat(saleAmount) - parseFloat(saleCostPart)) * 0.25).toFixed(2)}
            </div>
          )}
          <button onClick={handleRecordSale} 
            disabled={txPending || !salePoolId || !saleAmount || !saleCostPart}
            className="w-full py-2.5 rounded-xl text-[12px] font-bold bg-blue-500/15 border border-blue-500/25 text-blue-400 disabled:opacity-50">
            {txPending ? '⏳' : '📝 Записать продажу'}
          </button>
        </div>
      </div>
      
      {/* ═══ НЕПОГАШЕННЫЕ ПРОДАЖИ ═══ */}
      {data.unpaid.length > 0 && (
        <div className="p-3 rounded-2xl border bg-yellow-500/5 border-yellow-500/20">
          <div className="text-[11px] font-bold text-yellow-400 mb-2">
            ⏳ Ждут оплаты ({data.unpaid.length})
          </div>
          <div className="space-y-2">
            {data.unpaid.map(sale => {
              const dl = timeUntilDeadline(sale.deadline)
              return (
                <div key={sale.saleId} 
                  className={`p-2 rounded-xl border ${dl.overdue ? 'bg-red-500/10 border-red-500/30' : 'bg-white/3 border-white/6'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] font-bold text-white">
                      Sale #{sale.saleId} • Pool #{sale.poolId}
                    </div>
                    <div className={`text-[9px] font-bold ${dl.overdue ? 'text-red-400' : 'text-yellow-400'}`}>
                      {dl.text}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
                    <div>
                      <div className="text-slate-500">Продажа</div>
                      <div className="text-white">${parseFloat(sale.saleAmount).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Прибыль</div>
                      <div className="text-emerald-400">${parseFloat(sale.profit).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">К оплате</div>
                      <div className="text-yellow-400 font-bold">${parseFloat(sale.obligationsTotal).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Дедлайн</div>
                      <div className="text-slate-300">{formatTime(sale.deadline)}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handlePayObligations(sale)} disabled={txPending}
                      className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 disabled:opacity-50">
                      💰 Оплатить
                    </button>
                    {dl.overdue && data.guarantorAddr && data.guarantorAddr !== ethers.ZeroAddress && (
                      <button onClick={() => handleSeize(sale)} disabled={txPending}
                        className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-purple-500/15 border border-purple-500/25 text-purple-400 disabled:opacity-50">
                        🛡️ С гаранта
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* ═══ ОПЛАЧЕННЫЕ ПРОДАЖИ ═══ */}
      {data.paid.length > 0 && (
        <details className="p-3 rounded-2xl border bg-white/3 border-white/6">
          <summary className="cursor-pointer text-[11px] font-bold text-slate-300">
            ✅ История ({data.paid.length})
          </summary>
          <div className="space-y-1 mt-2 max-h-[300px] overflow-y-auto">
            {data.paid.map(sale => (
              <div key={sale.saleId} className="p-2 rounded-lg bg-white/3 text-[10px]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-white font-bold">Sale #{sale.saleId} • Pool #{sale.poolId}</span>
                  <span className="text-emerald-400">✅ {formatTime(sale.paidAt)}</span>
                </div>
                <div className="text-slate-400">
                  Продажа ${parseFloat(sale.saleAmount).toFixed(2)} •
                  Прибыль ${parseFloat(sale.profit).toFixed(2)} •
                  Оплачено ${parseFloat(sale.obligationsTotal).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      
      {/* Если продаж нет — пустое состояние */}
      {data.sales.length === 0 && (
        <div className="p-6 text-center text-slate-500 text-[11px]">
          📭 Пока продаж нет.
          <br/>Когда продашь камень — запиши через форму выше.
        </div>
      )}
    </div>
  )
}

'use client'
/**
 * GoldReserveSection — раздел "Золотой пул" (резервный фонд) в Сейфе.
 *
 * Партнёрская часть (видят все):
 *   - вложить USDT (1 USDT = 1 доля)
 *   - мои доли + накопленная прибыль + забрать
 *   - запросить выход (после 6 мес)
 *
 * Админская часть (только owner по isAdmin):
 *   - взять заём (withdrawToClub)
 *   - вернуть в заём (repayLoan)
 *   - раздать прибыль (distributeProfit)
 *   - обработать очередь выходов
 *   - список займов
 *
 * Вставляется в VaultTab.jsx
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import * as Gold from '@/lib/goldReserve'

export default function GoldReserveSection() {
  const { wallet, isAdmin } = useGameStore()

  const [fund, setFund] = useState(null)
  const [me, setMe] = useState(null)
  const [usdtBal, setUsdtBal] = useState('0')
  const [loans, setLoans] = useState([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'ok'|'err', text }

  // формы
  const [depositAmt, setDepositAmt] = useState('')
  const [loanTo, setLoanTo] = useState('')
  const [loanAmt, setLoanAmt] = useState('')
  const [loanPurpose, setLoanPurpose] = useState('')
  const [repayId, setRepayId] = useState('')
  const [repayAmt, setRepayAmt] = useState('')
  const [profitAmt, setProfitAmt] = useState('')

  const flash = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 6000)
  }

  const load = useCallback(async () => {
    if (!wallet) return
    const [f, m, b] = await Promise.all([
      Gold.getFundInfo().catch(() => null),
      Gold.getStaker(wallet).catch(() => null),
      Gold.getUSDTBalance(wallet).catch(() => '0'),
    ])
    setFund(f)
    setMe(m)
    setUsdtBal(b)
    if (isAdmin && f && f.loansCount > 0) {
      const ls = await Gold.getLoans(f.loansCount).catch(() => [])
      setLoans(ls)
    }
  }, [wallet, isAdmin])

  useEffect(() => { load() }, [load])

  // ─── обёртка действий ───
  const run = async (fn, okText) => {
    setBusy(true); setMsg(null)
    try {
      const r = await fn()
      if (r?.ok) { flash('ok', okText); await load() }
      else flash('err', r?.error || 'Ошибка')
    } catch (e) { flash('err', e?.message?.slice(0, 120) || 'Ошибка') }
    finally { setBusy(false) }
  }

  // ─── партнёрские действия ───
  const handleDeposit = () => {
    if (!depositAmt || parseFloat(depositAmt) < 1) return flash('err', 'Минимум $1')
    run(() => Gold.deposit(depositAmt), `Вложено $${depositAmt}`).then(() => setDepositAmt(''))
  }
  const handleClaim = () => run(() => Gold.claimReward(), 'Награда забрана')
  const handleExit = () => run(() => Gold.requestExit(), 'Запрос на выход отправлен')

  // ─── админские действия ───
  const handleWithdraw = () => {
    if (!loanTo || !loanAmt) return flash('err', 'Заполни адрес и сумму')
    run(() => Gold.withdrawToClub(loanTo, loanAmt, loanPurpose), `Заём создан: $${loanAmt}`)
      .then(() => { setLoanTo(''); setLoanAmt(''); setLoanPurpose('') })
  }
  const handleRepay = () => {
    if (repayId === '' || !repayAmt) return flash('err', 'Заполни номер займа и сумму')
    run(() => Gold.repayLoan(parseInt(repayId), repayAmt), `Возврат в заём #${repayId}: $${repayAmt}`)
      .then(() => { setRepayId(''); setRepayAmt('') })
  }
  const handleDistribute = () => {
    if (!profitAmt) return flash('err', 'Введи сумму прибыли')
    run(() => Gold.distributeProfit(profitAmt), `Прибыль роздана: $${profitAmt}`).then(() => setProfitAmt(''))
  }
  const handleQueue = () => run(() => Gold.processExitQueue(10), 'Очередь обработана')

  const unlockDate = me?.unlockTime ? new Date(me.unlockTime * 1000).toLocaleDateString('ru-RU') : '—'

  const card = { background: 'var(--bg-card)', borderColor: 'rgba(255,215,0,0.15)' }
  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm bg-black/40 border border-gold-400/20 text-white outline-none focus:border-gold-400/50'

  return (
    <div className="space-y-3">
      {/* Заголовок раздела */}
      <div className="p-4 rounded-2xl border" style={card}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[13px] font-black text-gold-400">💰 Золотой пул</div>
          {fund && (
            <div className="text-[10px] text-slate-400">
              касса <span className="text-emerald-400 font-bold">${parseFloat(fund.fundBalance).toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="text-[10px] text-slate-400 leading-relaxed">
          Резервный фонд клуба. Вкладываешь USDT — получаешь долю и прибыль с оборота.
          1 USDT = 1 доля. Выход возможен через 6 месяцев.
        </div>
      </div>

      {/* Сообщение */}
      {msg && (
        <div className={`mx-0 p-2.5 rounded-lg text-[11px] font-bold text-center ${
          msg.type === 'ok' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Мои доли */}
      {me && (
        <div className="p-4 rounded-2xl border" style={card}>
          <div className="text-[12px] font-bold text-gold-400 mb-3">Моя доля</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="text-center p-2 rounded-lg bg-black/20">
              <div className="text-xl font-black text-white">{parseFloat(me.shares).toFixed(2)}</div>
              <div className="text-[9px] text-slate-500">долей (= ${parseFloat(me.shares).toFixed(2)})</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-black/20">
              <div className="text-xl font-black text-emerald-400">${parseFloat(me.claimable).toFixed(2)}</div>
              <div className="text-[9px] text-slate-500">прибыль</div>
            </div>
          </div>

          {parseFloat(me.claimable) > 0 && (
            <button onClick={handleClaim} disabled={busy}
              className="w-full py-2.5 rounded-lg text-sm font-bold bg-emerald-500/20 text-emerald-400 disabled:opacity-50 mb-2">
              💵 Забрать прибыль ${parseFloat(me.claimable).toFixed(2)}
            </button>
          )}

          {parseFloat(me.shares) > 0 && !me.exitRequested && (
            <button onClick={handleExit} disabled={busy || !me.canExitNow}
              className="w-full py-2 rounded-lg text-[12px] font-bold bg-white/5 text-slate-300 disabled:opacity-40">
              {me.canExitNow ? '🚪 Запросить выход' : `🔒 Выход доступен с ${unlockDate}`}
            </button>
          )}
          {me.exitRequested && (
            <div className="text-center text-[11px] text-amber-400 font-bold py-1">
              ⏳ Вы в очереди на выход
            </div>
          )}
        </div>
      )}

      {/* Вложить */}
      {wallet && (!me || !me.exitRequested) && (
        <div className="p-4 rounded-2xl border" style={card}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-bold text-gold-400">Вложить в фонд</div>
            <div className="text-[10px] text-slate-500">баланс: ${parseFloat(usdtBal).toFixed(2)}</div>
          </div>
          <input type="number" min="1" step="1" placeholder="сумма USDT (минимум $1)"
            value={depositAmt} onChange={e => setDepositAmt(e.target.value)} className={inputCls} />
          <button onClick={handleDeposit} disabled={busy}
            className="w-full mt-2 py-2.5 rounded-lg text-sm font-black text-black disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#ffd700,#f5a623)' }}>
            {busy ? '...' : `💰 Вложить ${depositAmt ? '$' + depositAmt : ''}`}
          </button>
          <div className="text-[9px] text-slate-500 mt-2 text-center">
            Получишь {depositAmt ? parseFloat(depositAmt).toFixed(0) : '0'} долей. Прибыль начисляется с оборота фонда.
          </div>
        </div>
      )}

      {/* Статистика фонда */}
      {fund && (
        <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="text-[11px] font-bold text-purple-400 mb-2">📊 Фонд</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-sm font-black text-emerald-400">${parseFloat(fund.fundBalance).toFixed(0)}</div><div className="text-[8px] text-slate-500">в кассе</div></div>
            <div><div className="text-sm font-black text-amber-400">${parseFloat(fund.deployedAmount).toFixed(0)}</div><div className="text-[8px] text-slate-500">в работе</div></div>
            <div><div className="text-sm font-black text-white">${parseFloat(fund.totalShares).toFixed(0)}</div><div className="text-[8px] text-slate-500">всего долей</div></div>
          </div>
          <div className="text-[9px] text-slate-500 mt-2 text-center">
            Всего прибыли роздано: ${parseFloat(fund.totalRewardsDistributed).toFixed(2)}
          </div>
        </div>
      )}

      {/* ═══════ АДМИНКА (только owner) ═══════ */}
      {isAdmin && (
        <div className="p-4 rounded-2xl border-2 space-y-3" style={{ background: 'var(--bg-card)', borderColor: 'rgba(168,85,247,0.4)' }}>
          <div className="text-[12px] font-black text-purple-400">⚙️ Управление фондом (owner)</div>

          {/* Взять заём */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-300">Взять заём</div>
            <input placeholder="адрес получателя (0x...)" value={loanTo} onChange={e => setLoanTo(e.target.value)} className={inputCls} />
            <div className="flex gap-2">
              <input type="number" placeholder="сумма USDT" value={loanAmt} onChange={e => setLoanAmt(e.target.value)} className={inputCls} />
              <input placeholder="назначение" value={loanPurpose} onChange={e => setLoanPurpose(e.target.value)} className={inputCls} />
            </div>
            <button onClick={handleWithdraw} disabled={busy} className="w-full py-2 rounded-lg text-[12px] font-bold bg-amber-500/20 text-amber-400 disabled:opacity-50">
              📤 Создать заём
            </button>
          </div>

          {/* Вернуть в заём */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-300">Вернуть в заём (излишек → прибыль на доли)</div>
            <div className="flex gap-2">
              <input type="number" placeholder="№ займа" value={repayId} onChange={e => setRepayId(e.target.value)} className={inputCls} style={{ maxWidth: 90 }} />
              <input type="number" placeholder="сумма USDT" value={repayAmt} onChange={e => setRepayAmt(e.target.value)} className={inputCls} />
            </div>
            <button onClick={handleRepay} disabled={busy} className="w-full py-2 rounded-lg text-[12px] font-bold bg-emerald-500/20 text-emerald-400 disabled:opacity-50">
              📥 Вернуть в заём
            </button>
          </div>

          {/* Раздать прибыль */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-300">Раздать прибыль напрямую</div>
            <div className="flex gap-2">
              <input type="number" placeholder="сумма USDT" value={profitAmt} onChange={e => setProfitAmt(e.target.value)} className={inputCls} />
              <button onClick={handleDistribute} disabled={busy} className="px-4 py-2 rounded-lg text-[12px] font-bold bg-purple-500/20 text-purple-400 disabled:opacity-50 whitespace-nowrap">
                Раздать
              </button>
            </div>
          </div>

          {/* Очередь выходов */}
          {fund && fund.pendingExits > 0 && (
            <button onClick={handleQueue} disabled={busy} className="w-full py-2 rounded-lg text-[12px] font-bold bg-blue-500/20 text-blue-400 disabled:opacity-50">
              🚪 Обработать очередь ({fund.pendingExits} в ожидании)
            </button>
          )}

          {/* Список займов */}
          {loans.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-300 mb-1.5">Займы ({loans.length})</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {loans.map(l => (
                  <div key={l.id} className="p-2 rounded-lg bg-black/30 text-[10px]">
                    <div className="flex justify-between">
                      <span className="font-bold text-gold-400">#{l.id} {l.active ? '🟢' : '⚪'}</span>
                      <span className="text-slate-400">{l.purpose || '—'}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 mt-0.5">
                      <span>взято ${parseFloat(l.principal).toFixed(0)}</span>
                      <span>возврат ${parseFloat(l.repaid).toFixed(0)}</span>
                      <span>остаток ${parseFloat(l.outstanding).toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

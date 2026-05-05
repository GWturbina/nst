'use client'
/**
 * VaultTab — упрощённая вкладка "DCT Сейф"
 * 
 * АДАПТАЦИЯ под v2.3:
 * - Импорт: dctContracts → clubV23
 * - Удалён блок Heritage (DCTHeritage больше не существует)
 * - Удалён блок Insurance (отдельный инструмент в v2.3)
 * - Добавлен список holdings по пулам (был раньше только общий баланс)
 * - Добавлен резерв клуба
 */
import { useState, useEffect } from 'react'
import useGameStore from '@/lib/store'
import * as Club from '@/lib/clubV23'
import HelpButton from '@/components/ui/HelpButton'

export default function VaultTab() {
  const { wallet, dct, dctFree, dctLocked, dctPrice, t } = useGameStore()
  const [holdings, setHoldings] = useState([])
  const [reserveBalance, setReserveBalance] = useState('0')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!wallet) return
    setLoading(true)
    Promise.all([
      Club.getDCTHoldings(wallet).catch(() => []),
      Club.getReserveBalance().catch(() => '0'),
    ])
      .then(([h, r]) => {
        setHoldings(h)
        setReserveBalance(r)
      })
      .finally(() => setLoading(false))
  }, [wallet])

  const totalValueUSDT = dct && dctPrice
    ? (parseFloat(dct) * parseFloat(dctPrice)).toFixed(2)
    : '0'

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <h2 className="text-lg font-black text-gold-400">🔐 DCT Сейф</h2>
        <HelpButton section="vault" />
      </div>

      {!wallet ? (
        <div className="mx-3 mt-4 p-4 rounded-2xl glass text-center">
          <div className="text-3xl mb-2">🔐</div>
          <div className="text-sm font-bold text-slate-300">{t('connectWallet') || 'Подключите кошелёк'}</div>
        </div>
      ) : (
        <div className="px-3 mt-2 space-y-3">
          {/* DCT Balance */}
          <div className="p-4 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'rgba(255,215,0,0.15)' }}>
            <div className="text-[12px] font-bold text-gold-400 mb-3">💎 Ваш DCT баланс</div>
            <div className="text-center mb-3">
              <div className="text-3xl font-black text-gold-400">{parseFloat(dct || 0).toFixed(2)}</div>
              <div className="text-[10px] text-slate-500">DCT (~${totalValueUSDT} USDT)</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-sm font-bold text-emerald-400">{parseFloat(dctFree || 0).toFixed(2)}</div>
                <div className="text-[9px] text-slate-500">Свободные</div>
              </div>
              <div className="p-2 rounded-lg bg-white/5 text-center">
                <div className="text-sm font-bold text-amber-400">{parseFloat(dctLocked || 0).toFixed(2)}</div>
                <div className="text-[9px] text-slate-500">Заморожены</div>
              </div>
            </div>
          </div>

          {/* Holdings по пулам */}
          {holdings.length > 0 && (
            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[12px] font-bold text-blue-400 mb-2">💼 Доли по пулам ({holdings.length})</div>
              <div className="space-y-1.5">
                {holdings.map((h, i) => {
                  const now = Math.floor(Date.now() / 1000)
                  const daysLeft = Math.max(0, Math.ceil((h.unlocksAt - now) / 86400))
                  const unlocked = h.unlocksAt <= now
                  return (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <div>
                        <span className="text-[11px] font-bold text-white">Пул #{h.poolId}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{parseFloat(h.amount).toFixed(2)} DCT</span>
                      </div>
                      <div className={`text-[10px] font-bold ${unlocked ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {unlocked ? '✅ Свободно' : `🔒 ${daysLeft} дн`}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Резерв клуба */}
          <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[12px] font-bold text-purple-400 mb-2">🛡 Резервный фонд</div>
            <div className="text-2xl font-black text-purple-400">${parseFloat(reserveBalance).toFixed(2)}</div>
            <div className="text-[10px] text-slate-400 mt-1">
              Защищает DCT по цене $0.56 в случае форс-мажора
            </div>
          </div>

          {/* Информация */}
          <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[12px] font-bold text-emerald-400 mb-2">💡 Как работает DCT</div>
            <div className="text-[10px] text-slate-400 leading-relaxed space-y-1">
              <div>• 1 USDT = 2 DCT при покупке доли в пуле</div>
              <div>• DCT замораживается на 1 год (защита клуба)</div>
              <div>• Можно выкупить за USDT на вкладке "Обмен" → "Выкуп"</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

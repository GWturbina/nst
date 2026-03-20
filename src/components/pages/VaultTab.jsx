'use client'
import { useState, useEffect } from 'react'
import useGameStore from '@/lib/store'
import * as DCT from '@/lib/dctContracts'
import HelpButton from '@/components/ui/HelpButton'

export default function VaultTab() {
  const { wallet, dct, dctFree, dctLocked, dctPrice, addNotification, setTxPending, txPending, t } = useGameStore()
  const [tokenInfo, setTokenInfo] = useState(null)
  const [heritageInfo, setHeritageInfo] = useState(null)

  useEffect(() => {
    DCT.getDCTTokenInfo().then(setTokenInfo).catch(() => {})
    if (wallet) {
      DCT.getHeritageInfo(wallet).then(setHeritageInfo).catch(() => {})
    }
  }, [wallet])

  const totalValueUSDT = dct && dctPrice ? (parseFloat(dct) * parseFloat(dctPrice)).toFixed(2) : '0'

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <h2 className="text-lg font-black text-gold-400">🔐 DCT Сейф</h2>
        <HelpButton section="vault" />
      </div>

      {!wallet ? (
        <div className="mx-3 mt-4 p-4 rounded-2xl glass text-center">
          <div className="text-3xl mb-2">🔐</div>
          <div className="text-sm font-bold text-slate-300">{t('connectWallet')}</div>
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

          {/* Token Info */}
          {tokenInfo && (
            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[12px] font-bold text-blue-400 mb-2">📊 DCT Статистика</div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-400">Цена DCT</span><span className="text-white font-bold">${parseFloat(tokenInfo.price).toFixed(4)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Всего выпущено</span><span className="text-white font-bold">{parseFloat(tokenInfo.supply).toFixed(0)} DCT</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Обеспечение</span><span className="text-white font-bold">${parseFloat(tokenInfo.backing).toFixed(0)}</span></div>
              </div>
            </div>
          )}

          {/* Heritage */}
          <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[12px] font-bold text-purple-400 mb-2">🏛 Наследование DCT</div>
            {heritageInfo?.active ? (
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-400">Статус</span><span className="text-emerald-400 font-bold">✅ Активно</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Наследников</span><span className="text-white font-bold">{heritageInfo.heirCount}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Неактивность</span><span className="text-white font-bold">{heritageInfo.inactivityDays} дн.</span></div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 text-center py-2">
                Настройте наследование во вкладке Diamond Club
              </div>
            )}
          </div>

          {/* Insurance */}
          <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[12px] font-bold text-emerald-400 mb-2">🛡 Страховой Фонд</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Каждая покупка камня пополняет страховой фонд. Ваши инвестиции защищены.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

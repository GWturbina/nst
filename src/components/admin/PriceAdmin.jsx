'use client'
/**
 * PriceAdmin — Загрузка и просмотр цен камней в контракт FractionalGem
 */
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import useGameStore from '@/lib/store'
import { safeCall } from '@/lib/contracts'
import { authFetch } from '@/lib/authClient'
import web3 from '@/lib/web3'
import ADDRESSES from '@/contracts/addresses'

const FRACTIONALGEM_ABI = [
  'function setPriceEntry(uint256 caratX100, uint256 costNoCert, uint256 costCert)',
  'function getRegisteredCarats() view returns (uint256[])',
  'function getPriceInfo(uint256 c, bool cert) view returns (uint256 cost, uint256 club, uint256 ws, uint256 mkt)',
]

const READ_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)
const fmt6 = (v) => parseFloat(ethers.formatUnits(v, 6))
const parse6 = (v) => ethers.parseUnits(String(v), 6)

export default function PriceAdmin() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [prices, setPrices] = useState([])
  const [loading, setLoading] = useState(true)
  // Форма
  const [newCarats, setNewCarats] = useState('')
  const [newNoCert, setNewNoCert] = useState('')
  const [newCert, setNewCert] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const addr = ADDRESSES.FractionalGem
      if (!addr) { setLoading(false); return }
      const c = new ethers.Contract(addr, FRACTIONALGEM_ABI, readProvider)
      const carats = await c.getRegisteredCarats()
      const rows = []
      for (const ct of carats) {
        try {
          const noCert = await c.getPriceInfo(ct, false)
          const withCert = await c.getPriceInfo(ct, true)
          rows.push({
            caratX100: Number(ct),
            carats: (Number(ct) / 100).toFixed(2),
            costNoCert: fmt6(noCert.cost),
            clubNoCert: fmt6(noCert.club),
            marketNoCert: fmt6(noCert.mkt),
            costCert: fmt6(withCert.cost),
            clubCert: fmt6(withCert.club),
            marketCert: fmt6(withCert.mkt),
          })
        } catch {}
      }
      rows.sort((a, b) => a.caratX100 - b.caratX100)
      setPrices(rows)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleSave = async () => {
    const ct = parseFloat(newCarats)
    const no = parseFloat(newNoCert)
    const ce = parseFloat(newCert)
    if (!ct || ct <= 0) return addNotification('❌ Укажите караты')
    if (!no || no <= 0) return addNotification('❌ Укажите цену без сертификата')
    if (!ce || ce <= 0) return addNotification('❌ Укажите цену с сертификатом')
    if (ce < no) return addNotification('❌ Цена с сертификатом должна быть больше')

    const caratX100 = Math.round(ct * 100)

    setTxPending(true)
    const result = await safeCall(async () => {
      const c = new ethers.Contract(ADDRESSES.FractionalGem, FRACTIONALGEM_ABI, web3.signer)
      const tx = await c.setPriceEntry(caratX100, parse6(no.toFixed(2)), parse6(ce.toFixed(2)))
      return await tx.wait()
    })
    setTxPending(false)

    if (result.ok) {
      addNotification(`✅ Цена ${ct}ct в контракте: $${no} / $${ce}`)

      // Синхронизация с Supabase dc_prices (конфигуратор читает оттуда)
      try {
        const PREMIUM_MULT = 1.08 // премиум = +8%
        const ctKey = ct.toFixed(2)

        // Загружаем текущие цены из Supabase
        const current = await fetch('/api/prices').then(r => r.json()).catch(() => ({ prices: {} }))
        const stdPrices = { ...(current.prices?.club_standard || {}) }
        const premPrices = { ...(current.prices?.club_premium || {}) }

        // Обновляем
        stdPrices[ctKey] = { noCert: Math.round(no), cert: Math.round(ce) }
        premPrices[ctKey] = { noCert: Math.round(no * PREMIUM_MULT), cert: Math.round(ce * PREMIUM_MULT) }

        // Сохраняем оба тира
        await authFetch('/api/prices', { method: 'POST', body: { adminWallet: wallet, key: 'club_standard', data: stdPrices } })
        await authFetch('/api/prices', { method: 'POST', body: { adminWallet: wallet, key: 'club_premium', data: premPrices } })

        addNotification('✅ Синхронизировано с конфигуратором')
      } catch {
        addNotification('⚠️ Контракт обновлён, но синхронизация с Supabase не удалась')
      }

      setNewCarats(''); setNewNoCert(''); setNewCert('')
      reload()
    } else {
      addNotification(`❌ ${result.error}`)
    }
  }

  if (loading) return <div className="px-3 mt-2 text-center py-8"><div className="text-2xl animate-spin">💎</div></div>

  return (
    <div className="px-3 mt-2 space-y-3">

      {/* Форма добавления */}
      <div className="p-4 rounded-2xl glass">
        <div className="text-[13px] font-black text-gold-400 mb-3">💲 Добавить / обновить цену</div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <div className="text-[9px] text-slate-500 mb-1">Караты</div>
            <input type="number" value={newCarats} onChange={e => setNewCarats(e.target.value)}
              placeholder="1.00" step="0.01" min="0.1"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white outline-none text-center" />
          </div>
          <div>
            <div className="text-[9px] text-slate-500 mb-1">Без серт. ($)</div>
            <input type="number" value={newNoCert} onChange={e => setNewNoCert(e.target.value)}
              placeholder="1000"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white outline-none text-center" />
          </div>
          <div>
            <div className="text-[9px] text-slate-500 mb-1">С серт. ($)</div>
            <input type="number" value={newCert} onChange={e => setNewCert(e.target.value)}
              placeholder="1900"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white outline-none text-center" />
          </div>
        </div>

        {/* Предпросмотр */}
        {newCarats && newNoCert && newCert && (
          <div className="p-2.5 rounded-xl bg-white/5 mb-3 text-[10px] text-slate-400">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-slate-500">Без сертификата:</div>
                <div>Себестоимость: <span className="text-white font-bold">${parseFloat(newNoCert).toLocaleString()}</span></div>
                <div>Клубная (+10%): <span className="text-gold-400 font-bold">${Math.round(parseFloat(newNoCert) * 1.1).toLocaleString()}</span></div>
                <div>Рыночная: <span className="text-slate-300">${Math.round(parseFloat(newNoCert) / 0.65 * 2).toLocaleString()}</span></div>
              </div>
              <div>
                <div className="text-slate-500">С сертификатом:</div>
                <div>Себестоимость: <span className="text-white font-bold">${parseFloat(newCert).toLocaleString()}</span></div>
                <div>Клубная (+10%): <span className="text-gold-400 font-bold">${Math.round(parseFloat(newCert) * 1.1).toLocaleString()}</span></div>
                <div>Рыночная: <span className="text-slate-300">${Math.round(parseFloat(newCert) / 0.65 * 2).toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleSave} disabled={txPending || !newCarats || !newNoCert || !newCert}
          className="w-full py-3 rounded-xl text-[12px] font-bold gold-btn"
          style={{ opacity: (txPending || !newCarats || !newNoCert || !newCert) ? 0.5 : 1 }}>
          {txPending ? '⏳ Сохранение...' : '💲 Сохранить цену в контракт'}
        </button>
      </div>

      {/* Быстрая загрузка прайса */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-blue-400 mb-2">⚡ Быстрая загрузка (все 7 позиций)</div>
        <div className="text-[10px] text-slate-400 mb-2">Нажмите на строку — данные заполнятся автоматически</div>
        <div className="space-y-1">
          {[
            { ct: '0.30', no: '300', ce: '600' },
            { ct: '0.50', no: '500', ce: '1100' },
            { ct: '1.00', no: '1000', ce: '1900' },
            { ct: '1.50', no: '1600', ce: '3600' },
            { ct: '2.00', no: '2800', ce: '4900' },
            { ct: '2.50', no: '4500', ce: '8500' },
            { ct: '3.00', no: '8500', ce: '15000' },
          ].map(r => {
            const alreadySet = prices.some(p => p.carats === parseFloat(r.ct).toFixed(2))
            return (
              <button key={r.ct} onClick={() => { setNewCarats(r.ct); setNewNoCert(r.no); setNewCert(r.ce) }}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-[10px] border transition-all ${
                  alreadySet ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400' : 'bg-white/5 border-white/8 text-slate-300'
                }`}>
                <span className="font-bold">💎 {r.ct} ct</span>
                <span>${r.no} / ${r.ce}</span>
                <span>{alreadySet ? '✅' : '⬜'}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Текущие цены из контракта */}
      <div className="p-3 rounded-2xl glass">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-bold text-emerald-400">📊 Цены в контракте ({prices.length})</div>
          <button onClick={reload} className="text-[10px] text-blue-400 font-bold">🔄 Обновить</button>
        </div>

        {prices.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-4">Цены ещё не загружены</div>
        ) : (
          <div className="space-y-1.5">
            {prices.map(p => (
              <div key={p.caratX100} className="p-2.5 rounded-xl bg-white/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-black text-gold-400">💎 {p.carats} ct</span>
                  <button onClick={() => { setNewCarats(p.carats); setNewNoCert(String(p.costNoCert)); setNewCert(String(p.costCert)) }}
                    className="text-[9px] text-blue-400">✏️ Изменить</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  <div>
                    <div className="text-slate-500">Без сертификата</div>
                    <div className="text-slate-300">Себест: ${p.costNoCert.toLocaleString()}</div>
                    <div className="text-gold-400 font-bold">Клуб: ${p.clubNoCert.toLocaleString()}</div>
                    <div className="text-slate-500">Рынок: ${p.marketNoCert.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">С сертификатом</div>
                    <div className="text-slate-300">Себест: ${p.costCert.toLocaleString()}</div>
                    <div className="text-emerald-400 font-bold">Клуб: ${p.clubCert.toLocaleString()}</div>
                    <div className="text-slate-500">Рынок: ${p.marketCert.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

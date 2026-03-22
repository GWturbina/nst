'use client'
/**
 * BoostConfigAdmin.jsx — Управление порогами буста (UserBoost контракт)
 * Кнопки: сброс порогов, установка новых, просмотр текущих
 */
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import useGameStore from '@/lib/store'
import { safeCall } from '@/lib/contracts'
import web3 from '@/lib/web3'
import ADDRESSES from '@/contracts/addresses'

const USERBOOST_ABI = [
  'function resetBoostLevels()',
  'function addBoostLevel(uint256 threshold, uint16 boostBP)',
  'function setBaseRate(uint16 _base)',
  'function setMaxRate(uint16 _max)',
  'function getBoostLevelsCount() view returns (uint256)',
  'function boostLevels(uint256) view returns (uint256 nstThreshold, uint16 boostBP)',
  'function baseStakingRateBP() view returns (uint16)',
  'function maxStakingRateBP() view returns (uint16)',
  'function totalBoostedUsers() view returns (uint256)',
  'function totalNSTBurned() view returns (uint256)',
  'function owner() view returns (address)',
]

const READ_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://opbnb-mainnet-rpc.bnbchain.org'
const readProvider = new ethers.JsonRpcProvider(READ_RPC)

// Новые пороги (Lv.6-7 средний = ~16K NSS/год)
const NEW_THRESHOLDS = [
  { nss: 1000,  bp: 5500, label: '1K → 55%' },
  { nss: 3000,  bp: 6000, label: '3K → 60%' },
  { nss: 6000,  bp: 6500, label: '6K → 65%' },
  { nss: 10000, bp: 7000, label: '10K → 70%' },
  { nss: 16000, bp: 7500, label: '16K → 75%' },
]

export default function BoostConfigAdmin() {
  const { wallet, addNotification } = useGameStore()
  const [currentLevels, setCurrentLevels] = useState([])
  const [baseRate, setBaseRate] = useState(0)
  const [maxRate, setMaxRate] = useState(0)
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalBurned, setTotalBurned] = useState('0')
  const [loading, setLoading] = useState(true)
  const [txPending, setTxPending] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const addr = ADDRESSES.UserBoost
      if (!addr) { setLoading(false); return }
      const c = new ethers.Contract(addr, USERBOOST_ABI, readProvider)

      const [count, base, max, users, burned] = await Promise.all([
        c.getBoostLevelsCount().catch(() => 0),
        c.baseStakingRateBP().catch(() => 5000),
        c.maxStakingRateBP().catch(() => 7500),
        c.totalBoostedUsers().catch(() => 0),
        c.totalNSTBurned().catch(() => 0n),
      ])

      setBaseRate(Number(base))
      setMaxRate(Number(max))
      setTotalUsers(Number(users))
      setTotalBurned(ethers.formatEther(burned))

      const levels = []
      for (let i = 0; i < Number(count); i++) {
        try {
          const l = await c.boostLevels(i)
          levels.push({
            threshold: ethers.formatEther(l.nstThreshold),
            boostBP: Number(l.boostBP),
          })
        } catch { break }
      }
      setCurrentLevels(levels)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  // ═══ Сброс + установка новых порогов ═══
  const handleResetAndSet = async () => {
    setTxPending(true)
    addNotification('⏳ Шаг 1/2: Сброс старых порогов...')

    const r1 = await safeCall(async () => {
      const c = new ethers.Contract(ADDRESSES.UserBoost, USERBOOST_ABI, web3.signer)
      const tx = await c.resetBoostLevels()
      return await tx.wait()
    })

    if (!r1.ok) {
      addNotification('❌ Сброс: ' + r1.error)
      setTxPending(false)
      return
    }
    addNotification('✅ Старые пороги сброшены')

    // Добавляем новые
    for (let i = 0; i < NEW_THRESHOLDS.length; i++) {
      const t = NEW_THRESHOLDS[i]
      addNotification(`⏳ Шаг ${i + 2}/${NEW_THRESHOLDS.length + 1}: ${t.label}...`)
      const r = await safeCall(async () => {
        const c = new ethers.Contract(ADDRESSES.UserBoost, USERBOOST_ABI, web3.signer)
        const threshold = ethers.parseEther(String(t.nss))
        const tx = await c.addBoostLevel(threshold, t.bp)
        return await tx.wait()
      })
      if (!r.ok) {
        addNotification(`❌ Порог ${t.label}: ${r.error}`)
        setTxPending(false)
        reload()
        return
      }
      addNotification(`✅ ${t.label} установлен`)
    }

    addNotification('🎉 Все пороги обновлены!')
    setTxPending(false)
    reload()
  }

  // ═══ Добавить один порог ═══
  const [customNss, setCustomNss] = useState('')
  const [customBP, setCustomBP] = useState('')

  const handleAddSingle = async () => {
    if (!customNss || !customBP) return
    setTxPending(true)
    const r = await safeCall(async () => {
      const c = new ethers.Contract(ADDRESSES.UserBoost, USERBOOST_ABI, web3.signer)
      const tx = await c.addBoostLevel(ethers.parseEther(customNss), parseInt(customBP))
      return await tx.wait()
    })
    setTxPending(false)
    if (r.ok) { addNotification(`✅ Порог ${customNss} GST → ${parseInt(customBP)/100}%`); setCustomNss(''); setCustomBP(''); reload() }
    else addNotification('❌ ' + r.error)
  }

  if (loading) return <div className="text-center py-6"><div className="text-2xl animate-spin">🚀</div></div>

  return (
    <div className="space-y-3">

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-xl bg-white/5 text-center">
          <div className="text-[12px] font-bold text-emerald-400">{baseRate / 100}%</div>
          <div className="text-[8px] text-slate-500">Базовая ставка</div>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 text-center">
          <div className="text-[12px] font-bold text-gold-400">{maxRate / 100}%</div>
          <div className="text-[8px] text-slate-500">Максимум</div>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 text-center">
          <div className="text-[12px] font-bold text-blue-400">{totalUsers}</div>
          <div className="text-[8px] text-slate-500">Бустеров</div>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 text-center">
          <div className="text-[12px] font-bold text-orange-400">{parseFloat(totalBurned).toFixed(0)}</div>
          <div className="text-[8px] text-slate-500">Сожжено GST</div>
        </div>
      </div>

      {/* Текущие пороги */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-purple-400 mb-2">📊 Текущие пороги ({currentLevels.length})</div>
        {currentLevels.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-3">Пороги не установлены</div>
        ) : (
          <div className="space-y-1">
            {currentLevels.map((l, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/5 text-[10px]">
                <span className="text-slate-400">Порог {i + 1}</span>
                <span className="text-white font-bold">{parseFloat(l.threshold).toLocaleString()} GST</span>
                <span className="text-emerald-400 font-bold">{l.boostBP / 100}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Главная кнопка: сброс + установка новых */}
      <div className="p-3 rounded-2xl glass border border-gold-400/15">
        <div className="text-[12px] font-bold text-gold-400 mb-2">⚡ Установить новые пороги</div>
        <div className="text-[10px] text-slate-400 mb-2">
          Сбросит старые и установит: {NEW_THRESHOLDS.map(t => t.label).join(', ')}
        </div>
        <div className="text-[9px] text-orange-400 mb-2">
          ⚠️ {NEW_THRESHOLDS.length + 1} транзакций в SafePal (сброс + {NEW_THRESHOLDS.length} порогов)
        </div>
        <button onClick={handleResetAndSet} disabled={txPending}
          className="w-full py-3 rounded-xl text-[12px] font-black gold-btn disabled:opacity-50">
          {txPending ? '⏳ Подождите...' : '⚡ Сбросить и установить новые пороги'}
        </button>
      </div>

      {/* Ручное добавление */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-blue-400 mb-2">➕ Добавить порог вручную</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[9px] text-slate-500">GST</label>
            <input type="number" value={customNss} onChange={e => setCustomNss(e.target.value)}
              placeholder="16000" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
          </div>
          <div>
            <label className="text-[9px] text-slate-500">BP (7500 = 75%)</label>
            <input type="number" value={customBP} onChange={e => setCustomBP(e.target.value)}
              placeholder="7500" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
          </div>
        </div>
        <button onClick={handleAddSingle} disabled={txPending || !customNss || !customBP}
          className="w-full py-2 rounded-xl text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20 disabled:opacity-50">
          {txPending ? '⏳' : '➕ Добавить порог'}
        </button>
      </div>
    </div>
  )
}

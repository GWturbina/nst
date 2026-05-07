'use client'
/**
 * FinanceAdmin.jsx — Финансовая панель админа Diamond Club
 *
 * Показывает в одном месте все деньги системы:
 *  • Список пулов с их финансами (цель/собрано/в котле/DCT)
 *  • Резервный фонд (5% от прибыли продаж)
 *  • Адреса распределения маркетинга (с балансами USDT)
 *  • Маркетинг-баланс текущего админа
 *  • DCT total supply
 *
 * Все данные читаются прямо с контрактов (без Supabase) — это
 * единственный источник правды о деньгах. Supabase здесь только
 * для метаданных пулов (название/фото).
 */
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import ADDRESSES from '@/contracts/addresses'

// Минимальные ABI для читалки балансов
const ABI_USDT = ['function balanceOf(address) view returns (uint256)']
const ABI_POOLS = [
  'function poolsCount() view returns (uint256)',
  'function getPool(uint256) view returns (tuple(uint256 id, string name, uint256 targetUSDT, uint256 raisedUSDT, uint256 treasuryUSDT, uint256 totalDCT, uint8 status, uint64 createdAt, uint64 unlocksAt, uint8 cyclesCompleted, uint256 currentItemId, string metaUrl))',
  'function getReserveBalance() view returns (uint256)',
]
const ABI_DCT = [
  'function totalSupply() view returns (uint256)',
]
const ABI_MARKETING = [
  'function getBalance(address) view returns (uint256)',
  'function totalLifetimeEarned(address) view returns (uint256)',
  'function getEarningsByLevel(address) view returns (uint256[9])',
  'function getCurrentPhase() view returns (uint8)',
  'function totalAdsCollected() view returns (uint256)',
  'function adsToPhaseSwitch() view returns (uint256)',
  'function adsFundAddr() view returns (address)',
  'function authorAddr() view returns (address)',
  'function techAddr() view returns (address)',
  'function gwtAddr() view returns (address)',
  'function cgtAddr() view returns (address)',
]

const STATUS_LABELS = {
  0: '🟢 Сбор',
  1: '🔵 Собран',
  2: '🟡 Камень куплен',
  3: '🔄 Цикл',
  4: '❄️ Заморожен',
  5: '🔓 Разморожен',
  6: '❌ Отменён',
  7: '🚨 Drained',
}

export default function FinanceAdmin() {
  const { wallet } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const provider = new ethers.JsonRpcProvider('https://opbnb-mainnet-rpc.bnbchain.org')

      const usdt = new ethers.Contract(ADDRESSES.USDT, ABI_USDT, provider)
      const pools = new ethers.Contract(ADDRESSES.ClubPools, ABI_POOLS, provider)
      const dct = new ethers.Contract(ADDRESSES.ClubDCT, ABI_DCT, provider)
      const mkt = new ethers.Contract(ADDRESSES.ClubMarketing, ABI_MARKETING, provider)

      // Параллельно получаем все данные
      const [
        poolsCount,
        reserveBalance,
        dctSupply,
        poolsContractUSDT,
        marketingContractUSDT,
        adsAddr, authorAddr, techAddr, gwtAddr, cgtAddr,
        currentPhase,
        totalAdsCollected,
        adsToPhaseSwitch,
      ] = await Promise.all([
        pools.poolsCount(),
        pools.getReserveBalance(),
        dct.totalSupply(),
        usdt.balanceOf(ADDRESSES.ClubPools),
        usdt.balanceOf(ADDRESSES.ClubMarketing),
        mkt.adsFundAddr(),
        mkt.authorAddr(),
        mkt.techAddr(),
        mkt.gwtAddr(),
        mkt.cgtAddr(),
        mkt.getCurrentPhase(),
        mkt.totalAdsCollected(),
        mkt.adsToPhaseSwitch(),
      ])

      // Балансы фиксированных адресов распределения (5%, 2%, 3%, 2.5%, 2.5%)
      const [adsBal, authorBal, techBal, gwtBal, cgtBal] = await Promise.all([
        usdt.balanceOf(adsAddr),
        usdt.balanceOf(authorAddr),
        usdt.balanceOf(techAddr),
        usdt.balanceOf(gwtAddr),
        usdt.balanceOf(cgtAddr),
      ])

      // Все пулы по очереди
      const count = Number(poolsCount)
      const poolsList = []
      for (let i = 1; i <= count; i++) {
        try {
          const p = await pools.getPool(i)
          poolsList.push({
            id: Number(p.id),
            name: p.name,
            target: ethers.formatEther(p.targetUSDT),
            raised: ethers.formatEther(p.raisedUSDT),
            treasury: ethers.formatEther(p.treasuryUSDT),
            totalDCT: ethers.formatEther(p.totalDCT),
            status: Number(p.status),
            cycles: Number(p.cyclesCompleted),
            unlocksAt: Number(p.unlocksAt),
          })
        } catch {}
      }

      // Маркетинг-баланс текущего пользователя
      let myMkt = null
      if (wallet) {
        try {
          const [bal, lifetime, byLevel] = await Promise.all([
            mkt.getBalance(wallet),
            mkt.totalLifetimeEarned(wallet),
            mkt.getEarningsByLevel(wallet),
          ])
          myMkt = {
            balance: ethers.formatEther(bal),
            lifetime: ethers.formatEther(lifetime),
            byLevel: byLevel.map(v => ethers.formatEther(v)),
          }
        } catch {}
      }

      setData({
        poolsCount: count,
        poolsList,
        reserveBalance: ethers.formatEther(reserveBalance),
        dctSupply: ethers.formatEther(dctSupply),
        poolsContractUSDT: ethers.formatEther(poolsContractUSDT),
        marketingContractUSDT: ethers.formatEther(marketingContractUSDT),
        addresses: {
          ads: { addr: adsAddr, balance: ethers.formatEther(adsBal), label: '5% Реклама', color: 'text-purple-400' },
          author: { addr: authorAddr, balance: ethers.formatEther(authorBal), label: '2% Автор', color: 'text-blue-400' },
          tech: { addr: techAddr, balance: ethers.formatEther(techBal), label: '3% Тех. команда', color: 'text-cyan-400' },
          gwt: { addr: gwtAddr, balance: ethers.formatEther(gwtBal), label: '2.5% GWT', color: 'text-emerald-400' },
          cgt: { addr: cgtAddr, balance: ethers.formatEther(cgtBal), label: '2.5% CGT', color: 'text-amber-400' },
        },
        currentPhase: Number(currentPhase),
        totalAdsCollected: ethers.formatEther(totalAdsCollected),
        adsToPhaseSwitch: ethers.formatEther(adsToPhaseSwitch),
        myMkt,
      })
    } catch (e) {
      console.error('Finance reload:', e)
      setError(e?.message || 'Ошибка загрузки')
    }
    setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-3xl animate-spin">📊</div>
        <div className="text-xs text-slate-500 mt-2">Загружаю финансы с блокчейна...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl mb-2">⚠️</div>
        <div className="text-xs text-red-400">{error}</div>
        <button onClick={reload} className="mt-3 px-4 py-2 rounded-xl text-[11px] font-bold gold-btn">
          🔄 Повторить
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-black text-gold-400">📊 Финансы Diamond Club</div>
        <button onClick={reload}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10">
          🔄 Обновить
        </button>
      </div>

      {/* ═══ ОБЩАЯ СТАТИСТИКА ═══ */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Всего пулов" value={data.poolsCount} icon="💎" />
        <StatCard label="Всего DCT выпущено" value={`${parseFloat(data.dctSupply).toLocaleString()}`} icon="🪙" />
      </div>

      {/* ═══ ВНУТРИ КОНТРАКТОВ ═══ */}
      <div className="p-3 rounded-2xl border" style={{ background: 'rgba(212,168,67,0.06)', borderColor: 'rgba(212,168,67,0.2)' }}>
        <div className="text-[11px] font-bold text-gold-400 mb-2">🏦 Деньги внутри контрактов (USDT)</div>

        <ContractBalance
          name="ClubPools"
          desc="Все пулы — суммарно treasury всех лотов"
          addr={ADDRESSES.ClubPools}
          balance={data.poolsContractUSDT}
          highlight
        />

        <ContractBalance
          name="ClubMarketing"
          desc="9 уровней партнёрки (накоплено к claim)"
          addr={ADDRESSES.ClubMarketing}
          balance={data.marketingContractUSDT}
        />

        <ContractBalance
          name="Reserve Fund"
          desc="Защитная подушка (5% от прибыли продаж)"
          addr={null}
          balance={data.reserveBalance}
          subscript="внутри ClubPools"
        />
      </div>

      {/* ═══ ФИКСИРОВАННЫЕ АДРЕСА (получают сразу при покупке) ═══ */}
      <div className="p-3 rounded-2xl border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="text-[11px] font-bold text-white mb-2">💸 Распределение от каждой покупки доли</div>
        <div className="text-[9px] text-slate-500 mb-3">
          Эти адреса получают USDT <b>сразу при покупке</b> (без claim). Деньги уже на их кошельках.
        </div>
        <div className="space-y-1.5">
          {Object.entries(data.addresses).map(([key, addr]) => (
            <AddressRow key={key} {...addr} />
          ))}
        </div>
      </div>

      {/* ═══ Текущая фаза маркетинга ═══ */}
      <div className="p-3 rounded-2xl border" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.2)' }}>
        <div className="text-[11px] font-bold text-blue-400 mb-2">📢 Маркетинг: фаза {data.currentPhase === 0 ? 'СТАРТ' : 'РОСТ'}</div>
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between">
            <span className="text-slate-400">Всего собрано в ADS:</span>
            <span className="text-white font-bold">${parseFloat(data.totalAdsCollected).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">До переключения фазы:</span>
            <span className="text-blue-300 font-bold">${parseFloat(data.adsToPhaseSwitch).toLocaleString()}</span>
          </div>
          <div className="text-[9px] text-slate-500 mt-2">
            {data.currentPhase === 0
              ? 'Старт-фаза: невыплаченные доли спонсоров на 100% идут в рекламу'
              : 'Рост-фаза: невыплаченные доли спонсоров делятся 50/50 между рекламой и пулом'}
          </div>
        </div>
      </div>

      {/* ═══ МОЙ МАРКЕТИНГ ═══ */}
      {data.myMkt && (
        <div className="p-3 rounded-2xl border" style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)' }}>
          <div className="text-[11px] font-bold text-emerald-400 mb-2">🎁 Мой маркетинг</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
              <div className="text-[9px] text-slate-500">Можно claim</div>
              <div className="text-[14px] font-black text-emerald-400">${parseFloat(data.myMkt.balance).toFixed(4)}</div>
            </div>
            <div className="p-2 rounded-xl bg-white/5">
              <div className="text-[9px] text-slate-500">Заработано всего</div>
              <div className="text-[14px] font-black text-white">${parseFloat(data.myMkt.lifetime).toFixed(4)}</div>
            </div>
          </div>
          <div className="text-[9px] text-slate-500 mb-1">По уровням иерархии (доля 9 уровней):</div>
          <div className="grid grid-cols-3 gap-1">
            {data.myMkt.byLevel.map((v, i) => (
              <div key={i} className="text-[9px] p-1 rounded-lg bg-white/3 text-center">
                <span className="text-slate-500">L{i + 1}:</span>
                <span className="text-white font-bold ml-1">${parseFloat(v).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ВСЕ ПУЛЫ ═══ */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-gold-400 px-1">💎 Финансы каждого пула</div>
        {data.poolsList.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-slate-500 rounded-xl bg-white/3">
            Пулов в контракте пока нет
          </div>
        ) : (
          data.poolsList.map(pool => <PoolFinanceCard key={pool.id} pool={pool} />)
        )}
      </div>

      {/* ═══ ССЫЛКИ ДЛЯ ПРОВЕРКИ ═══ */}
      <div className="p-3 rounded-2xl bg-white/3 border border-white/8">
        <div className="text-[11px] font-bold text-slate-300 mb-2">🔗 Проверить на opBNB Scan</div>
        <div className="space-y-1 text-[10px]">
          <a href={`https://opbnb.bscscan.com/address/${ADDRESSES.ClubPools}`} target="_blank" rel="noreferrer"
            className="block text-blue-400 hover:underline">
            ClubPools — {shortAddress(ADDRESSES.ClubPools)}
          </a>
          <a href={`https://opbnb.bscscan.com/address/${ADDRESSES.ClubMarketing}`} target="_blank" rel="noreferrer"
            className="block text-blue-400 hover:underline">
            ClubMarketing — {shortAddress(ADDRESSES.ClubMarketing)}
          </a>
          <a href={`https://opbnb.bscscan.com/address/${ADDRESSES.ClubDCT}`} target="_blank" rel="noreferrer"
            className="block text-blue-400 hover:underline">
            ClubDCT (токен) — {shortAddress(ADDRESSES.ClubDCT)}
          </a>
          <a href={`https://opbnb.bscscan.com/address/${ADDRESSES.ClubMarket}`} target="_blank" rel="noreferrer"
            className="block text-blue-400 hover:underline">
            ClubMarket — {shortAddress(ADDRESSES.ClubMarket)}
          </a>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
// ═══════════════════════════════════════════════════════

function StatCard({ label, value, icon }) {
  return (
    <div className="p-3 rounded-xl bg-white/4 border border-white/8">
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-lg">{icon}</span>
        <span className="text-[16px] font-black text-white">{value}</span>
      </div>
    </div>
  )
}

function ContractBalance({ name, desc, addr, balance, highlight, subscript }) {
  return (
    <div className={`p-2.5 rounded-xl mb-1.5 ${highlight ? 'bg-gold-400/10 border border-gold-400/20' : 'bg-white/3 border border-white/8'}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-white">{name}</div>
          <div className="text-[9px] text-slate-500">{desc}</div>
          {addr && (
            <a href={`https://opbnb.bscscan.com/address/${addr}`} target="_blank" rel="noreferrer"
              className="text-[8px] text-blue-400/70 hover:text-blue-400 font-mono">
              {shortAddress(addr)}
            </a>
          )}
          {subscript && (
            <div className="text-[8px] text-slate-600 mt-0.5">{subscript}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[14px] font-black text-emerald-400">
            ${parseFloat(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[8px] text-slate-500">USDT</div>
        </div>
      </div>
    </div>
  )
}

function AddressRow({ addr, balance, label, color }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3 border border-white/6">
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] font-bold ${color}`}>{label}</div>
        <a href={`https://opbnb.bscscan.com/address/${addr}`} target="_blank" rel="noreferrer"
          className="text-[8px] text-slate-500 hover:text-blue-400 font-mono">
          {shortAddress(addr)}
        </a>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[12px] font-black text-white">${parseFloat(balance).toFixed(2)}</div>
      </div>
    </div>
  )
}

function PoolFinanceCard({ pool }) {
  const target = parseFloat(pool.target)
  const raised = parseFloat(pool.raised)
  const treasury = parseFloat(pool.treasury)
  const dct = parseFloat(pool.totalDCT)
  const progress = target > 0 ? Math.min(100, (raised / target) * 100) : 0
  const statusInfo = STATUS_LABELS[pool.status] || '?'

  return (
    <div className="p-3 rounded-2xl border" style={{ background: 'rgba(21,21,48,0.6)', borderColor: 'rgba(212,168,67,0.15)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-white truncate">#{pool.id} {pool.name}</div>
          <div className="text-[9px] text-slate-500 mt-0.5">{statusInfo} • Циклов: {pool.cycles}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="p-2 rounded-lg bg-white/3">
          <div className="text-[9px] text-slate-500">Цель сбора</div>
          <div className="text-[12px] font-black text-white">${target.toLocaleString()}</div>
        </div>
        <div className="p-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
          <div className="text-[9px] text-slate-500">Собрано в котёл</div>
          <div className="text-[12px] font-black text-emerald-400">${raised.toLocaleString()}</div>
        </div>
        <div className="p-2 rounded-lg bg-white/3">
          <div className="text-[9px] text-slate-500">Treasury (текущий)</div>
          <div className="text-[12px] font-black text-white">${treasury.toLocaleString()}</div>
        </div>
        <div className="p-2 rounded-lg bg-white/3">
          <div className="text-[9px] text-slate-500">DCT выпущено</div>
          <div className="text-[12px] font-black text-blue-300">{dct.toLocaleString()}</div>
        </div>
      </div>

      <div className="text-[9px] text-slate-500 mb-1">Прогресс сбора</div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500"
          style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-[9px] text-slate-500 mt-1">
        <span>${raised.toLocaleString()} / ${target.toLocaleString()}</span>
        <span>{progress.toFixed(1)}%</span>
      </div>

      <div className="mt-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
        <div className="flex justify-between text-[10px]">
          <span className="text-slate-400">Цена покупки 1 DCT:</span>
          <span className="text-blue-300 font-bold">$0.50 (фикс)</span>
        </div>
        <div className="text-[9px] text-slate-500 mt-0.5">
          Партнёр платит $1 USDT → получает 2 DCT по контракту
        </div>
      </div>
    </div>
  )
}

'use client'
/**
 * FractionalLotsAdmin.jsx — Админка фракционных лотов (on-chain FractionalGem)
 * Создание лотов, старт сбора, управление жизненным циклом
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { shortAddress } from '@/lib/web3'
import { safeCall } from '@/lib/contracts'
import * as DCT from '@/lib/dctContracts'

const STATUS_NAMES = ['СОЗДАН', 'СБОР', 'СТЕЙКИНГ', 'ЮВЕЛИРКА', 'ПРОДАЖА', 'ПРОДАН', 'ЗАКРЫТ']
const STATUS_COLORS = ['text-slate-400', 'text-blue-400', 'text-emerald-400', 'text-pink-400', 'text-gold-400', 'text-purple-400', 'text-red-400']

export default function FractionalLotsAdmin() {
  const { wallet, addNotification } = useGameStore()
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [txPending, setTxPending] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedLot, setExpandedLot] = useState(null)

  // Форма создания
  const [form, setForm] = useState({
    gemId: '0',
    caratX100: '',
    name: '',
    imageURI: '',
    certified: false,
    certLab: '0',
    certNumber: '',
    totalFractions: '100',
    fractionPriceDCT: '',
    stakingAPR: '1200',
    stakingDays: '365',
    lotSupplier: '',
  })

  // Формы действий
  const [profitForm, setProfitForm] = useState({ lotId: null, amount: '' })
  const [fundForm, setFundForm] = useState({ lotId: null, amount: '' })
  const [saleForm, setSaleForm] = useState({ lotId: null, amount: '' })
  const [jewelryForm, setJewelryForm] = useState({ lotId: null, cost: '', mode: '0' })

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const l = await DCT.getAllFractionalLots()
      setLots(l || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  // ═══ Создать лот ═══
  const handleCreate = async () => {
    if (!form.caratX100 || !form.name || !form.fractionPriceDCT) {
      return addNotification('❌ Заполните: караты, название, цена доли')
    }
    setTxPending(true)
    const result = await safeCall(() => DCT.createFractionalLot({
      gemId: parseInt(form.gemId) || 0,
      caratX100: parseInt(form.caratX100),
      name: form.name,
      imageURI: form.imageURI,
      certified: form.certified,
      certLab: parseInt(form.certLab) || 0,
      certNumber: form.certNumber,
      totalFractions: parseInt(form.totalFractions),
      fractionPriceDCT: form.fractionPriceDCT,
      stakingAPR: parseInt(form.stakingAPR),
      stakingDays: parseInt(form.stakingDays),
      lotSupplier: form.lotSupplier || wallet,
    }))
    setTxPending(false)
    if (result.ok) {
      addNotification(`✅ Фракционный лот «${form.name}» создан!`)
      setShowCreate(false)
      setForm({ gemId: '0', caratX100: '', name: '', imageURI: '', certified: false, certLab: '0', certNumber: '', totalFractions: '100', fractionPriceDCT: '', stakingAPR: '1200', stakingDays: '365', lotSupplier: '' })
      reload()
    } else addNotification('❌ ' + result.error)
  }

  // ═══ Действия с лотом ═══
  const doAction = async (label, fn) => {
    setTxPending(true)
    const result = await safeCall(fn)
    setTxPending(false)
    if (result.ok) { addNotification(`✅ ${label}`); reload() }
    else addNotification('❌ ' + result.error)
  }

  const CERT_LABS = ['Нет', 'GIA', 'IGI', 'HRD', 'AGS', 'EGL']

  if (loading) return (
    <div className="px-3 mt-2 text-center py-8">
      <div className="text-2xl animate-spin">💎</div>
      <div className="text-[10px] text-slate-500 mt-2">Загрузка лотов из контракта...</div>
    </div>
  )

  return (
    <div className="space-y-3">

      {/* Счётчик */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-slate-400">
          On-chain лотов: <span className="text-white font-bold">{lots.length}</span>
        </div>
        <button onClick={reload} className="text-[10px] text-gold-400 font-bold">🔄 Обновить</button>
      </div>

      {/* Кнопка создания */}
      <button onClick={() => setShowCreate(!showCreate)}
        className="w-full py-3 rounded-2xl text-[12px] font-black gold-btn">
        {showCreate ? '✕ Закрыть' : '+ Создать фракционный лот'}
      </button>

      {/* ═══ ФОРМА СОЗДАНИЯ ═══ */}
      {showCreate && (
        <div className="p-4 rounded-2xl glass space-y-2" style={{ border: '1px solid rgba(212,168,67,0.2)' }}>
          <div className="text-[13px] font-black text-gold-400 mb-2">💎 Новый фракционный лот (on-chain)</div>

          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Название (напр. Бриллиант 2.5ct VVS1 E)"
            className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] text-slate-500">Караты ×100</label>
              <input value={form.caratX100} onChange={e => setForm(f => ({ ...f, caratX100: e.target.value }))}
                placeholder="250 = 2.50ct" type="number"
                className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-slate-500">Gem ID</label>
              <input value={form.gemId} onChange={e => setForm(f => ({ ...f, gemId: e.target.value }))}
                type="number" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-slate-500">Сертификат</label>
              <select value={form.certLab} onChange={e => setForm(f => ({ ...f, certLab: e.target.value, certified: e.target.value !== '0' }))}
                className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none">
                {CERT_LABS.map((lab, i) => <option key={i} value={i}>{lab}</option>)}
              </select>
            </div>
          </div>

          {form.certified && (
            <input value={form.certNumber} onChange={e => setForm(f => ({ ...f, certNumber: e.target.value }))}
              placeholder="Номер сертификата"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
          )}

          <input value={form.imageURI} onChange={e => setForm(f => ({ ...f, imageURI: e.target.value }))}
            placeholder="URL фото (необязательно)"
            className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-500">Кол-во долей</label>
              <input value={form.totalFractions} onChange={e => setForm(f => ({ ...f, totalFractions: e.target.value }))}
                type="number" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-slate-500">Цена доли (DCT)</label>
              <input value={form.fractionPriceDCT} onChange={e => setForm(f => ({ ...f, fractionPriceDCT: e.target.value }))}
                type="number" step="0.01" placeholder="10.0"
                className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-500">Стейкинг APR (BP)</label>
              <input value={form.stakingAPR} onChange={e => setForm(f => ({ ...f, stakingAPR: e.target.value }))}
                type="number" placeholder="1200 = 12%"
                className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-slate-500">Стейкинг (дней)</label>
              <input value={form.stakingDays} onChange={e => setForm(f => ({ ...f, stakingDays: e.target.value }))}
                type="number" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
            </div>
          </div>

          <div>
            <label className="text-[9px] text-slate-500">Кошелёк поставщика (пусто = вы)</label>
            <input value={form.lotSupplier} onChange={e => setForm(f => ({ ...f, lotSupplier: e.target.value }))}
              placeholder={wallet || '0x...'}
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none font-mono" />
          </div>

          {/* Сводка */}
          {form.caratX100 && form.fractionPriceDCT && form.totalFractions && (
            <div className="p-2.5 rounded-xl bg-gold-400/8 text-[11px] space-y-0.5">
              <div><span className="text-slate-400">Камень: </span><span className="text-white font-bold">{(parseInt(form.caratX100) / 100).toFixed(2)} ct</span></div>
              <div><span className="text-slate-400">Долей: </span><span className="text-white font-bold">{form.totalFractions}</span>
                <span className="text-slate-400"> × </span><span className="text-gold-400 font-bold">{form.fractionPriceDCT} DCT</span>
                <span className="text-slate-400"> = </span><span className="text-emerald-400 font-bold">{(parseInt(form.totalFractions) * parseFloat(form.fractionPriceDCT)).toFixed(0)} DCT</span>
              </div>
              <div><span className="text-slate-400">APR: </span><span className="text-blue-400 font-bold">{(parseInt(form.stakingAPR) / 100).toFixed(1)}%</span>
                <span className="text-slate-400"> на </span><span className="text-white">{form.stakingDays} дней</span>
              </div>
            </div>
          )}

          <button onClick={handleCreate} disabled={txPending}
            className="w-full py-3 rounded-2xl text-[12px] font-black gold-btn disabled:opacity-50">
            {txPending ? '⏳ Транзакция...' : '💎 Создать лот в контракте'}
          </button>
        </div>
      )}

      {/* ═══ СПИСОК ЛОТОВ ═══ */}
      {lots.length === 0 ? (
        <div className="p-6 rounded-2xl glass text-center">
          <div className="text-3xl mb-2">💎</div>
          <div className="text-[11px] text-slate-400">Нет фракционных лотов</div>
        </div>
      ) : (
        <div className="space-y-2">
          {lots.map(lot => {
            const isExpanded = expandedLot === lot.id
            const progress = lot.totalFractions > 0 ? (lot.soldFractions / lot.totalFractions * 100) : 0
            return (
              <div key={lot.id} className="rounded-2xl glass overflow-hidden">
                {/* Шапка лота */}
                <button onClick={() => setExpandedLot(isExpanded ? null : lot.id)}
                  className="w-full p-3 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-black text-white">#{lot.id}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 ${STATUS_COLORS[lot.status] || 'text-slate-400'}`}>
                        {STATUS_NAMES[lot.status] || `S${lot.status}`}
                      </span>
                      {lot.certified && <span className="text-[8px] text-emerald-400">✅</span>}
                    </div>
                    <span className="text-[10px] text-slate-500">{lot.carats} ct</span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-200 truncate">{lot.name || '—'}</div>
                  <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-500">
                    <span>{lot.soldFractions}/{lot.totalFractions} долей</span>
                    <span>{lot.fractionPriceDCT} DCT/доля</span>
                    <span>APR {(lot.stakingAPR / 100).toFixed(1)}%</span>
                  </div>
                  {/* Прогресс-бар */}
                  <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500/50" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                </button>

                {/* Развёрнутая панель управления */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                    {/* Инфо */}
                    <div className="grid grid-cols-2 gap-1 text-[9px]">
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <span className="text-slate-500">Клубная: </span>
                        <span className="text-gold-400 font-bold">${lot.clubPrice}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <span className="text-slate-500">Себестоим.: </span>
                        <span className="text-white font-bold">${lot.costPrice}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <span className="text-slate-500">Стейкинг: </span>
                        <span className="text-emerald-400 font-bold">${lot.stakingReserve}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <span className="text-slate-500">Прибыль: </span>
                        <span className="text-blue-400 font-bold">${lot.totalCycleProfit}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <span className="text-slate-500">Циклов: </span>
                        <span className="text-white font-bold">{lot.cyclesCompleted}</span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/5">
                        <span className="text-slate-500">Поставщик: </span>
                        <span className="text-white font-mono">{shortAddress(lot.supplier)}</span>
                      </div>
                    </div>

                    {/* Кнопки действий по статусу */}
                    <div className="flex flex-wrap gap-1">

                      {/* СОЗДАН → Запустить сбор */}
                      {lot.status === 0 && (
                        <button onClick={() => doAction('Сбор запущен!', () => DCT.startLotFundraising(lot.id))}
                          disabled={txPending}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/15 border border-blue-500/25 text-blue-400 disabled:opacity-50">
                          🚀 Запустить сбор
                        </button>
                      )}

                      {/* СТЕЙКИНГ → Начислить прибыль / Пополнить резерв */}
                      {lot.status === 2 && (
                        <>
                          <button onClick={() => setProfitForm({ lotId: lot.id, amount: '' })}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                            💰 Прибыль цикла
                          </button>
                          <button onClick={() => setFundForm({ lotId: lot.id, amount: '' })}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/15 border border-blue-500/25 text-blue-400">
                            📥 Пополнить резерв
                          </button>
                          <button onClick={() => setJewelryForm({ lotId: lot.id, cost: '', mode: '0' })}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-pink-500/15 border border-pink-500/25 text-pink-400">
                            💍 Ювелирка
                          </button>
                        </>
                      )}

                      {/* СТЕЙКИНГ / ЮВЕЛИРКА → Принудительная продажа */}
                      {(lot.status === 2 || lot.status === 3) && (
                        <button onClick={() => doAction('Лот выставлен на продажу', () => DCT.forceLotForSale(lot.id))}
                          disabled={txPending}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-orange-500/15 border border-orange-500/25 text-orange-400 disabled:opacity-50">
                          🏷 На продажу
                        </button>
                      )}

                      {/* НА ПРОДАЖЕ → Подтвердить продажу */}
                      {lot.status === 4 && (
                        <button onClick={() => setSaleForm({ lotId: lot.id, amount: '' })}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500/15 border border-purple-500/25 text-purple-400">
                          ✅ Подтвердить продажу
                        </button>
                      )}

                      {/* Экстренные действия — для всех активных лотов */}
                      {lot.status < 5 && (
                        <button onClick={() => doAction('Экстренный вывод стейкинга', () => DCT.emergencyLotClaimStaking(lot.id))}
                          disabled={txPending}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/15 border border-red-500/25 text-red-400 disabled:opacity-50">
                          🆘 Экстренный вывод
                        </button>
                      )}
                    </div>

                    {/* ═══ Модалки действий (инлайн) ═══ */}

                    {/* Прибыль цикла */}
                    {profitForm.lotId === lot.id && (
                      <ActionInline
                        title="💰 Начислить прибыль цикла"
                        label="Сумма USDT"
                        value={profitForm.amount}
                        onChange={v => setProfitForm(f => ({ ...f, amount: v }))}
                        onSubmit={() => { doAction('Прибыль начислена!', () => DCT.addLotCycleProfit(lot.id, profitForm.amount)); setProfitForm({ lotId: null, amount: '' }) }}
                        onCancel={() => setProfitForm({ lotId: null, amount: '' })}
                        txPending={txPending}
                      />
                    )}

                    {/* Пополнить резерв */}
                    {fundForm.lotId === lot.id && (
                      <ActionInline
                        title="📥 Пополнить стейкинг-резерв"
                        label="Сумма USDT"
                        value={fundForm.amount}
                        onChange={v => setFundForm(f => ({ ...f, amount: v }))}
                        onSubmit={() => { doAction('Резерв пополнен!', () => DCT.fundLotStakingReserve(lot.id, fundForm.amount)); setFundForm({ lotId: null, amount: '' }) }}
                        onCancel={() => setFundForm({ lotId: null, amount: '' })}
                        txPending={txPending}
                      />
                    )}

                    {/* Подтвердить продажу */}
                    {saleForm.lotId === lot.id && (
                      <ActionInline
                        title="✅ Подтвердить продажу"
                        label="Сумма продажи (USDT)"
                        value={saleForm.amount}
                        onChange={v => setSaleForm(f => ({ ...f, amount: v }))}
                        onSubmit={() => { doAction('Продажа подтверждена!', () => DCT.confirmLotSale(lot.id, saleForm.amount)); setSaleForm({ lotId: null, amount: '' }) }}
                        onCancel={() => setSaleForm({ lotId: null, amount: '' })}
                        txPending={txPending}
                      />
                    )}

                    {/* Ювелирка */}
                    {jewelryForm.lotId === lot.id && (
                      <div className="p-2.5 rounded-xl bg-pink-500/8 border border-pink-500/15 space-y-2">
                        <div className="text-[11px] font-bold text-pink-400">💍 Запрос на ювелирку</div>
                        <input type="number" value={jewelryForm.cost} onChange={e => setJewelryForm(f => ({ ...f, cost: e.target.value }))}
                          placeholder="Стоимость (USDT)"
                          className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
                        <select value={jewelryForm.mode} onChange={e => setJewelryForm(f => ({ ...f, mode: e.target.value }))}
                          className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none">
                          <option value="0">Режим 0 — Стандартный</option>
                          <option value="1">Режим 1 — Премиум</option>
                        </select>
                        <div className="flex gap-2">
                          <button onClick={() => { doAction('Запрос на ювелирку!', () => DCT.requestLotJewelry(lot.id, jewelryForm.cost, parseInt(jewelryForm.mode))); setJewelryForm({ lotId: null, cost: '', mode: '0' }) }}
                            disabled={txPending || !jewelryForm.cost}
                            className="flex-1 py-2 rounded-lg text-[10px] font-bold gold-btn disabled:opacity-50">
                            {txPending ? '⏳' : '💍 Запросить'}
                          </button>
                          <button onClick={() => setJewelryForm({ lotId: null, cost: '', mode: '0' })}
                            className="px-3 py-2 rounded-lg text-[10px] text-slate-500 border border-white/8">✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Inline-форма для одного числового поля + подтверждение */
function ActionInline({ title, label, value, onChange, onSubmit, onCancel, txPending }) {
  return (
    <div className="p-2.5 rounded-xl bg-white/5 border border-white/8 space-y-2">
      <div className="text-[11px] font-bold text-gold-400">{title}</div>
      <div>
        <label className="text-[9px] text-slate-500">{label}</label>
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          placeholder="0.00" step="0.01"
          className="w-full p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={onSubmit} disabled={txPending || !value}
          className="flex-1 py-2 rounded-lg text-[10px] font-bold gold-btn disabled:opacity-50">
          {txPending ? '⏳' : '✅ Подтвердить'}
        </button>
        <button onClick={onCancel}
          className="px-3 py-2 rounded-lg text-[10px] text-slate-500 border border-white/8">✕</button>
      </div>
    </div>
  )
}

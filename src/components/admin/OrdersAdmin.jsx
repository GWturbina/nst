'use client'
import { useState, useEffect } from 'react'
import useGameStore from '@/lib/store'
import {
  CLARITIES, WHITE_COLORS, FANCY_COLORS, FANCY_INTENSITIES, SHAPES, REGIONS,
  getWhiteCost, getWhiteCostCert, getFancyCost, getFancyCostCert,
  getFancyIntMult, getShapeMultipliers, getRegionMarkups,
  getClubDiscount, getNstBonusMax, getNstPerPercent,
  saveWhiteCost, saveWhiteCostCert, saveFancyCost, saveFancyCostCert,
  saveFancyIntMult, saveShapeMultipliers, saveRegionMarkups,
  saveClubDiscount, saveNstBonusMax, saveNstPerPercent,
  resetAllPrices, exportAllPrices, importAllPrices, formatUSD
} from '@/lib/gemCatalog'

export default function GemPriceAdmin() {
  const { addNotification } = useGameStore()
  const [tab, setTab] = useState('white_no')
  const [wNo, setWNo] = useState({})
  const [wCert, setWCert] = useState({})
  const [fNo, setFNo] = useState({})
  const [fCert, setFCert] = useState({})
  const [fInt, setFInt] = useState({})
  const [shapeMult, setShapeMult] = useState({})
  const [regionMk, setRegionMk] = useState({})
  const [clubDisc, setClubDisc] = useState(30)
  const [nstMax, setNstMax] = useState(3)
  const [nstPer, setNstPer] = useState(1000)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setWNo(getWhiteCost()); setWCert(getWhiteCostCert())
    setFNo(getFancyCost()); setFCert(getFancyCostCert())
    setFInt(getFancyIntMult()); setShapeMult(getShapeMultipliers())
    setRegionMk(getRegionMarkups())
    setClubDisc(getClubDiscount()); setNstMax(getNstBonusMax()); setNstPer(getNstPerPercent())
  }, [])

  const handleSave = () => {
    saveWhiteCost(wNo); saveWhiteCostCert(wCert)
    saveFancyCost(fNo); saveFancyCostCert(fCert)
    saveFancyIntMult(fInt); saveShapeMultipliers(shapeMult)
    saveRegionMarkups(regionMk)
    saveClubDiscount(clubDisc); saveNstBonusMax(nstMax); saveNstPerPercent(nstPer)
    setDirty(false)
    addNotification('✅ 💰 Все цены сохранены')
  }

  const handleReset = () => {
    if (!confirm('Сбросить ВСЕ цены к дефолтным?')) return
    resetAllPrices()
    setWNo(getWhiteCost()); setWCert(getWhiteCostCert())
    setFNo(getFancyCost()); setFCert(getFancyCostCert())
    setFInt(getFancyIntMult()); setShapeMult(getShapeMultipliers())
    setRegionMk(getRegionMarkups())
    setClubDisc(getClubDiscount()); setNstMax(getNstBonusMax()); setNstPer(getNstPerPercent())
    setDirty(false)
    addNotification('🔄 Цены сброшены')
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(exportAllPrices(), null, 2)], {type:'application/json'})
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `diamond-prices-${Date.now()}.json`; a.click()
    addNotification('📥 Экспортировано')
  }

  const handleImport = (e) => {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = (ev) => {
      try {
        importAllPrices(JSON.parse(ev.target.result))
        setWNo(getWhiteCost()); setWCert(getWhiteCostCert())
        setFNo(getFancyCost()); setFCert(getFancyCostCert())
        setFInt(getFancyIntMult()); setShapeMult(getShapeMultipliers())
        setRegionMk(getRegionMarkups())
        setClubDisc(getClubDiscount()); setNstMax(getNstBonusMax()); setNstPer(getNstPerPercent())
        addNotification('📤 Импортировано')
      } catch (err) { addNotification('❌ ' + err.message) }
    }
    r.readAsText(f)
  }

  // Обновление ячейки матрицы
  const upd = (matrix, setMatrix, clarity, idx, val) => {
    const m = {...matrix}; m[clarity] = [...(m[clarity]||[])]; m[clarity][idx] = parseInt(val)||0
    setMatrix(m); setDirty(true)
  }

  // Матрица белых (компонент)
  const WhiteMatrix = ({data, setData, label}) => (
    <div className="p-3 rounded-2xl glass">
      <div className="text-[10px] font-bold text-slate-400 mb-2">{label} — $ за 1 карат (Round)</div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-center" style={{minWidth:'500px'}}>
          <thead>
            <tr>
              <th className="text-[8px] text-slate-500 p-1 sticky left-0 bg-[#0d1520] z-10"></th>
              {WHITE_COLORS.map(c => <th key={c.id} className="text-[9px] font-bold text-white/70 p-1">{c.id}</th>)}
            </tr>
          </thead>
          <tbody>
            {CLARITIES.map(cl => (
              <tr key={cl.id}>
                <td className="text-[9px] font-bold text-gold-400 p-1 sticky left-0 bg-[#0d1520] z-10">{cl.id}</td>
                {WHITE_COLORS.map((c, idx) => (
                  <td key={c.id} className="p-0.5">
                    <input type="number" value={data[cl.id]?.[idx]||''}
                      onChange={e => upd(data, setData, cl.id, idx, e.target.value)}
                      className="w-full p-1 rounded-lg bg-white/5 border border-white/8 text-[9px] text-white text-center outline-none focus:border-gold-400/30"
                      style={{minWidth:'48px'}} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const TABS = [
    {id:'white_no',  label:'◇ Белые (без серт.)'},
    {id:'white_cert', label:'✅ Белые (с серт.)'},
    {id:'fancy',     label:'🌈 Цветные'},
    {id:'regions',   label:'🌐 Регионы'},
    {id:'shapes',    label:'✂️ Формы'},
    {id:'club',      label:'🎁 Скидки'},
    {id:'backup',    label:'📦 Бэкап'},
  ]

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-black text-gold-400">💰 Управление ценами</div>
        <div className="flex gap-1">
          {dirty && <button onClick={handleSave}
            className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 animate-pulse">
            💾 Сохранить
          </button>}
          <button onClick={handleReset}
            className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">🔄</button>
        </div>
      </div>

      {/* Табы */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 overflow-x-auto scrollbar-hide">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-2 py-1.5 rounded-lg text-[8px] font-bold whitespace-nowrap transition-all ${
              tab===tb.id ? 'bg-gold-400/12 text-gold-400' : 'text-slate-500'
            }`}>{tb.label}</button>
        ))}
      </div>

      {/* Белые БЕЗ серт */}
      {tab === 'white_no' && <WhiteMatrix data={wNo} setData={setWNo} label="💲 СЕБЕСТОИМОСТЬ без сертификата" />}

      {/* Белые С серт */}
      {tab === 'white_cert' && <WhiteMatrix data={wCert} setData={setWCert} label="✅ СЕБЕСТОИМОСТЬ с сертификатом" />}

      {/* Цветные */}
      {tab === 'fancy' && (
        <div className="space-y-2">
          <div className="p-3 rounded-2xl glass">
            <div className="text-[10px] font-bold text-slate-400 mb-2">💲 Цветные БЕЗ сертификата ($/карат, Light, VS1)</div>
            <div className="space-y-1.5">
              {FANCY_COLORS.map(fc => (
                <div key={fc.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/3">
                  <div className="w-5 h-5 rounded-full" style={{background:fc.hex}} />
                  <span className="text-[10px] font-bold text-white flex-1">{fc.name}</span>
                  <span className="text-[8px] text-slate-500">$</span>
                  <input type="number" value={fNo[fc.id]||''}
                    onChange={e => { setFNo({...fNo, [fc.id]: parseInt(e.target.value)||0}); setDirty(true) }}
                    className="w-20 p-1.5 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white text-right outline-none focus:border-gold-400/30" />
                </div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-2xl glass">
            <div className="text-[10px] font-bold text-slate-400 mb-2">✅ Цветные С сертификатом ($/карат, Light, VS1)</div>
            <div className="space-y-1.5">
              {FANCY_COLORS.map(fc => (
                <div key={fc.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/3">
                  <div className="w-5 h-5 rounded-full" style={{background:fc.hex}} />
                  <span className="text-[10px] font-bold text-white flex-1">{fc.name}</span>
                  <span className="text-[8px] text-slate-500">$</span>
                  <input type="number" value={fCert[fc.id]||''}
                    onChange={e => { setFCert({...fCert, [fc.id]: parseInt(e.target.value)||0}); setDirty(true) }}
                    className="w-20 p-1.5 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white text-right outline-none focus:border-gold-400/30" />
                </div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-2xl glass">
            <div className="text-[10px] font-bold text-slate-400 mb-2">📊 Множители интенсивности</div>
            <div className="space-y-1.5">
              {FANCY_INTENSITIES.map(fi => (
                <div key={fi.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/3">
                  <span className="text-[10px] font-bold text-white flex-1">{fi.name} ({fi.nameEn})</span>
                  <span className="text-[8px] text-slate-500">×</span>
                  <input type="number" step="0.1" value={fInt[fi.id]??''}
                    onChange={e => { setFInt({...fInt, [fi.id]: parseFloat(e.target.value)||0}); setDirty(true) }}
                    className="w-16 p-1.5 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white text-center outline-none focus:border-gold-400/30" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* РЕГИОНЫ */}
      {tab === 'regions' && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] font-bold text-slate-400 mb-1">🌐 Наценка по регионам (% сверх себестоимости)</div>
          <div className="text-[8px] text-slate-600 mb-3">Розничная = Себестоимость × (1 + наценка%)</div>
          <div className="space-y-2">
            {REGIONS.map(r => (
              <div key={r.id} className="p-2.5 rounded-xl bg-white/3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-white">{r.name}</span>
                  <span className="text-[13px] font-black text-gold-400">+{regionMk[r.id] || 0}%</span>
                </div>
                <input type="range" min={0} max={300} value={regionMk[r.id]||0}
                  onChange={e => { setRegionMk({...regionMk, [r.id]: parseInt(e.target.value)}); setDirty(true) }}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{background:`linear-gradient(to right, #ffd700 ${(regionMk[r.id]||0)/300*100}%, rgba(255,255,255,0.08) 0%)`}} />
                <div className="flex justify-between text-[8px] text-slate-600 mt-1">
                  <span>0%</span>
                  <span className="text-emerald-400">
                    Пример: себест. $1000 → розница {formatUSD(1000 * (1 + (regionMk[r.id]||0)/100))}
                  </span>
                  <span>300%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ФОРМЫ */}
      {tab === 'shapes' && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] font-bold text-slate-400 mb-2">✂️ Коэффициент формы (Round = 1.00)</div>
          <div className="space-y-1.5">
            {SHAPES.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/3">
                <span className="text-[10px] font-bold text-white flex-1">{s.name}</span>
                <span className="text-[8px] text-slate-500">×</span>
                <input type="number" step="0.01" min="0.1" max="2.0" value={shapeMult[s.id]??''}
                  onChange={e => { setShapeMult({...shapeMult, [s.id]: parseFloat(e.target.value)||0}); setDirty(true) }}
                  className="w-16 p-1.5 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white text-center outline-none focus:border-gold-400/30" />
                <span className="text-[8px] text-slate-500 w-14 text-right">{Math.round((shapeMult[s.id]||0)*100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* КЛУБНЫЕ СКИДКИ */}
      {tab === 'club' && (
        <div className="p-3 rounded-2xl glass space-y-3">
          <div className="text-[10px] font-bold text-slate-400 mb-2">🎁 Клубные скидки</div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-white font-bold">Базовая скидка от розницы</span>
              <span className="text-[13px] font-black text-gold-400">{clubDisc}%</span>
            </div>
            <input type="range" min={0} max={60} value={clubDisc}
              onChange={e => { setClubDisc(parseInt(e.target.value)); setDirty(true) }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{background:`linear-gradient(to right, #ffd700 ${clubDisc/60*100}%, rgba(255,255,255,0.08) 0%)`}} />
            <div className="text-[8px] text-slate-600 mt-1">Клубная = Розничная × {(100 - clubDisc)}%</div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-white font-bold">Макс. бонус за DCT</span>
              <span className="text-[13px] font-black text-purple-400">+{nstMax}%</span>
            </div>
            <input type="range" min={0} max={15} value={nstMax}
              onChange={e => { setNstMax(parseInt(e.target.value)); setDirty(true) }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{background:`linear-gradient(to right, #a855f7 ${nstMax/15*100}%, rgba(255,255,255,0.08) 0%)`}} />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-white font-bold">DCT на 1% скидки</span>
              <span className="text-[13px] font-black text-purple-400">{nstPer} DCT</span>
            </div>
            <input type="number" value={nstPer}
              onChange={e => { setNstPer(parseInt(e.target.value)||100); setDirty(true) }}
              className="w-full p-2 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white outline-none focus:border-gold-400/30" />
            <div className="text-[8px] text-slate-600 mt-1">Пример: {nstPer * 2} DCT = +2% доп. скидка</div>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
            <div className="text-[9px] text-emerald-400 font-bold mb-1">Итого для клиента с {nstPer * nstMax} DCT:</div>
            <div className="text-[10px] text-white">
              Розничная −{clubDisc}% (базовая) −{nstMax}% (DCT) = <span className="font-bold text-gold-400">−{clubDisc + nstMax}% от розницы</span>
            </div>
          </div>
        </div>
      )}

      {/* БЭКАП */}
      {tab === 'backup' && (
        <div className="p-3 rounded-2xl glass space-y-3">
          <div className="text-[10px] font-bold text-slate-400">📦 Бэкап и восстановление</div>
          <button onClick={handleExport}
            className="w-full py-3 rounded-xl text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            📥 Экспорт всех цен в JSON
          </button>
          <label className="w-full py-3 rounded-xl text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center cursor-pointer">
            📤 Импорт цен из JSON
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <div className="text-[8px] text-slate-600">
            Экспорт сохраняет: 2 матрицы белых, 2 цены цветных, множители форм и интенсивности, наценки регионов, скидки клуба.
          </div>
        </div>
      )}
    </div>
  )
}

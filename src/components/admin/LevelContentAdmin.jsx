'use client'
/**
 * LevelContentAdmin.jsx — Редактор текстов уровней
 * Переключаешь уровень → редактируешь мотивационные тексты → сохраняешь
 * Также переключает тему для визуального превью
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import { LEVELS } from '@/lib/gameData'
import { authFetch } from '@/lib/authClient'

export default function LevelContentAdmin() {
  const { wallet, addNotification, setLevel } = useGameStore()
  const [allTexts, setAllTexts] = useState({}) // { level: { thoughts: [...], description: '' } }
  const [selectedLevel, setSelectedLevel] = useState(0)
  const [editing, setEditing] = useState('') // textarea content (one thought per line)
  const [editDesc, setEditDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Загрузка всех текстов
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/level-content')
      const data = await res.json()
      if (data.ok && data.levels) {
        const map = {}
        for (const row of data.levels) {
          map[row.level] = { thoughts: row.thoughts || [], description: row.description || '' }
        }
        setAllTexts(map)
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  // При смене уровня — загрузить тексты в редактор + переключить тему
  useEffect(() => {
    const data = allTexts[selectedLevel]
    const defaultThoughts = LEVELS[selectedLevel]?.thought ? [LEVELS[selectedLevel].thought] : []
    const thoughts = data?.thoughts?.length > 0 ? data.thoughts : defaultThoughts
    setEditing(thoughts.join('\n'))
    setEditDesc(data?.description || LEVELS[selectedLevel]?.desc || '')
    setDirty(false)
    setLevel(selectedLevel) // визуальное переключение темы
  }, [selectedLevel, allTexts, setLevel])

  // Сохранение
  const handleSave = async () => {
    const thoughts = editing.split('\n').map(s => s.trim()).filter(s => s.length > 0)
    if (thoughts.length === 0) return addNotification('❌ Добавьте хотя бы один текст')

    setSaving(true)
    try {
      const res = await authFetch('/api/level-content', {
        method: 'POST',
        body: { wallet, level: selectedLevel, thoughts, description: editDesc }
      })
      const data = await res.json()
      if (data.ok) {
        addNotification(`✅ Уровень ${selectedLevel} — ${data.count} текстов сохранено`)
        setDirty(false)
        // Обновляем локальный кеш
        setAllTexts(prev => ({ ...prev, [selectedLevel]: { thoughts, description: editDesc } }))
      } else addNotification(`❌ ${data.error}`)
    } catch { addNotification('❌ Ошибка сети') }
    setSaving(false)
  }

  const lv = LEVELS[selectedLevel]
  const thoughtsArray = editing.split('\n').filter(s => s.trim().length > 0)
  const hasCustom = allTexts[selectedLevel]?.thoughts?.length > 0

  if (loading) return (
    <div className="text-center py-8">
      <div className="text-2xl animate-spin">🗺</div>
      <div className="text-[10px] text-slate-500 mt-2">Загрузка...</div>
    </div>
  )

  return (
    <div className="space-y-3">

      {/* ═══ Выбор уровня ═══ */}
      <div className="grid grid-cols-5 gap-1">
        {LEVELS.map((l, i) => {
          const hasTexts = allTexts[i]?.thoughts?.length > 0
          return (
            <button key={i} onClick={() => setSelectedLevel(i)}
              className={`py-2 rounded-xl text-[9px] font-bold border transition-all relative ${
                selectedLevel === i
                  ? 'border-gold-400/40 text-gold-400'
                  : 'border-white/8 text-slate-500'
              }`}
              style={selectedLevel === i ? { background: `${l.color}15` } : {}}>
              <span className="text-sm">{l.emoji}</span>
              <div>Lv.{i}</div>
              {hasTexts && (
                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          )
        })}
      </div>

      {/* ═══ Инфо выбранного уровня ═══ */}
      <div className="p-3 rounded-2xl border" style={{ background: `${lv.color}08`, borderColor: `${lv.color}25` }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border"
            style={{ borderColor: `${lv.color}40`, background: `${lv.color}15` }}>
            {lv.emoji}
          </div>
          <div>
            <div className="text-[13px] font-black" style={{ color: lv.color }}>
              Lv.{selectedLevel} — {lv.name}
            </div>
            <div className="text-[10px] text-slate-500">{lv.sub} • +{lv.dctPerTap} DCT/тап</div>
          </div>
          <div className="ml-auto text-right">
            <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${hasCustom ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400'}`}>
              {hasCustom ? `✅ ${allTexts[selectedLevel].thoughts.length} текстов` : '⚠️ Дефолт'}
            </div>
          </div>
        </div>

        {/* Описание */}
        <div className="mb-2">
          <label className="text-[9px] text-slate-500 mb-1 block">Описание уровня (для карточки)</label>
          <input value={editDesc} onChange={e => { setEditDesc(e.target.value); setDirty(true) }}
            placeholder="Краткое описание..."
            className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none" />
        </div>

        {/* Тексты-мысли */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[9px] text-slate-500">Мотивационные тексты (по одному на строку)</label>
            <span className="text-[9px] text-slate-600">{thoughtsArray.length}/20</span>
          </div>
          <textarea value={editing}
            onChange={e => { setEditing(e.target.value); setDirty(true) }}
            placeholder={"Каждая строка — отдельный текст.\nПоказывается при тапе по очереди.\nМакс 20 текстов, до 200 символов каждый."}
            rows={6}
            className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white outline-none resize-none leading-relaxed font-mono" />
        </div>

        {/* Превью */}
        {thoughtsArray.length > 0 && (
          <div className="mb-2">
            <div className="text-[9px] text-slate-500 mb-1">👁 Превью (как видит пользователь при тапе):</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {thoughtsArray.map((t, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px]"
                  style={{ background: `${lv.color}10`, border: `1px solid ${lv.color}20` }}>
                  <span style={{ color: lv.color }}>{lv.emoji}</span>
                  <span className="text-slate-300">{t.slice(0, 200)}</span>
                  {t.length > 200 && <span className="text-red-400 text-[8px]">✂️</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !dirty}
            className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all ${
              dirty ? 'gold-btn' : 'bg-white/5 text-slate-600 border border-white/8'
            }`}
            style={{ opacity: saving ? 0.5 : 1 }}>
            {saving ? '⏳ Сохранение...' : dirty ? '💾 Сохранить' : '✅ Сохранено'}
          </button>
          {hasCustom && (
            <button onClick={() => {
              const defaultT = LEVELS[selectedLevel]?.thought ? [LEVELS[selectedLevel].thought] : ['']
              setEditing(defaultT.join('\n'))
              setEditDesc(LEVELS[selectedLevel]?.desc || '')
              setDirty(true)
            }}
              className="px-3 py-2.5 rounded-xl text-[10px] font-bold text-orange-400 border border-orange-500/20 bg-orange-500/8">
              🔄 Сброс
            </button>
          )}
        </div>
      </div>

      {/* ═══ Обзор всех уровней ═══ */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-slate-400 mb-2">📊 Статус текстов по уровням</div>
        <div className="grid grid-cols-4 gap-1">
          {LEVELS.map((l, i) => {
            const count = allTexts[i]?.thoughts?.length || 0
            return (
              <button key={i} onClick={() => setSelectedLevel(i)}
                className="p-1.5 rounded-lg text-center text-[9px] border transition-all"
                style={{
                  background: count > 0 ? `${l.color}08` : 'rgba(255,255,255,0.02)',
                  borderColor: count > 0 ? `${l.color}20` : 'rgba(255,255,255,0.05)',
                }}>
                <span>{l.emoji}</span>
                <div className={count > 0 ? 'text-emerald-400 font-bold' : 'text-slate-600'}>{count || '—'}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import useGameStore from '@/lib/store'
import OrdersAdmin, { StaffAdmin } from '@/components/admin/OrdersAdmin'
import PriceAdmin from '@/components/admin/PriceAdmin'
import LotsAdmin from '@/components/admin/LotsAdmin'
import FractionalLotsAdmin from '@/components/admin/FractionalLotsAdmin'
import ShowcaseAdmin from '@/components/admin/ShowcaseAdmin'
import LevelContentAdmin from '@/components/admin/LevelContentAdmin'
import BoostConfigAdmin from '@/components/admin/BoostConfigAdmin'

export default function AdminPanel() {
  const { wallet, isAdmin, ownerWallet, addNotification,
    news, quests, addNews, removeNews, addQuest, removeQuest, setLevel, t } = useGameStore()

  const [activeSection, setActiveSection] = useState('content')
  const [newNews, setNewNews] = useState('')
  const [newQuest, setNewQuest] = useState({ name: '', reward: '' })
  const [showGuide, setShowGuide] = useState(false)

  const isOwner = isAdmin || (wallet && ownerWallet && wallet.toLowerCase() === ownerWallet.toLowerCase())

  const SECTIONS = [
    { id: 'content', icon: '📢', label: 'Контент' },
    { id: 'lots', icon: '🎟', label: 'Лоты' },
    { id: 'fractional', icon: '🧩', label: 'Фракции' },
    { id: 'orders', icon: '📋', label: 'Заказы' },
    { id: 'showcase', icon: '🏪', label: 'Витрина' },
    { id: 'staff', icon: '👥', label: 'Сотрудники' },
    { id: 'prices', icon: '💲', label: 'Цены' },
    { id: 'boost', icon: '🚀', label: 'Буст' },
    { id: 'test', icon: '🗺', label: 'Уровни' },
  ]

  if (!isOwner) {
    return (
      <div className="p-6 text-center">
        <div className="text-3xl mb-2">🔒</div>
        <div className="text-sm text-slate-400">Только для администратора</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <h2 className="text-lg font-black text-gold-400">⚙️ Админ Diamond Club</h2>
        <button onClick={() => setShowGuide(!showGuide)}
          className="w-7 h-7 rounded-full bg-gold-400/15 border border-gold-400/25 text-gold-400 text-[12px] font-bold flex items-center justify-center shrink-0">
          ?
        </button>
      </div>

      {/* Навигация — СЕТКА вместо скролла */}
      <div className="grid grid-cols-5 gap-1 px-3 mt-1">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${activeSection === s.id ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* ИНСТРУКЦИЯ АДМИНА */}
      {showGuide && <AdminGuide onClose={() => setShowGuide(false)} />}

      <div className="px-3 mt-3">
        {/* КОНТЕНТ */}
        {activeSection === 'content' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[12px] font-bold text-gold-400 mb-2">📢 Новости</div>
              <div className="space-y-1">
                {news.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-[11px] border-b border-white/5">
                    <span className="flex-1 text-white">{n}</span>
                    <button onClick={() => removeNews(i)} className="text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={newNews} onChange={e => setNewNews(e.target.value)}
                  placeholder="Текст новости..." className="flex-1 p-2 rounded-lg bg-white/5 text-[11px] text-white outline-none" />
                <button onClick={() => { if (newNews.trim()) { addNews(newNews.trim()); setNewNews('') } }}
                  className="px-3 py-2 rounded-lg text-[10px] font-bold gold-btn">+</button>
              </div>
            </div>

            <div className="p-3 rounded-2xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
              <div className="text-[12px] font-bold text-emerald-400 mb-2">🎯 Квесты</div>
              <div className="space-y-1">
                {quests.map((q, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 text-[11px] border-b border-white/5">
                    <span className={`flex-1 ${q.done ? 'text-emerald-400 line-through' : 'text-white'}`}>{q.name}</span>
                    <span className="text-gold-400 text-[10px]">{q.reward}</span>
                    <button onClick={() => removeQuest(i)} className="text-red-400 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={newQuest.name} onChange={e => setNewQuest(q => ({ ...q, name: e.target.value }))}
                  placeholder="Квест..." className="flex-1 p-2 rounded-lg bg-white/5 text-[11px] text-white outline-none" />
                <input value={newQuest.reward} onChange={e => setNewQuest(q => ({ ...q, reward: e.target.value }))}
                  placeholder="Награда" className="w-20 p-2 rounded-lg bg-white/5 text-[11px] text-white outline-none" />
                <button onClick={() => { if (newQuest.name.trim()) { addQuest({ ...newQuest, done: false }); setNewQuest({ name: '', reward: '' }) } }}
                  className="px-3 py-2 rounded-lg text-[10px] font-bold gold-btn">+</button>
              </div>
            </div>
          </div>
        )}

        {/* ЛОТЫ */}
        {activeSection === 'lots' && <LotsAdmin />}

        {/* ФРАКЦИИ (on-chain FractionalGem) */}
        {activeSection === 'fractional' && <FractionalLotsAdmin />}

        {/* ЗАКАЗЫ */}
        {activeSection === 'orders' && <OrdersAdmin />}

        {/* ВИТРИНА */}
        {activeSection === 'showcase' && <ShowcaseAdmin />}

        {/* СОТРУДНИКИ */}
        {activeSection === 'staff' && <StaffAdmin />}

        {/* ЦЕНЫ */}
        {activeSection === 'prices' && <PriceAdmin />}

        {/* БУСТ — пороги UserBoost */}
        {activeSection === 'boost' && <BoostConfigAdmin />}

        {/* УРОВНИ — тексты + превью тем */}
        {activeSection === 'test' && <LevelContentAdmin />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// ADMIN GUIDE — Подробная инструкция по админке
// ═══════════════════════════════════════════════════════
function AdminGuide({ onClose }) {
  const [tab, setTab] = useState('overview')

  const TABS = [
    { id: 'overview', label: '📌 Обзор' },
    { id: 'lots', label: '🎟 Лоты' },
    { id: 'fractional', label: '🧩 Фракции' },
    { id: 'orders', label: '📋 Заказы' },
    { id: 'showcase', label: '🏪 Витрина' },
    { id: 'staff', label: '👥 Персонал' },
    { id: 'prices', label: '💲 Цены' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.9)' }} onClick={onClose}>
      <div className="max-w-[430px] w-full max-h-[88vh] rounded-3xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ background: 'linear-gradient(180deg, #1a1040 0%, #0c0c1e 100%)', border: '1px solid rgba(212,168,67,0.25)' }}>

        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between shrink-0">
          <div className="text-[14px] font-black text-gold-400">📖 Инструкция Админа</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 text-slate-400 flex items-center justify-center text-[14px]">✕</button>
        </div>

        <div className="grid grid-cols-4 gap-1 px-3 py-2 border-b border-white/5 shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${tab === t.id ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[11px] text-slate-300 leading-[1.7]">

          {tab === 'overview' && (<>
            <GTitle text="📌 Обзор админ-панели" />
            <p>Админ-панель доступна только владельцу кошелька. Здесь 6 разделов:</p>
            <p><b className="text-gold-400">📢 Контент</b> — управление новостями и квестами. Новости отображаются в приложении для всех. Квесты — задания для партнёров с наградами.</p>
            <p><b className="text-gold-400">🎟 Лоты</b> — создание и управление клубными лотами (долевая покупка бриллиантов с розыгрышем).</p>
            <p><b className="text-gold-400">🧩 Фракции</b> — создание и управление фракционными лотами в смарт-контракте FractionalGem (on-chain доли, стейкинг, ювелирка, продажа).</p>
            <p><b className="text-gold-400">📋 Заказы</b> — все заказы камней из конфигуратора. Смена статусов, заметки, история.</p>
            <p><b className="text-gold-400">🏪 Витрина</b> — создание корпоративных товаров, модерация, оформление продаж. Те же товары доступны пользователям в КЛУБ → Магазин.</p>
            <p><b className="text-gold-400">👥 Сотрудники</b> — назначение ролей: Менеджер (утверждает заказы), Оператор (просматривает).</p>
            <p><b className="text-gold-400">💲 Цены</b> — загрузка цен в смарт-контракт FractionalGem. Клубная цена = 65% от рыночной.</p>
            <p><b className="text-gold-400">🎮 Тест</b> — быстрое переключение уровня (только визуально, для тестирования).</p>

            <GTitle text="🏪 Витрина" />
            <p>Витрина теперь управляется из двух мест:</p>
            <p>1. <b className="text-gold-400">Админ → Витрина</b> — создание корпоративных товаров, модерация, смена статусов, оформление продаж</p>
            <p>2. <b className="text-blue-400">КЛУБ → Магазин</b> — партнёры выставляют свои товары (с мин. 4 уровнем GW)</p>
          </>)}

          {tab === 'lots' && (<>
            <GTitle text="🎟 Как создать клубный лот" />
            <p>Клубный лот — это бриллиант, разделённый на доли. Участники покупают доли по $10-100. Когда все доли проданы — один участник получает камень (розыгрыш), остальные — компенсацию через 6 месяцев.</p>

            <GTitle text="📝 Пошагово:" />
            <p>1. Откройте <b className="text-gold-400">Админ → Лоты</b></p>
            <p>2. Нажмите <b className="text-gold-400">«+ Создать новый лот»</b></p>
            <p>3. Заполните форму:</p>
            <p>   • <b>Название</b> — например «Бриллиант 1.5ct VS1 D»</p>
            <p>   • <b>Описание</b> — детали камня</p>
            <p>   • <b>Караты, чистота, цвет</b></p>
            <p>   • <b>Клубная цена камня ($)</b> — стоимость закупки</p>
            <p>   • <b>Цена доли ($)</b> — $25, $50 или $100</p>
            <p>4. Система автоматически рассчитает:</p>
            <p>   • Цена лота = цена камня × 1.25 (25% на расходы)</p>
            <p>   • Количество долей = цена лота ÷ цена доли</p>
            <p>5. <b className="text-red-400">СЕКРЕТ</b> — сгенерируется автоматически. ОБЯЗАТЕЛЬНО сохраните! Он нужен для честного розыгрыша.</p>
            <p>6. Нажмите <b className="text-gold-400">«✨ Создать лот»</b></p>

            <GTitle text="🔧 Управление лотом" />
            <p>• <b>+3/+5 резерв</b> — зарезервировать доли для подарков или промо</p>
            <p>• <b>🎁 Подарить</b> — отдать долю конкретному партнёру бесплатно</p>
            <p>• <b>✕ Отмена</b> — отменить лот (все средства вернутся)</p>

            <GTitle text="💎 Визуализация" />
            <p>У каждого лота есть кнопка <b className="text-blue-400">💎</b> — открывает интерактивный бриллиант с 100 гранями. Каждая грань = доля. Можно нажимать на грани, выбирать и покупать.</p>
          </>)}

          {tab === 'fractional' && (<>
            <GTitle text="🧩 Фракционные лоты (on-chain)" />
            <p>Фракционные лоты — это камни, разделённые на доли через смарт-контракт FractionalGem. Каждая доля — ERC-1155 токен. Отличие от клубных лотов: всё on-chain, доли торгуются на DEX, есть стейкинг-доход.</p>

            <GTitle text="📝 Как создать:" />
            <p>1. Откройте <b className="text-gold-400">Админ → Фракции</b></p>
            <p>2. Нажмите <b className="text-gold-400">«+ Создать фракционный лот»</b></p>
            <p>3. Заполните: название, караты (×100, т.е. 250 = 2.50ct), кол-во долей, цена доли в DCT</p>
            <p>4. Укажите APR стейкинга (в BP: 1200 = 12%) и период в днях</p>
            <p>5. Подтвердите транзакцию в SafePal — лот создаётся в контракте</p>

            <GTitle text="🔄 Жизненный цикл лота:" />
            <p><b className="text-slate-400">СОЗДАН</b> → <b className="text-blue-400">СБОР</b> → <b className="text-emerald-400">СТЕЙКИНГ</b> → <b className="text-pink-400">ЮВЕЛИРКА</b> → <b className="text-gold-400">ПРОДАЖА</b> → <b className="text-purple-400">ПРОДАН</b></p>
            <p>После создания нажмите <b className="text-blue-400">«🚀 Запустить сбор»</b> — партнёры смогут покупать доли за DCT.</p>
            <p>Когда доли проданы — лот переходит в стейкинг. Вы начисляете прибыль кнопкой <b className="text-emerald-400">«💰 Прибыль цикла»</b>.</p>

            <GTitle text="🔧 Действия админа:" />
            <p>• <b className="text-emerald-400">💰 Прибыль цикла</b> — начислить USDT прибыль держателям долей</p>
            <p>• <b className="text-blue-400">📥 Пополнить резерв</b> — добавить USDT в стейкинг-резерв</p>
            <p>• <b className="text-pink-400">💍 Ювелирка</b> — запустить производство ювелирки из камня</p>
            <p>• <b className="text-orange-400">🏷 На продажу</b> — принудительно выставить лот на продажу</p>
            <p>• <b className="text-purple-400">✅ Подтвердить продажу</b> — зафиксировать сумму продажи, средства распределятся по долям</p>
            <p>• <b className="text-red-400">🆘 Экстренный вывод</b> — аварийный вывод стейкинга (только owner)</p>
          </>)}

          {tab === 'orders' && (<>
            <GTitle text="📋 Управление заказами" />
            <p>Здесь отображаются все заказы камней из конфигуратора (КЛУБ → Камни). Каждый заказ проходит цепочку статусов:</p>

            <p><b className="text-yellow-400">💰 Оплачен</b> — партнёр оплатил, заказ ожидает проверки</p>
            <p><b className="text-emerald-400">✅ Утверждён</b> — вы проверили и одобрили заказ</p>
            <p><b className="text-blue-400">🏭 Производство</b> — камень заказан на заводе</p>
            <p><b className="text-purple-400">📦 Готов</b> — камень получен, готов к выдаче</p>
            <p><b className="text-green-400">🎉 Выдан</b> — камень выдан партнёру</p>
            <p><b className="text-red-400">❌ Отменён</b> — заказ отменён</p>

            <GTitle text="🔧 Что можно делать:" />
            <p>• Менять статус заказа (кнопки смены статуса)</p>
            <p>• Добавлять заметки к заказу</p>
            <p>• Просматривать историю изменений</p>
            <p>• Фильтровать по статусу</p>

            <GTitle text="👥 Роли в заказах:" />
            <p>• <b className="text-gold-400">Владелец</b> — полные права, все статусы</p>
            <p>• <b className="text-emerald-400">Менеджер</b> — утверждает заказы (с лимитом суммы)</p>
            <p>• <b className="text-blue-400">Оператор</b> — только просмотр и заметки</p>
          </>)}

          {tab === 'showcase' && (<>
            <GTitle text="🏪 Витрина Diamond Club" />
            <p>Витрина — ваш магазин. Теперь управление доступно из <b className="text-gold-400">Админ → Витрина</b>.</p>

            <GTitle text="📝 Из админки вы можете:" />
            <p>1. <b className="text-gold-400">Создать корпоративный товар</b> — бриллиант или ювелирку с фото, видео, сертификатом</p>
            <p>2. <b>Просмотреть все товары</b> — фильтр по статусу (активные, скрытые, проданные)</p>
            <p>3. <b>Скрыть/активировать</b> — управление видимостью</p>
            <p>4. <b className="text-emerald-400">Оформить продажу</b> — указать покупателя и адрес доставки</p>

            <GTitle text="👥 Партнёрская витрина:" />
            <p>Партнёры выставляют товары из <b className="text-blue-400">КЛУБ → Магазин</b> (мин. 4 уровень GW). Вы видите их товары в админке и можете модерировать.</p>

            <GTitle text="💰 Маркетинг (15% от маржи):" />
            <p>Пример: закупка $350, продажа $700, маржа $350</p>
            <p>• 5% продавцу • 2% авторские • 3% тех.поддержка</p>
            <p>• 2.5% GWT • 2.5% CGT</p>
            <p>• 90% маржи → 9 уровней (20/15/10/10/9/8/7/6/5%)</p>
          </>)}

          {tab === 'staff' && (<>
            <GTitle text="👥 Управление сотрудниками" />
            <p>Вы можете назначить помощников с разными уровнями доступа.</p>

            <GTitle text="👑 Роли:" />
            <p><b className="text-gold-400">👑 Владелец</b> — полные права. Создание лотов, управление заказами, назначение ролей, управление ценами. Это вы.</p>
            <p><b className="text-emerald-400">🔑 Менеджер</b> — утверждает заказы (с лимитом суммы). Может менять статусы заказов, добавлять заметки. НЕ может: создавать лоты, менять цены, назначать роли.</p>
            <p><b className="text-blue-400">👁 Оператор</b> — только просмотр. Видит заказы, может писать заметки. НЕ может менять статусы.</p>

            <GTitle text="➕ Как добавить сотрудника:" />
            <p>1. Перейдите в <b>Админ → Сотрудники</b></p>
            <p>2. Нажмите <b>«+ Добавить»</b></p>
            <p>3. Введите адрес кошелька сотрудника</p>
            <p>4. Выберите роль (Менеджер или Оператор)</p>
            <p>5. Укажите имя для удобства</p>
            <p>6. Для Менеджера — укажите лимит суммы</p>
          </>)}

          {tab === 'prices' && (<>
            <GTitle text="💲 Управление ценами" />
            <p>Здесь загружаются цены камней в смарт-контракт FractionalGem. Эти цены используются в конфигураторе (КЛУБ → Камни).</p>

            <GTitle text="📊 Как работает ценообразование:" />
            <p>Вы указываете базовую стоимость (без серт. и с серт.) для каждого веса в каратах. Контракт автоматически рассчитывает:</p>
            <p>• <b>Рыночная цена</b> — показывается как «перечёркнутая»</p>
            <p>• <b>Клубная цена</b> = 65% от рыночной</p>
            <p>• <b>Доля поставщика</b> = 60% от клубной</p>
            <p>• <b>Маркетинг-пул</b> = 5% (распределяется по 9 уровням рефералки)</p>

            <GTitle text="➕ Как добавить цену:" />
            <p>1. Перейдите в <b>Админ → Цены</b></p>
            <p>2. Внизу заполните: Караты, Цена без серт. ($), Цена с серт. ($)</p>
            <p>3. Нажмите <b>«Загрузить в контракт»</b></p>
            <p>4. Подтвердите транзакцию в SafePal</p>
            <p>5. Новая цена появится в таблице и в конфигураторе</p>
          </>)}
        </div>

        <div className="px-4 py-3 border-t border-white/8 shrink-0">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-[12px] font-bold gold-btn">✅ Понятно</button>
        </div>
      </div>
    </div>
  )
}

function GTitle({ text }) {
  return <div className="text-[12px] font-black text-gold-400 pt-1">{text}</div>
}

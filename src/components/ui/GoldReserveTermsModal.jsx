'use client'
/**
 * GoldReserveTermsModal — модалка с условиями программы "Золотой пул".
 *
 * Использование:
 *   const [showTerms, setShowTerms] = useState(false)
 *   <button onClick={() => setShowTerms(true)}>Условия</button>
 *   <GoldReserveTermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
 */
import { useEffect } from 'react'

export default function GoldReserveTermsModal({ isOpen, onClose }) {
  // Блокируем скролл фона пока модалка открыта
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  if (!isOpen) return null

  const section = 'mb-4'
  const h = 'text-[13px] font-black text-gold-400 mb-1.5'
  const p = 'text-[12px] text-slate-300 leading-relaxed'
  const li = 'text-[12px] text-slate-300 leading-relaxed'

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="max-w-[480px] w-full rounded-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-card, #14141f)', border: '1px solid rgba(255,215,0,0.25)', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[16px] font-black text-gold-400">💰 Золотой пул</div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
        </div>

        {/* Контент со скроллом */}
        <div className="px-5 py-4 overflow-y-auto">
          <div className={p} style={{ marginBottom: 16 }}>
            <b className="text-white">Золотой пул</b> — это совместный оборотный фонд клуба.
            Участники объединяют средства, а клуб работает ими над своими активами:
            бриллиантами, золотом, ювелирными изделиями. Мы не спекулируем и не играем
            на бирже — клуб работает внутри себя, своими деньгами, по своим правилам,
            для своих участников.
          </div>

          <div className={section}>
            <div className={h}>Как это работает</div>
            <div className={p}>
              Ты вкладываешь USDT и получаешь долю в фонде (1 USDT = 1 доля). Клуб пускает
              средства в оборот. С каждой завершённой сделки участники получают часть
              результата — пропорционально своей доле. Накопленное можно забрать в любой момент.
            </div>
          </div>

          <div className={section}>
            <div className={h}>Куда идут средства фонда</div>
            <div className="space-y-1">
              <div className={li}>1. <b className="text-white">Предоплата за бриллианты</b> — бронь камня у завода-изготовителя</div>
              <div className={li}>2. <b className="text-white">Закупка золота</b> для ювелирных изделий</div>
              <div className={li}>3. <b className="text-white">Оплата работы ювелира</b></div>
              <div className={li}>4. <b className="text-white">Транспортные расходы</b></div>
            </div>
          </div>

          <div className={section}>
            <div className={h}>Как фонд зарабатывает</div>
            <div className="space-y-1">
              <div className={li}>1. Клуб бронирует камень, вносит предоплату из фонда</div>
              <div className={li}>2. Создаётся пул на этот камень</div>
              <div className={li}>3. Первые поступления в пул возвращают предоплату обратно в фонд</div>
              <div className={li}>4. Камень идёт в работу — ювелир + наше золото (закуплено заранее)</div>
              <div className={li}>5. Готовое изделие продаётся, результат распределяется участникам фонда</div>
            </div>
            <div className={p} style={{ marginTop: 8 }}>
              Чем активнее оборот клуба — тем больше движений, тем больше распределяется участникам.
            </div>
          </div>

          <div className={section}>
            <div className={h}>Привилегии участников</div>
            {/* Таблица цен */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="grid grid-cols-3 text-[10px] font-bold text-slate-400 px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div>Вложил</div>
                <div className="text-center">Цена (% от рынка)</div>
                <div className="text-right">С тапалкой</div>
              </div>
              {[
                ['До $100', '50% (клубная)', '45%'],
                ['$100 – $499', '44%', 'до 40%'],
                ['$500 – $999', '39%', 'до 37%'],
                ['$1000+', '—', 'до 35% (себест.)'],
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-3 text-[11px] px-2 py-1.5"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="font-bold text-white">{row[0]}</div>
                  <div className="text-center text-slate-300">{row[1]}</div>
                  <div className="text-right font-bold text-gold-400">{row[2]}</div>
                </div>
              ))}
            </div>
            <div className="space-y-1 mt-2">
              <div className={li}>• <b className="text-white">До $100</b> — участвуешь в результате фонда</div>
              <div className={li}>• <b className="text-white">От $100</b> — участие в фонде <b>плюс</b> покупка камней для себя по внутренней цене, вплоть до себестоимости клуба</div>
            </div>
          </div>

          <div className={section}>
            <div className={h}>Покупка камня — для себя</div>
            <div className={p}>
              Камень в клубе ты приобретаешь <b className="text-white">для личного пользования</b> по
              специальной внутренней цене. Это привилегия участника, а не товар на перепродажу.
              Что ты делаешь с камнем дальше — носишь, хранишь или решаешь распорядиться иначе —
              это твоё личное дело и твоя ответственность, в том числе перед налоговыми органами
              твоей страны. Клуб обеспечивает доступ к активу по честной внутренней цене, не более того.
            </div>
          </div>

          <div className={section}>
            <div className={h}>Масштабирование — собственный клуб</div>
            <div className={p}>
              Участники с вложением <b className="text-white">от $1000</b> и <b className="text-white">уровнем доступа 9+</b> могут
              стать кандидатами на формирование <b className="text-white">собственного Золотого пула</b> — открыть
              клуб в своём городе или стране. Такие участники также получают право создавать
              собственные лоты (камни) и несут за них <b className="text-white">личную ответственность перед своими
              партнёрами</b>. Это часть стратегии клуба: мы растём через сеть локальных клубов,
              где каждый организатор отвечает за свой круг участников.
            </div>
          </div>

          <div className={section}>
            <div className={h}>Условия участия</div>
            <div className="space-y-1">
              <div className={li}>• Минимальный срок участия — <b className="text-white">6 месяцев</b></div>
              <div className={li}>• После 6 месяцев можно забрать средства или продолжить на следующий период</div>
              <div className={li}>• Выход оформляется в порядке очереди и исполняется по мере свободных средств в кассе фонда</div>
              <div className={li}>• Результат фонда зависит от реальной работы клуба и не является фиксированной гарантированной ставкой</div>
            </div>
          </div>

          <div className="p-3 rounded-xl" style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)' }}>
            <div className="text-[12px] font-black text-amber-400 mb-1">Важно понимать</div>
            <div className="text-[11px] text-slate-300 leading-relaxed">
              Золотой пул — это участие в клубной программе, а не банковский вклад и не финансовый
              инструмент с гарантированным процентом. Результат складывается из реального оборота
              клуба и может меняться. Участвуя, ты разделяешь и общий успех клуба, и его рабочие
              риски — как совладелец, а не как кредитор с фиксированной ставкой.
            </div>
          </div>
        </div>

        {/* Кнопка закрытия */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-[14px] font-black text-black"
            style={{ background: 'linear-gradient(135deg,#ffd700,#f5a623)' }}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'
/**
 * NSS Diamond Club v10.2 — Инвестиционный клуб
 * Полная интеграция: GemVaultV2 + DiamondP2P + InsuranceFund + TrustScore + UserBoost + ShowcaseMarket
 * MetalVault отключён (не задеплоен). P2P через DiamondP2P.
 */
import { useState, useEffect, useCallback } from 'react'
import useGameStore from '@/lib/store'
import * as DC from '@/lib/diamondContracts'
import { safeCall } from '@/lib/contracts'
import { shortAddress } from '@/lib/web3'
import ADDRESSES from '@/contracts/addresses'
import GemConfigurator from '@/components/pages/GemConfigurator'
import DeliverySection from '@/components/pages/DeliverySection'
import ShowcaseNew from '@/components/pages/ShowcaseNew'
import GemGallery from '@/components/pages/GemGallery'
import ClubLotsSection from '@/components/pages/ClubLotsSection'
import HelpButton from '@/components/ui/HelpButton'

// ═════════════════════════════════════════════════════════
// MAIN: DiamondClubTab
// ═════════════════════════════════════════════════════════
export default function DiamondClubTab() {
  const { wallet, t, setTab } = useGameStore()
  const [section, setSection] = useState('dashboard')

  const sections = [
    { id: 'dashboard', icon: '📊', label: t('dcDashboard') || 'Обзор' },
    { id: 'lots',      icon: '🎟', label: 'Клубные лоты' },
    { id: 'gems',      icon: '💎', label: t('dcGems') || 'Камни' },
    { id: 'gallery',   icon: '🧩', label: 'Галерея' },
    { id: 'showcase',  icon: '🏪', label: 'Магазин' },
    { id: 'p2p',       icon: '🤝', label: 'P2P' },
    { id: 'boost',     icon: '🚀', label: t('dcBoost') || 'Буст' },
    { id: 'insurance', icon: '🛡️', label: t('dcInsurance') || 'Страховка' },
    { id: 'tournaments', icon: '🏆', label: 'Турниры' },
    { id: 'delivery',  icon: '📦', label: t('dcDelivery') || 'Доставка' },
  ]

return (
    <div className="flex-1 overflow-y-auto pb-4">
      {/* Заголовок + кнопка помощи */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gold-400">♦️ {t('dcTitle') || 'Diamond Club'}</h2>
          <p className="text-[11px] text-slate-500">{t('dcSubtitle') || 'Инвестиционный клуб'}</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton section={section} />
        </div>
      </div>

      {/* Sub-навигация */}
      <div className="grid grid-cols-5 gap-1 px-3 mt-1">
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${
              section === s.id
                ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
                : 'border-white/8 text-slate-500'
            }`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Подключи кошелёк */}
      {!wallet ? (
        <div className="mx-3 mt-4 p-4 rounded-2xl glass text-center">
          <div className="text-3xl mb-2">🔐</div>
          <div className="text-sm font-bold text-slate-300">{t('connectWallet') || 'Подключите кошелёк'}</div>
          <div className="text-[11px] text-slate-500 mt-1">{t('dcConnectHint') || 'SafePal для доступа к Diamond Club'}</div>
        </div>
      ) : (
        <>
          {section === 'dashboard' && <DashboardSection />}
          {section === 'lots' && <ClubLotsSection />}
          {section === 'gems' && <GemsFullSection onGoToDCT={() => setTab('exchange')} />}
          {section === 'gallery' && <GemGallery />}
          {section === 'showcase' && <ShowcaseNew />}
          {section === 'p2p' && <P2PSection />}
          {section === 'insurance' && <InsuranceSection />}
          {section === 'boost' && <BoostSection />}
          {section === 'tournaments' && <TournamentsSection />}
          {section === 'delivery' && <DeliverySection />}
        </>
      )}

      {/* Модалка инструкции — теперь через HelpButton */}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// HELP MODAL — Полная инструкция
// ═════════════════════════════════════════════════════════
function HelpModal({ onClose }) {
  const [tab, setTab] = useState('overview')

  const tabs = [
    { id: 'overview',   icon: '📖', label: 'Обзор' },
    { id: 'gems',       icon: '💎', label: 'Камни' },
    { id: 'staking',    icon: '⏳', label: 'Стейкинг' },
    { id: 'p2p',        icon: '🤝', label: 'P2P' },
    { id: 'showcase',   icon: '🏪', label: 'Магазин' },
    { id: 'insurance',  icon: '🛡️', label: 'Страховка' },
    { id: 'boost',      icon: '🚀', label: 'Буст' },
  ]

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ background: 'linear-gradient(180deg, #1a1a3e 0%, #0f0f2a 100%)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="text-[14px] font-black text-gold-400">📖 Инструкция Diamond Club</div>
          <button onClick={onClose} className="text-slate-500 text-lg">✕</button>
        </div>

        {/* Tab bar — сетка 3×3 */}
        <div className="grid grid-cols-3 gap-1 px-3 py-2 border-b border-white/5">
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`px-2 py-2 rounded-lg text-[11px] font-bold border transition-all ${
                tab === tb.id
                  ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
                  : 'border-white/8 text-slate-500'
              }`}>
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[12px] text-slate-300 leading-relaxed">

          {tab === 'overview' && (<>
            <HelpTitle emoji="♦️" text="Что такое Diamond Club?" />
            <p>Diamond Club — закрытый инвестиционный клуб, в котором участники приобретают настоящие бриллианты по клубной цене, значительно ниже рыночной. Каждый камень — реальный, с возможностью физической доставки.</p>

            <HelpTitle emoji="🔑" text="Как начать?" />
            <HelpSteps steps={[
              'Откройте приложение в браузере SafePal',
              'Подключите кошелёк (сеть opBNB подключится автоматически)',
              'Убедитесь что на балансе есть USDT',
              'Перейдите в раздел «Камни» — выберите параметры бриллианта',
              'Нажмите «Оплатить и заказать»',
              'Ваш заказ будет проверен и отправлен на завод',
            ]} />

            <HelpTitle emoji="💰" text="Что можно делать в клубе" />
            <HelpSteps steps={[
              'Заказать бриллиант по клубной цене (экономия до 65%)',
              'Отправить камень в стейкинг — доход от 50% до 75% годовых',
              'Купить долю дорогого камня — даже за небольшую сумму',
              'Перепродать камень другому участнику через P2P',
              'Получить DCT токены, обеспеченные камнями',
              'Торговать DCT на встроенной бирже',
              'Защитить активы системой наследования',
            ]} />

            <HelpTitle emoji="🔐" text="Безопасность" />
            <p>Все сделки защищены смарт-контрактами на блокчейне opBNB. Никто не может забрать ваши активы — только вы управляете своим кошельком. Страховой фонд покрывает риски. Система TrustScore следит за репутацией участников.</p>
          </>)}

          {tab === 'gems' && (<>
            <HelpTitle emoji="💎" text="Бриллианты клуба" />
            <p>В Diamond Club вы заказываете настоящие бриллианты напрямую от завода-изготовителя. Камень может быть в наличии или изготовлен под ваш заказ.</p>

            <HelpTitle emoji="📋" text="Прайс-лист (клубные цены)" />
            <div className="space-y-1.5 text-[11px]">
              {[
                { ct: '0.30', no: 300, cert: 600 },
                { ct: '0.50', no: 500, cert: 1100 },
                { ct: '1.00', no: 1000, cert: 1900 },
                { ct: '1.50', no: 1600, cert: 3600 },
                { ct: '2.00', no: 2800, cert: 4900 },
                { ct: '2.50', no: 4500, cert: 8500 },
                { ct: '3.00', no: 8500, cert: 15000 },
              ].map(r => (
                <div key={r.ct} className="flex items-center justify-between p-1.5 rounded-lg bg-white/5">
                  <span className="text-gold-400 font-bold">💎 {r.ct} ct</span>
                  <div className="text-right">
                    <span className="text-slate-400">${r.no.toLocaleString()}</span>
                    <span className="text-slate-600 mx-1">|</span>
                    <span className="text-emerald-400 font-bold">${r.cert.toLocaleString()} ✅</span>
                  </div>
                </div>
              ))}
              <div className="text-[9px] text-slate-500 text-center mt-1">
                Слева — без сертификата | Справа — с сертификатом GIA/IGI/HRD
              </div>
            </div>

            <HelpTitle emoji="📜" text="Сертификат — что это?" />
            <p>Наличие сертификата не влияет на качество или подлинность камня — влияет только на цену. Сертификат выдаётся одной из трёх ведущих мировых геммологических лабораторий:</p>
            <div className="space-y-1 text-[11px]">
              <div className="p-1.5 rounded-lg bg-blue-500/8"><b className="text-blue-400">GIA</b> — Gemological Institute of America</div>
              <div className="p-1.5 rounded-lg bg-blue-500/8"><b className="text-blue-400">IGI</b> — International Gemological Institute</div>
              <div className="p-1.5 rounded-lg bg-blue-500/8"><b className="text-blue-400">HRD</b> — Hoge Raad voor Diamant (Антверпен)</div>
            </div>
            <p className="text-[10px] text-slate-500">У каждого сертификата есть серийный номер, который можно проверить на официальном сайте лаборатории.</p>

            <HelpTitle emoji="⚙️" text="Как заказать камень" />
            <HelpSteps steps={[
              'Откройте раздел «Камни» → «Конфигуратор»',
              'Выберите тип (белый / цветной), форму, чистоту, цвет',
              'Укажите вес в каратах и наличие сертификата',
              'Система покажет клубную цену',
              'Выберите режим: Покупка (владение) или Актив (стейкинг)',
              'Нажмите «Оплатить и заказать»',
              'Заказ отправится на проверку и далее на завод',
            ]} />

            <HelpTitle emoji="📦" text="Что происходит после заказа" />
            <HelpSteps steps={[
              '💰 Оплачен — деньги получены, заказ на проверке',
              '✅ Утверждён — заказ проверен, отправлен на завод',
              '🏭 Производство — камень изготавливается или подбирается',
              '📦 Готов — камень готов к выдаче',
              '🎉 Выдан — камень у вас, начисления активированы',
            ]} />
          </>)}

          {tab === 'staking' && (<>
            <HelpTitle emoji="⏳" text="Как работает стейкинг" />
            <p>Стейкинг — это размещение камня на определённый срок. Камень «работает» на вас и приносит доход в USDT. Срок стейкинга — 12 месяцев.</p>

            <HelpTitle emoji="📦" text="Два режима покупки" />
            <p><b className="text-blue-400">Покупка (владение)</b> — камень на вашем адресе. Вы решаете что с ним делать: отправить в стейкинг, продать на P2P или заказать физическую доставку.</p>
            <p><b className="text-emerald-400">Актив (стейкинг)</b> — камень сразу размещается в стейкинг. Начинает приносить доход с первого дня.</p>

            <HelpTitle emoji="📈" text="Процентные ставки" />
            <p>Базовая ставка — 50% годовых. Сжигая GST в разделе «Буст», вы повышаете ставку:</p>
            <div className="grid grid-cols-3 gap-1 text-[10px]">
              <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">0</b><br/>50%</div>
              <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">1K</b><br/>55%</div>
              <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">3K</b><br/>60%</div>
              <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">6K</b><br/>65%</div>
              <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">10K</b><br/>70%</div>
              <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-gold-400">16K</b><br/>75%</div>
            </div>

            <HelpTitle emoji="🏁" text="Через 12 месяцев" />
            <p>Когда стейкинг завершён, у вас три варианта:</p>
            <HelpSteps steps={[
              'Забрать прибыль в USDT — камень остаётся, можно рестейкнуть',
              'Забрать камень физически — оформить доставку',
              'Рестейк — запустить новый период стейкинга',
            ]} />
          </>)}

          {tab === 'p2p' && (<>
            <HelpTitle emoji="🤝" text="P2P торговля" />
            <p>Вы можете продать свой камень другому участнику клуба напрямую, без посредников. Покупатель платит USDT — камень переходит к нему.</p>

            <HelpTitle emoji="📤" text="Как продать" />
            <HelpSteps steps={[
              'Перейдите в «Камни» → «Мои камни»',
              'Найдите камень со статусом OWNED или CLAIMED',
              'Нажмите «Продать P2P»',
              'Укажите вашу цену в USDT',
              'Камень появится на P2P рынке для всех участников',
            ]} />

            <HelpTitle emoji="📥" text="Как купить" />
            <HelpSteps steps={[
              'Перейдите в раздел «P2P»',
              'Выберите предложение и нажмите «Купить»',
              'USDT спишется, камень перейдёт на ваш адрес',
            ]} />

            <HelpTitle emoji="💸" text="Комиссия" />
            <p>Базовая комиссия P2P — 5%. Чем выше ваш TrustScore, тем ниже комиссия.</p>
          </>)}

          {tab === 'showcase' && (<>
            <HelpTitle emoji="🏪" text="Витрина Diamond Club" />
            <p>Витрина — маркетплейс для продажи бриллиантов и ювелирных изделий. Два раздела: Корпоративная (выставляет Админ) и Общая (выставляют партнёры).</p>

            <HelpTitle emoji="🏢" text="Корпоративная витрина" />
            <p>Бриллианты и ювелирные изделия от клуба. Выставляет только администратор. Две категории: Бриллианты и Ювелирка.</p>

            <HelpTitle emoji="👥" text="Общая витрина" />
            <p>Партнёры выставляют свои камни или изделия на продажу. Для доступа нужно минимум 4 уровня в GlobalWay.</p>

            <HelpTitle emoji="💰" text="Маркетинг при продаже (15% от маржи)" />
            <p>Пример: купил камень за $350, продаёт за $700. Маржа = $350.</p>
            <HelpSteps steps={[
              '5% — человеку который продал',
              '2% — авторские',
              '3% — техническая поддержка',
              '2.5% — токеномика GWT',
              '2.5% — токеномика CGT',
              '90% маржи → 9 уровней партнёрки (20/15/10/10/9/8/7/6/5%)',
            ]} />

            <HelpTitle emoji="📦" text="Доставка" />
            <p>При покупке указывается адрес доставки — он шифруется. Только Админ может расшифровать для отправки.</p>

            <HelpTitle emoji="📋" text="Правила" />
            <p>Клубная цена не может быть выше 50% от розничной. Продажа вне клуба — партнёр оплачивает клубную цену со своего кошелька, разницу забирает себе.</p>
          </>)}

          {tab === 'insurance' && (<>
            <HelpTitle emoji="🛡️" text="Страховой фонд" />
            <p>При каждой покупке камня часть средств идёт в страховой фонд на ваш личный баланс. Это ваша подушка безопасности.</p>

            <HelpTitle emoji="💸" text="Как вывести" />
            <HelpSteps steps={[
              'Перейдите в раздел «Страховка»',
              'Укажите сумму и нажмите «Запросить вывод»',
              'Подождите 48 часов (защитная задержка)',
              'Нажмите «Выполнить» — USDT поступят на кошелёк',
            ]} />

            <HelpTitle emoji="📋" text="Верификация" />
            <p>Периодически подтверждайте владение активами — это поддерживает ваш TrustScore.</p>
          </>)}

          {tab === 'boost' && (<>
            <HelpTitle emoji="🚀" text="Буст ставки" />
            <p>Сжигая токены DCT, вы навсегда увеличиваете свою ставку стейкинга. DCT уничтожаются безвозвратно — это повышает ценность оставшихся токенов.</p>

            <HelpTitle emoji="🔥" text="Как это работает" />
            <HelpSteps steps={[
              'Перейдите в раздел «Буст»',
              'Введите количество DCT для сжигания',
              'Нажмите «Сжечь» и подтвердите в кошельке',
              'Ваша ставка повысится при достижении порога',
            ]} />

            <HelpTitle emoji="🎯" text="Репутация (TrustScore)" />
            <p>Ваша репутация в клубе. Растёт от покупок, стейкинга и верификации. Влияет на комиссии и доступ к функциям.</p>
            <p>Уровни: NONE → PROBATION → BRONZE → SILVER → GOLD</p>

            <HelpTitle emoji="💡" text="DCT и Наследство" />
            <p>Разделы DCT (токен, биржа, доли) и Наследство находятся во вкладке <b className="text-emerald-400">💱 Биржа</b> в верхнем меню. Там же — мост, DEX и NFT-витрина.</p>
          </>)}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/8">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-[12px] font-bold gold-btn">
            ✅ Понятно
          </button>
        </div>
      </div>
    </div>
  )
}

function HelpTitle({ emoji, text }) {
  return <div className="text-[13px] font-black text-gold-400 pt-1">{emoji} {text}</div>
}
function HelpSteps({ steps }) {
  return (
    <div className="space-y-1 pl-1">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-gold-400 font-bold shrink-0">{i + 1}.</span>
          <span>{s}</span>
        </div>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// DASHBOARD — Обзор
// ═════════════════════════════════════════════════════════
function DashboardSection() {
  const { wallet, t } = useGameStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wallet) return
    setLoading(true)
    DC.loadDiamondClubDashboard(wallet).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [wallet])

  if (loading) return <Loading />
  if (!data) return <ErrorCard text="Ошибка загрузки" />

  const TIER_COLORS = { NONE: 'text-slate-500', PROBATION: 'text-red-400', BRONZE: 'text-orange-400', SILVER: 'text-slate-300', GOLD: 'text-gold-400' }
  const stakingGems = data.gemPurchases.filter(p => p.status === 1)
  const totalInvested = data.gemPurchases.reduce((s, p) => s + parseFloat(p.pricePaid), 0)

  return (
    <div className="px-3 mt-2 space-y-2">
      {data.frozen && (
        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <div className="text-lg">🚫</div>
          <div className="text-[12px] font-bold text-red-400">Аккаунт заморожен</div>
          <div className="text-[10px] text-red-300/70">Обратитесь в поддержку</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] text-slate-500">Баланс (USDT)</div>
          <div className="text-xl font-black text-gold-400">${parseFloat(data.insuranceBalance).toFixed(2)}</div>
          <div className="text-[9px] text-slate-500">Вывод через 48ч</div>
        </div>
        <div className="p-3 rounded-2xl glass">
          <div className="text-[10px] text-slate-500">TrustScore</div>
          <div className={`text-xl font-black ${TIER_COLORS[data.trustInfo?.tierName] || 'text-slate-500'}`}>
            {data.trustInfo?.score || 0}
          </div>
          <div className={`text-[9px] font-bold ${TIER_COLORS[data.trustInfo?.tierName] || 'text-slate-500'}`}>
            {data.trustInfo?.tierName || 'NONE'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Инвестировано" value={`$${totalInvested.toFixed(0)}`} color="text-gold-400" />
        <StatCard label="В стейкинге" value={stakingGems.length} color="text-emerald-400" />
        <StatCard label="Ставка" value={`${data.boostInfo?.currentRate || 50}%`} color="text-purple-400" />
      </div>

      {stakingGems.length > 0 && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-gold-400 mb-2">💎 Активный стейкинг ({stakingGems.length})</div>
          <div className="space-y-1.5">
            {stakingGems.slice(0, 3).map(p => <StakingRow key={p.id} purchase={p} />)}
            {stakingGems.length > 3 && <div className="text-[9px] text-slate-500 text-center">+{stakingGems.length - 3} ещё</div>}
          </div>
        </div>
      )}

      {parseFloat(data.referralClaimable) > 0 && (
        <div className="p-3 rounded-2xl glass border-emerald-500/15">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-bold text-emerald-400">🎁 Реферальный бонус</div>
              <div className="text-lg font-black text-emerald-400">{parseFloat(data.referralClaimable).toFixed(2)} DCT</div>
            </div>
            <ClaimReferralButton />
          </div>
        </div>
      )}

      {data.gemStats && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-blue-400 mb-2">📈 Статистика клуба</div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-gold-400">${parseFloat(data.gemStats.totalSales).toFixed(0)}</div>
              <div className="text-[9px] text-slate-500">Продажи</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-emerald-400">${parseFloat(data.gemStats.reserve).toFixed(0)}</div>
              <div className="text-[9px] text-slate-500">Резерв</div>
            </div>
            <div className="p-2 rounded-lg bg-white/5">
              <div className="text-[11px] font-black text-blue-400">{data.gemStats.purchases}</div>
              <div className="text-[9px] text-slate-500">Покупок</div>
            </div>
            {data.p2pStats && (
              <div className="p-2 rounded-lg bg-white/5">
                <div className="text-[11px] font-black text-purple-400">{data.p2pStats.trades}</div>
                <div className="text-[9px] text-slate-500">P2P сделок</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// GEMS FULL — Конфигуратор + Мои покупки с управлением + P2P листинг
// ═════════════════════════════════════════════════════════
function GemsFullSection({ onGoToDCT }) {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [view, setView] = useState('configurator')
  const [myPurchases, setMyPurchases] = useState([])
  const [loading, setLoading] = useState(false)
  const [p2pModal, setP2pModal] = useState(null)
  const [p2pPrice, setP2pPrice] = useState('')

  const reloadPurchases = useCallback(async () => {
    if (!wallet) return
    setLoading(true)
    const p = await DC.getUserGemPurchases(wallet).catch(() => [])
    setMyPurchases(p)
    setLoading(false)
  }, [wallet])

  useEffect(() => { reloadPurchases() }, [reloadPurchases])

  const handleClaim = async (purchaseId, option) => {
    setTxPending(true)
    const result = await safeCall(() => DC.claimGemStaking(purchaseId, option))
    setTxPending(false)
    if (result.ok) { addNotification('✅ Стейкинг получен!'); reloadPurchases() }
    else addNotification(`❌ ${result.error}`)
  }

  const handleRestake = async (purchaseId) => {
    setTxPending(true)
    const result = await safeCall(() => DC.restakeGem(purchaseId))
    setTxPending(false)
    if (result.ok) { addNotification('✅ Рестейк выполнен!'); reloadPurchases() }
    else addNotification(`❌ ${result.error}`)
  }

  const handleConvert = async (purchaseId) => {
    setTxPending(true)
    const result = await safeCall(() => DC.convertGemToAsset(purchaseId))
    setTxPending(false)
    if (result.ok) { addNotification('✅ Конвертировано в Актив!'); reloadPurchases() }
    else addNotification(`❌ ${result.error}`)
  }

  const handleListP2P = async () => {
    if (!p2pModal || !p2pPrice || parseFloat(p2pPrice) <= 0) return
    setTxPending(true)
    const vaultAddr = ADDRESSES?.GemVaultV2 || ADDRESSES?.gemVault || '0x0'
    const result = await safeCall(() => DC.listOnP2P(vaultAddr, p2pModal.id, p2pPrice))
    setTxPending(false)
    if (result.ok) {
      addNotification(`✅ 🏪 Камень #${p2pModal.id} выставлен за $${p2pPrice}`)
      setP2pModal(null); setP2pPrice(''); reloadPurchases()
    } else addNotification(`❌ ${result.error}`)
  }

  const STATUS_EMOJI = { 0: '📦', 1: '⏳', 2: '✅', 3: '🏪', 4: '🔄' }
  const STATUS_TEXT = { 0: 'OWNED', 1: 'STAKING', 2: 'CLAIMED', 3: 'P2P', 4: 'RESTAKED' }

  return (
    <div className="px-3 mt-2 space-y-2">
      {/* Toggle */}
      <div className="flex gap-1">
        <button onClick={() => setView('configurator')}
          className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all ${
            view === 'configurator' ? 'bg-gold-400/15 border-gold-400/30 text-gold-400' : 'border-white/8 text-slate-500'
          }`}>⚙️ Конфигуратор</button>
        <button onClick={() => { setView('purchases'); reloadPurchases() }}
          className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all ${
            view === 'purchases' ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' : 'border-white/8 text-slate-500'
          }`}>🏆 Мои камни ({myPurchases.length})</button>
      </div>

      {view === 'configurator' && <GemConfigurator />}

      {view === 'purchases' && (<>
        {loading ? <Loading /> : myPurchases.length === 0 ? (
          <div className="p-6 rounded-2xl glass text-center">
            <div className="text-3xl mb-2">💎</div>
            <div className="text-[12px] text-slate-400">У вас пока нет покупок</div>
            <button onClick={() => setView('configurator')}
              className="mt-3 px-4 py-2 rounded-xl text-[11px] font-bold bg-gold-400/15 text-gold-400 border border-gold-400/20">
              ⚙️ Перейти в конфигуратор
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {myPurchases.map(p => {
              const daysLeft = Math.max(0, Math.ceil((p.stakingEndsAt - Date.now() / 1000) / 86400))
              return (
                <div key={p.id} className="p-3 rounded-xl glass">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-black text-white">{STATUS_EMOJI[p.status]} #{p.id}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        p.status===1?'bg-emerald-500/15 text-emerald-400':p.status===0?'bg-blue-500/15 text-blue-400':
                        p.status===2?'bg-gold-400/15 text-gold-400':p.status===3?'bg-purple-500/15 text-purple-400':'bg-white/10 text-slate-400'
                      }`}>{STATUS_TEXT[p.status]}</span>
                    </div>
                    <div className="text-[12px] font-black text-gold-400">${parseFloat(p.pricePaid).toFixed(2)}</div>
                  </div>

                  {p.status === 1 && (
                    <div className="flex items-center justify-between mb-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <div>
                        <div className="text-[10px] text-slate-400">Накоплено</div>
                        <div className="text-[12px] font-black text-emerald-400">+${parseFloat(p.pendingReward).toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Ставка / Осталось</div>
                        <div className="text-[11px] font-bold text-white">{p.stakingRateBP/100}% • {daysLeft>0?`${daysLeft} дн`:'✅ Готово'}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {p.status === 0 && (<>
                      <button onClick={() => handleConvert(p.id)} disabled={txPending}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        ⏳ В стейкинг</button>
                      <button onClick={() => { setP2pModal(p); setP2pPrice(parseFloat(p.marketValue||p.pricePaid).toFixed(2)) }}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20">
                        🏪 Продать P2P</button>
                    </>)}
                    {p.status === 1 && p.rewardReady && (<>
                      <button onClick={() => handleClaim(p.id, 0)} disabled={txPending}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        💰 Забрать USDT</button>
                      <button onClick={() => handleClaim(p.id, 2)} disabled={txPending}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        📦 Получить камень</button>
                      <button onClick={() => handleRestake(p.id)} disabled={txPending}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-gold-400/15 text-gold-400 border border-gold-400/20">
                        🔄 Рестейк</button>
                    </>)}
                    {p.status === 1 && !p.rewardReady && daysLeft > 0 && (
                      <div className="text-[10px] text-slate-500 py-1">⏳ Завершится {new Date(p.stakingEndsAt*1000).toLocaleDateString()}</div>
                    )}
                    {p.status === 2 && (<>
                      <button onClick={() => handleRestake(p.id)} disabled={txPending}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-gold-400/15 text-gold-400 border border-gold-400/20">
                        🔄 Рестейк</button>
                      <button onClick={() => { setP2pModal(p); setP2pPrice(parseFloat(p.marketValue||p.pricePaid).toFixed(2)) }}
                        className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20">
                        🏪 Продать P2P</button>
                    </>)}
                    {p.status === 3 && <div className="text-[10px] text-purple-400 py-1">🏪 Выставлен на P2P</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </>)}

      {/* DCT карточка */}
      <div className="p-3 rounded-2xl glass border border-gold-400/15 mt-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🪙</span>
          <span className="text-[12px] font-bold text-gold-400">Ваши камни дают DCT токены</span>
        </div>
        <div className="text-[10px] text-slate-400 mb-2">Перейдите в раздел DCT чтобы получить токены за ваши камни.</div>
        <button onClick={onGoToDCT}
          className="w-full py-2 rounded-xl text-[11px] font-bold bg-gold-400/15 text-gold-400 border border-gold-400/20">
          Перейти в DCT →
        </button>
      </div>

      {/* P2P Listing Modal */}
      {p2pModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setP2pModal(null)}>
          <div className="w-full max-w-sm p-4 rounded-2xl glass" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card, #1e1e3a)' }}>
            <div className="text-center mb-3">
              <div className="text-3xl mb-2">🏪</div>
              <div className="text-[14px] font-black text-white">Выставить на P2P</div>
              <div className="text-[11px] text-slate-500">Камень #{p2pModal.id} • ${parseFloat(p2pModal.pricePaid).toFixed(2)}</div>
            </div>
            <div className="mb-3">
              <div className="text-[10px] text-slate-500 mb-1">Цена продажи (USDT)</div>
              <input type="number" value={p2pPrice} onChange={e => setP2pPrice(e.target.value)} placeholder="0.00"
                className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-lg font-bold text-white outline-none text-center" />
              <div className="text-[9px] text-slate-500 mt-1 text-center">
                Рыночная: ${parseFloat(p2pModal.marketValue||0).toFixed(2)}
              </div>
            </div>
            <button onClick={handleListP2P} disabled={txPending || !p2pPrice}
              className="w-full py-3 rounded-xl text-sm font-bold gold-btn"
              style={{ opacity: (!p2pPrice||txPending) ? 0.5 : 1 }}>
              {txPending ? '⏳ ...' : `🏪 Выставить за $${p2pPrice||'0'}`}
            </button>
            <button onClick={() => setP2pModal(null)}
              className="w-full mt-2 py-2 rounded-xl text-[11px] font-bold text-slate-500 border border-white/8">Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// INSURANCE — баланс + вывод + верификация + заявки
// ═════════════════════════════════════════════════════════
function InsuranceSection() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [balance, setBalance] = useState('0')
  const [requests, setRequests] = useState([])
  const [fundStats, setFundStats] = useState(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [claimData, setClaimData] = useState({ purchaseId: '', amount: '', reason: '', evidence: '' })
  const [verifyId, setVerifyId] = useState('')

  const reload = useCallback(async () => {
    if (!wallet) return
    setLoading(true)
    const [bal, reqs, stats] = await Promise.all([
      DC.getInsuranceUserBalance(wallet).catch(() => '0'),
      DC.getUserWithdrawRequests(wallet).catch(() => []),
      DC.getInsuranceFundStats().catch(() => null),
    ])
    setBalance(bal); setRequests(reqs); setFundStats(stats); setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  const handleRequestWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return
    setTxPending(true)
    const result = await safeCall(() => DC.requestWithdraw(withdrawAmount))
    setTxPending(false)
    if (result.ok) { addNotification(`✅ Запрос на вывод $${withdrawAmount}`); setWithdrawAmount(''); reload() }
    else addNotification(`❌ ${result.error}`)
  }

  const handleExecuteWithdraw = async (reqId) => {
    setTxPending(true)
    const result = await safeCall(() => DC.executeWithdraw(reqId))
    setTxPending(false)
    if (result.ok) { addNotification('✅ Вывод выполнен!'); reload() }
    else addNotification(`❌ ${result.error}`)
  }

  const handleVerifyAsset = async () => {
    if (!verifyId) return
    setTxPending(true)
    const result = await safeCall(() => DC.verifyAsset(parseInt(verifyId)))
    setTxPending(false)
    if (result.ok) { addNotification(`✅ Актив #${verifyId} верифицирован`); setVerifyId('') }
    else addNotification(`❌ ${result.error}`)
  }

  const handleSubmitClaim = async () => {
    const { purchaseId, amount, reason, evidence } = claimData
    if (!purchaseId || !amount || !reason) return
    setTxPending(true)
    const result = await safeCall(() => DC.submitClaim(parseInt(purchaseId), amount, reason, evidence))
    setTxPending(false)
    if (result.ok) {
      addNotification('✅ Страховая заявка отправлена')
      setShowClaimForm(false); setClaimData({ purchaseId: '', amount: '', reason: '', evidence: '' })
    } else addNotification(`❌ ${result.error}`)
  }

  if (loading) return <Loading />
  const now = Math.floor(Date.now() / 1000)

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="p-4 rounded-2xl glass text-center">
        <div className="text-[10px] text-slate-500">Баланс страхового фонда</div>
        <div className="text-2xl font-black text-gold-400">${parseFloat(balance).toFixed(2)}</div>
        <div className="text-[9px] text-slate-500">Вывод с задержкой 48ч</div>
      </div>

      {fundStats && (
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="В фонде" value={`$${parseFloat(fundStats.fundBalance).toFixed(0)}`} color="text-emerald-400" />
          <StatCard label="Выплачено" value={`$${parseFloat(fundStats.totalPaidClaims).toFixed(0)}`} color="text-blue-400" />
          <StatCard label="На контракте" value={`$${parseFloat(fundStats.usdtOnContract).toFixed(0)}`} color="text-gold-400" />
        </div>
      )}

      {parseFloat(balance) > 0 && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-emerald-400 mb-2">💸 Запросить вывод</div>
          <div className="flex gap-2">
            <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="USDT" className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
            <button onClick={() => setWithdrawAmount(parseFloat(balance).toFixed(2))}
              className="px-3 py-2 rounded-xl text-[10px] font-bold text-gold-400 border border-gold-400/20">MAX</button>
          </div>
          <button onClick={handleRequestWithdraw} disabled={txPending || !withdrawAmount}
            className="mt-2 w-full py-2.5 rounded-xl text-xs font-bold gold-btn"
            style={{ opacity: (!withdrawAmount||txPending) ? 0.5 : 1 }}>
            {txPending ? '⏳' : '💸 Запросить вывод'}</button>
        </div>
      )}

      {requests.filter(r => r.status >= 1).length > 0 && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-blue-400 mb-2">📋 Запросы на вывод</div>
          <div className="space-y-1.5">
            {requests.filter(r => r.status >= 1).map(req => {
              const isReady = req.status === 1 && now >= req.availableAt
              const hoursLeft = Math.max(0, Math.ceil((req.availableAt - now) / 3600))
              return (
                <div key={req.id} className="p-2 rounded-xl bg-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-white">${parseFloat(req.amount).toFixed(2)}</span>
                      <span className="text-[9px] text-slate-500 ml-2">
                        {req.status===1?'⏳ Ожидание':req.status===3?'🚫 Заморожен':req.status===4?'✅ Выполнен':'—'}
                      </span>
                    </div>
                    {req.status === 1 && (isReady ? (
                      <button onClick={() => handleExecuteWithdraw(req.id)} disabled={txPending}
                        className="px-3 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        ✅ Выполнить</button>
                    ) : <span className="text-[9px] text-gold-400">⏳ {hoursLeft}ч</span>)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Верификация */}
      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-purple-400 mb-2">📋 Верификация актива</div>
        <div className="text-[10px] text-slate-400 mb-2">Подтвердите владение (ID покупки)</div>
        <div className="flex gap-2">
          <input type="number" value={verifyId} onChange={e => setVerifyId(e.target.value)} placeholder="ID"
            className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <button onClick={handleVerifyAsset} disabled={txPending || !verifyId}
            className="px-4 py-2 rounded-xl text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20"
            style={{ opacity: (!verifyId||txPending)?0.5:1 }}>
            {txPending ? '⏳' : '✅ Верифицировать'}</button>
        </div>
      </div>

      {/* Страховая заявка */}
      <div className="p-3 rounded-2xl glass">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-bold text-red-400">🆘 Страховая заявка</div>
          <button onClick={() => setShowClaimForm(!showClaimForm)}
            className="text-[10px] text-blue-400 font-bold">{showClaimForm ? '✕ Скрыть' : '+ Создать'}</button>
        </div>
        {showClaimForm ? (
          <div className="space-y-2">
            <input type="number" value={claimData.purchaseId} onChange={e => setClaimData(d => ({...d, purchaseId: e.target.value}))}
              placeholder="ID покупки" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none" />
            <input type="number" value={claimData.amount} onChange={e => setClaimData(d => ({...d, amount: e.target.value}))}
              placeholder="Сумма (USDT)" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none" />
            <input value={claimData.reason} onChange={e => setClaimData(d => ({...d, reason: e.target.value}))}
              placeholder="Причина" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none" />
            <input value={claimData.evidence} onChange={e => setClaimData(d => ({...d, evidence: e.target.value}))}
              placeholder="IPFS ссылка (доказательства)" className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none" />
            <button onClick={handleSubmitClaim} disabled={txPending || !claimData.purchaseId || !claimData.amount || !claimData.reason}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/20"
              style={{ opacity: txPending?0.5:1 }}>
              {txPending ? '⏳' : '🆘 Отправить заявку'}</button>
          </div>
        ) : (
          <div className="text-[10px] text-slate-500">При проблемах с активом создайте заявку с причиной и доказательствами.</div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// P2P — DiamondP2P
// ═════════════════════════════════════════════════════════
function P2PSection() {
  const { wallet, addNotification, setTxPending, txPending } = useGameStore()
  const [listings, setListings] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const [l, s] = await Promise.all([DC.getP2PListings().catch(() => []), DC.getP2PStats().catch(() => null)])
    setListings(l); setStats(s); setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleBuy = async (l) => {
    setTxPending(true)
    const result = await safeCall(() => DC.buyFromP2P(l.id))
    setTxPending(false)
    if (result.ok) { addNotification('✅ 🤝 P2P покупка!'); reload() }
    else addNotification(`❌ ${result.error}`)
  }

  const handleCancel = async (l) => {
    setTxPending(true)
    const result = await safeCall(() => DC.cancelP2PListing(l.id))
    setTxPending(false)
    if (result.ok) { addNotification('✅ Листинг снят'); reload() }
    else addNotification(`❌ ${result.error}`)
  }

  if (loading) return <Loading />

  return (
    <div className="px-3 mt-2 space-y-2">
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Сделок" value={stats.trades} color="text-blue-400" />
          <StatCard label="Оборот" value={`$${parseFloat(stats.volume).toFixed(0)}`} color="text-emerald-400" />
          <StatCard label="Комиссии" value={`$${parseFloat(stats.commissions).toFixed(0)}`} color="text-gold-400" />
        </div>
      )}

      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-blue-400 mb-1">💡 Как продать на P2P</div>
        <div className="text-[10px] text-slate-400">
          «💎 Камни» → «🏆 Мои камни» → кнопка «🏪 Продать P2P» на камне OWNED/CLAIMED.
        </div>
      </div>

      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-gold-400 mb-2">🤝 P2P Рынок ({listings.length})</div>
        {listings.length === 0 ? (
          <div className="text-[11px] text-slate-500 text-center py-4">Нет P2P предложений</div>
        ) : (
          <div className="space-y-1.5">
            {listings.map(l => {
              const isMine = l.seller.toLowerCase() === wallet?.toLowerCase()
              return (
                <div key={l.id} className="p-2.5 rounded-xl bg-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-white">💎 #{l.purchaseId}</span>
                      <span className="text-[9px] text-slate-500 ml-2">{shortAddress(l.seller)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-black text-gold-400">${parseFloat(l.price).toFixed(2)}</span>
                      {isMine ? (
                        <button onClick={() => handleCancel(l)} disabled={txPending}
                          className="px-2 py-1 rounded-lg text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
                          ✕ Снять</button>
                      ) : (
                        <button onClick={() => handleBuy(l)} disabled={txPending}
                          className="px-2 py-1 rounded-lg text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          {txPending ? '⏳' : '💰 Купить'}</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// BOOST
// ═════════════════════════════════════════════════════════
function BoostSection() {
  const { wallet, dct, addNotification, setTxPending, txPending } = useGameStore()
  const [boostInfo, setBoostInfo] = useState(null)
  const [trustInfo, setTrustInfo] = useState(null)
  const [burnAmount, setBurnAmount] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!wallet) return
    setLoading(true)
    const [boost, trust] = await Promise.all([
      DC.getUserBoostInfo(wallet).catch(() => null),
      DC.getUserTrustInfo(wallet).catch(() => null),
    ])
    setBoostInfo(boost); setTrustInfo(trust); setLoading(false)
  }, [wallet])

  useEffect(() => { reload() }, [reload])

  const handleBurn = async () => {
    if (!burnAmount || parseFloat(burnAmount) <= 0) return
    setTxPending(true)
    const result = await safeCall(() => DC.burnNSTForBoost(burnAmount))
    setTxPending(false)
    if (result.ok) { addNotification(`✅ 🔥 ${burnAmount} GST сожжено!`); setBurnAmount(''  ); reload() }
  }

  if (loading) return <Loading />
  const TIER_COLORS = { NONE: 'text-slate-500', PROBATION: 'text-red-400', BRONZE: 'text-orange-400', SILVER: 'text-slate-300', GOLD: 'text-gold-400' }

  return (
    <div className="px-3 mt-2 space-y-2">
      <div className="p-4 rounded-2xl glass text-center">
        <div className="text-[10px] text-slate-500">Текущая ставка</div>
        <div className="text-3xl font-black text-emerald-400">{boostInfo?.currentRate || 50}%</div>
        <div className="text-[9px] text-slate-500">Годовая доходность</div>
      </div>

      {trustInfo && (
        <div className="p-3 rounded-2xl glass">
          <div className="text-[12px] font-bold text-blue-400 mb-2">🛡️ TrustScore</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-white/5">
              <div className={`text-lg font-black ${TIER_COLORS[trustInfo.tierName]}`}>{trustInfo.score}</div>
              <div className="text-[9px] text-slate-500">Баллы</div>
            </div>
            <div className="p-2 rounded-xl bg-white/5">
              <div className={`text-[12px] font-bold ${TIER_COLORS[trustInfo.tierName]}`}>{trustInfo.tierName}</div>
              <div className="text-[9px] text-slate-500">Уровень</div>
            </div>
            <div className="p-2 rounded-xl bg-white/5">
              <div className="text-[12px] font-bold text-emerald-400">{trustInfo.canPurchase ? '✅' : '❌'}</div>
              <div className="text-[9px] text-slate-500">Покупки</div>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-orange-400 mb-2">🔥 Сжечь GST → Буст</div>
        <div className="text-[11px] text-slate-400 mb-2">Сожгите GST для увеличения ставки стейкинга</div>
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="p-2 rounded-lg bg-white/5">
            <div className="text-[11px] font-bold text-orange-400">{parseFloat(boostInfo?.nstBurned||0).toFixed(0)}</div>
            <div className="text-[8px] text-slate-500">Сожжено</div>
          </div>
          <div className="p-2 rounded-lg bg-white/5">
            <div className="text-[11px] font-bold text-gold-400">{(dct||0).toFixed(0)}</div>
            <div className="text-[8px] text-slate-500">Мои GST</div>
          </div>
          <div className="p-2 rounded-lg bg-white/5">
            <div className="text-[11px] font-bold text-purple-400">{parseFloat(boostInfo?.nextBurnRequired||0).toFixed(0)}</div>
            <div className="text-[8px] text-slate-500">До след.</div>
          </div>
        </div>
        <div className="flex gap-2">
          <input type="number" value={burnAmount} onChange={e => setBurnAmount(e.target.value)} placeholder="GST"
            className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none text-center" />
          <button onClick={handleBurn} disabled={txPending || !burnAmount}
            className="px-4 py-2 rounded-xl text-[11px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20"
            style={{ opacity: (!burnAmount||txPending)?0.5:1 }}>
            {txPending ? '⏳' : '🔥 Сжечь'}</button>
        </div>
        <div className="mt-3 text-[9px] text-slate-500">
          <div className="grid grid-cols-3 gap-1">
            <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">0</b><br/>50%</div>
            <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">1K GST</b><br/>55%</div>
            <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">3K GST</b><br/>60%</div>
            <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">6K GST</b><br/>65%</div>
            <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-white">10K GST</b><br/>70%</div>
            <div className="p-1.5 rounded bg-white/5 text-center"><b className="text-gold-400">16K GST</b><br/>75%</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════
// TOURNAMENTS — Соревнования
// ═════════════════════════════════════════════════════════
function TournamentsSection() {
  const { wallet } = useGameStore()
  const [category, setCategory] = useState('invites')
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState('')

  const CATEGORIES = [
    { id: 'invites',     label: '👥 Приглашения',  prize: 'DCT' },
    { id: 'turnover',    label: '💰 Оборот',       prize: 'Доли' },
    { id: 'taps_dct',    label: '⛏ Тапы',          prize: 'DCT' },
    { id: 'max_gem',     label: '💎 Камень',        prize: '' },
    { id: 'max_jewelry', label: '💍 Изделие',       prize: '' },
  ]

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tournaments?category=${category}`)
      const data = await res.json()
      if (data.ok) {
        setLeaderboard(data.leaderboard || [])
        setMonth(data.month || '')
      }
    } catch {}
    setLoading(false)
  }, [category])

  useEffect(() => { reload() }, [reload])

  const formatValue = (item) => {
    switch (category) {
      case 'invites': return `${item.invites} чел.`
      case 'turnover': return `$${parseFloat(item.turnover||0).toLocaleString()}`
      case 'taps_dct': return `${parseFloat(item.taps_dct||0).toFixed(0)} DCT`
      case 'max_gem': return `$${parseFloat(item.max_gem_sale||0).toLocaleString()}`
      case 'max_jewelry': return `$${parseFloat(item.max_jewelry_sale||0).toLocaleString()}`
      default: return '—'
    }
  }

  const MEDALS = ['🥇', '🥈', '🥉']
  const PRIZE_COLORS = ['text-gold-400', 'text-slate-300', 'text-orange-400']

  return (
    <div className="px-3 mt-2 space-y-3">
      <div className="text-center">
        <div className="text-[14px] font-black text-gold-400">🏆 Турниры</div>
        <div className="text-[10px] text-slate-500 mt-1">
          Месяц: <span className="text-white font-bold">{month}</span> • Обнуление 1-го числа
        </div>
      </div>

      {/* Категории */}
      <div className="grid grid-cols-3 gap-1">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            className={`py-2 rounded-xl text-[9px] font-bold border transition-all ${
              category === c.id
                ? 'bg-gold-400/15 border-gold-400/30 text-gold-400'
                : 'border-white/8 text-slate-500'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Призы */}
      <div className="p-2.5 rounded-2xl bg-purple-500/8 border border-purple-500/15">
        <div className="text-[10px] text-purple-400 font-bold mb-1">🎁 Призы (1-3 место)</div>
        <div className="text-[9px] text-slate-400">
          {category === 'invites' || category === 'taps_dct'
            ? 'DCT токены (сумму назначает Админ)'
            : category === 'turnover'
              ? 'Доли бриллиантов'
              : 'Определяет Админ'}
        </div>
      </div>

      {/* Лидерборд */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><div className="text-2xl animate-spin">🏆</div></div>
      ) : leaderboard.length === 0 ? (
        <div className="py-8 text-center rounded-2xl" style={{background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.08)'}}>
          <div className="text-4xl mb-3">🏆</div>
          <div className="text-[13px] font-bold text-slate-400">Пока нет участников</div>
          <div className="text-[11px] text-slate-600 mt-1">Тапайте, приглашайте, покупайте — и попадите в топ!</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {leaderboard.map((item, idx) => {
            const isMine = wallet && item.wallet === wallet.toLowerCase()
            const isTop3 = idx < 3

            return (
              <div key={item.id || idx}
                className={`p-2.5 rounded-xl flex items-center justify-between transition-all ${
                  isMine ? 'bg-gold-400/10 border border-gold-400/20' : 'bg-white/4 border border-white/5'
                }`}>
                <div className="flex items-center gap-2.5">
                  <span className={`text-[16px] font-black ${isTop3 ? PRIZE_COLORS[idx] : 'text-slate-600'}`}>
                    {isTop3 ? MEDALS[idx] : `${idx + 1}.`}
                  </span>
                  <div>
                    <div className="text-[11px] font-bold text-white">
                      {shortAddress(item.wallet)}
                      {isMine && <span className="text-gold-400 ml-1">(вы)</span>}
                    </div>
                  </div>
                </div>
                <div className={`text-[12px] font-black ${isTop3 ? PRIZE_COLORS[idx] : 'text-slate-400'}`}>
                  {formatValue(item)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ═════════════════════════════════════════════════════════
// SHARED
// ═════════════════════════════════════════════════════════
function Loading() {
  return <div className="flex items-center justify-center py-12"><div className="text-2xl animate-spin">💎</div></div>
}
function ErrorCard({ text }) {
  return <div className="mx-3 mt-4 p-4 rounded-2xl glass text-center text-red-400 text-[12px]">❌ {text}</div>
}
function StatCard({ label, value, color }) {
  return (
    <div className="p-2 rounded-2xl glass text-center">
      <div className={`text-lg font-black ${color}`}>{value}</div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  )
}
function StakingRow({ purchase }) {
  const daysLeft = Math.max(0, Math.ceil((purchase.stakingEndsAt - Date.now()/1000) / 86400))
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
      <div>
        <span className="text-[11px] font-bold text-white">#{purchase.id}</span>
        <span className="text-[10px] text-slate-500 ml-2">${parseFloat(purchase.pricePaid).toFixed(0)}</span>
      </div>
      <div className="text-right">
        <div className="text-[10px] font-bold text-emerald-400">+${parseFloat(purchase.pendingReward).toFixed(2)}</div>
        <div className="text-[8px] text-slate-500">{daysLeft > 0 ? `${daysLeft} дн` : '✅ Готово'}</div>
      </div>
    </div>
  )
}
function ClaimReferralButton() {
  const { setTxPending, txPending, addNotification } = useGameStore()
  const handleClaim = async () => {
    setTxPending(true)
    const result = await safeCall(() => DC.claimReferralBonus())
    setTxPending(false)
    if (result.ok) addNotification('✅ Бонус получен!')
    else addNotification(`❌ ${result.error}`)
  }
  return (
    <button onClick={handleClaim} disabled={txPending}
      className="px-3 py-2 rounded-xl text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
      {txPending ? '⏳' : '🎁 Забрать'}
    </button>
  )
}

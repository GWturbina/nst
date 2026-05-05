'use client'
/**
 * FractionalLotsAdmin.jsx — Заглушка после миграции на v2.3
 * 
 * АДАПТАЦИЯ под v2.3:
 * Раньше тут была отдельная админка для фракционных лотов через FractionalGem контракт.
 * В v2.3 это слияно с обычными пулами (ClubPools) — теперь все лоты являются фракционными.
 * 
 * Вся функциональность переехала в LotsAdmin (вкладка "Лоты" в админке).
 * 
 * Этот файл оставлен как заглушка чтобы не сломать импорт в AdminPanel.jsx.
 * При полном переходе можно удалить и убрать ссылку из AdminPanel.
 */
export default function FractionalLotsAdmin() {
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-2xl glass text-center" style={{ borderColor: 'rgba(212,168,67,0.2)' }}>
        <div className="text-3xl mb-2">📦</div>
        <div className="text-[14px] font-black text-gold-400 mb-2">Раздел перенесён</div>
        <div className="text-[11px] text-slate-400 leading-relaxed mb-3">
          В Diamond Club v2.3 фракционные лоты больше не отдельная сущность —
          все лоты теперь являются пулами с долями (как раньше фракционные).
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="text-[12px] font-bold text-blue-400 mb-1">📍 Куда идти</div>
          <div className="text-[10px] text-blue-300">
            Управление лотами теперь в разделе <b>«🎟 Лоты»</b> этой же админки.
            Там создание, привязка к контракту, резерв, подарки.
          </div>
        </div>
      </div>

      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-purple-400 mb-2">📚 Что изменилось</div>
        <div className="text-[10px] text-slate-400 space-y-1.5">
          <div>• <b>Один тип лотов</b> — больше нет разделения на "обычные" и "фракционные"</div>
          <div>• <b>Один контракт</b> — ClubPools вместо FractionalGem + ClubLots</div>
          <div>• <b>Без stakingAPR/stakingDays</b> — стейкинг встроен в логику пула автоматически</div>
          <div>• <b>Без fractional-админов</b> — управление через owner и multisig (Gnosis Safe)</div>
          <div>• <b>Без сертификатов on-chain</b> — мета (карат, сертификат, фото) хранится в Supabase</div>
        </div>
      </div>

      <div className="p-3 rounded-2xl glass">
        <div className="text-[12px] font-bold text-emerald-400 mb-2">⚙️ Управление админами</div>
        <div className="text-[10px] text-slate-400 leading-relaxed">
          В v2.3 нет отдельных «fractional-админов». Контрактом ClubPools управляет:
          <ul className="mt-1 ml-4 list-disc space-y-0.5">
            <li><b>Owner</b> — твой основной кошелёк (createPool, recordSale, withdrawForGemPurchase)</li>
            <li><b>Multisig (3-of-5 Safe)</b> — критические операции (addFactory, emergencyDeclare)</li>
            <li><b>Directors</b> — голосование по форс-мажору (60% + 7 дней timelock)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

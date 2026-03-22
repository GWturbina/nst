// ═══════════════════════════════════════════════════════════════
// DIAMOND CLUB — LEVELS & BALANCED TAPPING ECONOMY
// ═══════════════════════════════════════════════════════════════
//
// КЛЮЧЕВАЯ ЭКОНОМИКА:
// ────────────────────
// Цель: за 1 год ежедневной игры натапать ~16,000 GST (Lv.6-7)
// Энергия: 200, восстановление 1/120сек (полная зарядка ~6.7 часов)
// Реалистично: ~2 полных цикла в день = ~400 тапов/день
//
// Уровень 0  (Руки):     0.01 GST/tap × 400 =   4/день →  1,460/год
// Уровень 4  (Авто):     0.12 GST/tap × 400 =  48/день → 17,520/год
// Уровень 8  (Эксперт):  0.28 GST/tap × 400 = 112/день → 40,880/год
// Уровень 12 (Империя):  0.40 GST/tap × 400 = 160/день → 58,400/год
//
// ДЕФИЦИТ ОБЕСПЕЧЕН: даже на MAX — целый год для ~60K DCT
// ═══════════════════════════════════════════════════════════════

export const ENERGY_CONFIG = {
  maxEnergy: 200,           // Максимум энергии (тапов)
  regenIntervalMs: 120000,  // 1 энергия каждые 120 секунд (2 минуты)
  regenAmount: 1,           // +1 за интервал
  evapSeconds: 1800,        // Испарение для незарегистрированных: 30 мин
}

export const LEVELS = [
  { id:0, name:'Руки', sub:'Тёмная пещера', emoji:'🤲', nssPerTap:0.01,
    price:'Бесплатно', bnb:0, color:'#94a3b8', themeClass:'theme-0',
    thought:'Как тяжело рыть руками... Вот бы лопату!', thoughtColor:'gold', thoughtIcon:'💡',
    desc:'Без регистрации. Камни испаряются через 30 мин!',
    earn:'Испаряются!', team:0, nssBonus:0 },
  { id:1, name:'Лопата', sub:'Песчаная пещера', emoji:'⛏', nssPerTap:0.03,
    price:'0.0015 BNB', bnb:0.0015, color:'#C9903A', themeClass:'theme-1',
    thought:'Лопата помогает, но песок мешает...', thoughtColor:'green', thoughtIcon:'💡',
    desc:'Первый инструмент. DCT сохраняются навсегда.',
    earn:'2 партнёра × 60%', team:2, nssBonus:5 },
  { id:2, name:'Сито', sub:'Речное дно', emoji:'🪣', nssPerTap:0.05,
    price:'0.003 BNB', bnb:0.003, color:'#B8860B', themeClass:'theme-2',
    thought:'Наконец камни видно! Нужна тачка!', thoughtColor:'green', thoughtIcon:'🔍',
    desc:'Фильтруй породу. Находи скрытые камни.',
    earn:'4 партнёра × 60%', team:4, nssBonus:10 },
  { id:3, name:'Тачка', sub:'Каменный карьер', emoji:'🛒', nssPerTap:0.08,
    price:'0.006 BNB', bnb:0.006, color:'#CD7F32', themeClass:'theme-3',
    thought:'Столько камней! Нужна автоматизация!', thoughtColor:'gold', thoughtIcon:'💪',
    desc:'Командная работа. 8 мест в структуре.',
    earn:'8 партнёров × 50%', team:8, nssBonus:20 },
  { id:4, name:'Авто-Шахта', sub:'Механический зал', emoji:'⚙️', nssPerTap:0.12,
    price:'0.012 BNB', bnb:0.012, color:'#E5A600', themeClass:'theme-4',
    thought:'Машины работают за меня!', thoughtColor:'gold', thoughtIcon:'🔥',
    desc:'🔥 Автоматизация клубом.',
    earn:'16 партнёров × 50%', team:16, nssBonus:40 },
  { id:5, name:'Огранка', sub:'Мастерская', emoji:'💎', nssPerTap:0.16,
    price:'0.024 BNB', bnb:0.024, color:'#10B981', themeClass:'theme-5',
    thought:'Огранённый камень в 5 раз дороже!', thoughtColor:'green', thoughtIcon:'✨',
    desc:'Токенизация DCT. Стейкинг.',
    earn:'32 партнёра × 50%', team:32, nssBonus:80 },
  { id:6, name:'Ювелирка', sub:'Золотая кузня', emoji:'💍', nssPerTap:0.20,
    price:'0.048 BNB', bnb:0.048, color:'#E11D48', themeClass:'theme-6',
    thought:'Мои украшения покупают!', thoughtColor:'ruby', thoughtIcon:'💍',
    desc:'Ювелирное производство.',
    earn:'64 партнёра × 50%', team:64, nssBonus:150 },
  { id:7, name:'Коллектор', sub:'Тайная кладовая', emoji:'🏛', nssPerTap:0.24,
    price:'0.096 BNB', bnb:0.096, color:'#3B82F6', themeClass:'theme-7',
    thought:'Редкие камни — лучшая инвестиция!', thoughtColor:'blue', thoughtIcon:'📐',
    desc:'P2P торговля DCT.',
    earn:'128 партнёров × 50%', team:128, nssBonus:300 },
  { id:8, name:'Эксперт', sub:'Лаборатория', emoji:'🔬', nssPerTap:0.28,
    price:'0.192 BNB', bnb:0.192, color:'#F97316', themeClass:'theme-8',
    thought:'Я вижу ценность где другие — камень!', thoughtColor:'gold', thoughtIcon:'🔬',
    desc:'Сертификация. 256 партнёров.',
    earn:'256 партнёров × 50%', team:256, nssBonus:600 },
  { id:9, name:'Галерист', sub:'Выставочный зал', emoji:'🖼', nssPerTap:0.32,
    price:'0.384 BNB', bnb:0.384, color:'#A855F7', themeClass:'theme-9',
    thought:'Мои камни на витринах!', thoughtColor:'green', thoughtIcon:'🖼',
    desc:'🖼 Витрина. Наследование DCT.',
    earn:'512 партнёров', team:512, nssBonus:1200 },
  { id:10, name:'Магнат', sub:'Алмазная биржа', emoji:'💠', nssPerTap:0.35,
    price:'0.768 BNB', bnb:0.768, color:'#67E8F9', themeClass:'theme-10',
    thought:'Алмазная биржа — вот власть!', thoughtColor:'blue', thoughtIcon:'💠',
    desc:'Алмазная биржа.',
    earn:'1024 партнёра', team:1024, nssBonus:2500 },
  { id:11, name:'Легенда', sub:'Хранилище корон', emoji:'👑', nssPerTap:0.38,
    price:'1.536 BNB', bnb:1.536, color:'#EC4899', themeClass:'theme-11',
    thought:'Клуб Миллионеров!', thoughtColor:'ruby', thoughtIcon:'👑',
    desc:'👑 Все привилегии.',
    earn:'2048 партнёров', team:2048, nssBonus:5000 },
  { id:12, name:'Империя', sub:'Тронный зал', emoji:'🏰', nssPerTap:0.40,
    price:'3.072 BNB', bnb:3.072, color:'#FFD700', themeClass:'theme-12',
    thought:'От тапа — до Алмазной Империи!', thoughtColor:'gold', thoughtIcon:'🏰',
    desc:'🏰 Максимальный GST за тап.',
    earn:'4096 партнёров', team:4096, nssBonus:10000 },
];

export const LEVEL_BACKGROUNDS = [
  { file: 'bg-hands.jpg',    overlay: 'rgba(15,15,30,0.55)',  glow: 'rgba(148,163,184,0.08)' },
  { file: 'bg-shovel.jpg',   overlay: 'rgba(30,20,10,0.50)',  glow: 'rgba(201,144,58,0.15)'  },
  { file: 'bg-sieve.jpg',    overlay: 'rgba(20,18,5,0.50)',   glow: 'rgba(184,134,11,0.15)'  },
  { file: 'bg-cart.jpg',     overlay: 'rgba(25,15,8,0.45)',   glow: 'rgba(205,127,50,0.18)'  },
  { file: 'bg-auto.jpg',     overlay: 'rgba(25,20,0,0.45)',   glow: 'rgba(229,166,0,0.20)'   },
  { file: 'bg-cutting.jpg',  overlay: 'rgba(5,20,15,0.45)',   glow: 'rgba(16,185,129,0.22)'  },
  { file: 'bg-jewelry.jpg',  overlay: 'rgba(25,5,10,0.40)',   glow: 'rgba(225,29,72,0.22)'   },
  { file: 'bg-building.jpg', overlay: 'rgba(8,12,30,0.40)',   glow: 'rgba(59,130,246,0.22)'  },
  { file: 'bg-earth.jpg',    overlay: 'rgba(25,12,3,0.40)',   glow: 'rgba(249,115,22,0.22)'  },
  { file: 'bg-house.jpg',    overlay: 'rgba(15,5,25,0.40)',   glow: 'rgba(168,85,247,0.25)'  },
  { file: 'bg-village.jpg',  overlay: 'rgba(5,18,22,0.35)',   glow: 'rgba(103,232,249,0.25)' },
  { file: 'bg-resort.jpg',   overlay: 'rgba(20,5,18,0.35)',   glow: 'rgba(236,72,153,0.25)'  },
  { file: 'bg-empire.jpg',   overlay: 'rgba(20,15,0,0.30)',   glow: 'rgba(255,215,0,0.35)'   },
];

// FIX #13: Лидерборд загружается из /api/tournaments (dc_tournaments)
// Статичные данные убраны — в production используются реальные данные
export const LEADERBOARD = [];

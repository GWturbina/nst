/**
 * gemCatalog.js v2 — Полный контроль ценообразования
 * 
 * МОДЕЛЬ:
 *  1. СЕБЕСТОИМОСТЬ (закупочная) — 2 матрицы: без серт / с серт
 *  2. РОЗНИЦА = себестоимость × (1 + наценка_региона%)
 *  3. КЛУБНАЯ = розничная × (1 − скидка%)
 *  4. Покупатель видит: Розничная (зачёркнута) → Клубная (жирная)
 */

// ═══════════════════════════════════════════════════
// КОНСТАНТЫ
// ═══════════════════════════════════════════════════

export const SHAPES = [
  { id: 'round',    name: 'Круглый',     nameEn: 'Round',    nameUk: 'Круглий',   img: 'agate.png'    },
  { id: 'princess', name: 'Принцесса',   nameEn: 'Princess', nameUk: 'Принцеса',  img: 'citrine.png'  },
  { id: 'cushion',  name: 'Кушон',       nameEn: 'Cushion',  nameUk: 'Кушон',     img: 'garnet.png'   },
  { id: 'oval',     name: 'Овал',        nameEn: 'Oval',     nameUk: 'Овал',      img: 'peridot.png'  },
  { id: 'emerald',  name: 'Эмеральд',    nameEn: 'Emerald',  nameUk: 'Емеральд',  img: 'emerald.png'  },
  { id: 'pear',     name: 'Груша',       nameEn: 'Pear',     nameUk: 'Груша',     img: 'ruby.png'     },
  { id: 'heart',    name: 'Сердце',      nameEn: 'Heart',    nameUk: 'Серце',     img: 'sapphire.png' },
  { id: 'trillion', name: 'Треугольник', nameEn: 'Triangle', nameUk: 'Трикутник', img: 'Triangle.png' },
  { id: 'radiant',  name: 'Радиант',     nameEn: 'Radiant',  nameUk: 'Радіант',   img: 'amethyst.png'  },
]

export const CLARITIES = [
  { id: 'IF',   descRu: 'Безупречный',              descEn: 'Internally Flawless' },
  { id: 'VVS1', descRu: 'Очень-очень малые вкл. 1', descEn: 'Very Very Slightly Included 1' },
  { id: 'VVS2', descRu: 'Очень-очень малые вкл. 2', descEn: 'Very Very Slightly Included 2' },
  { id: 'VS1',  descRu: 'Очень малые вкл. 1',       descEn: 'Very Slightly Included 1' },
  { id: 'VS2',  descRu: 'Очень малые вкл. 2',       descEn: 'Very Slightly Included 2' },
  { id: 'SI1',  descRu: 'Малые включения 1',        descEn: 'Slightly Included 1' },
  { id: 'SI2',  descRu: 'Малые включения 2',        descEn: 'Slightly Included 2' },
]

export const WHITE_COLORS = [
  { id: 'D', descRu: 'Исключительно белый+' },
  { id: 'E', descRu: 'Исключительно белый' },
  { id: 'F', descRu: 'Редко белый+' },
  { id: 'G', descRu: 'Редко белый' },
  { id: 'H', descRu: 'Белый' },
  { id: 'I', descRu: 'Слегка тонированный+' },
  { id: 'J', descRu: 'Слегка тонированный' },
  { id: 'K', descRu: 'Тонированный+' },
  { id: 'L', descRu: 'Тонированный' },
]

export const FANCY_COLORS = [
  { id: 'fancy_yellow',  name: 'Жёлтый',   nameEn: 'Yellow',  hex: '#FFD700' },
  { id: 'fancy_pink',    name: 'Розовый',   nameEn: 'Pink',    hex: '#FF69B4' },
  { id: 'fancy_blue',    name: 'Голубой',   nameEn: 'Blue',    hex: '#4169E1' },
  { id: 'fancy_green',   name: 'Зелёный',   nameEn: 'Green',   hex: '#50C878' },
  { id: 'fancy_orange',  name: 'Оранжевый', nameEn: 'Orange',  hex: '#FF8C00' },
  { id: 'fancy_brown',   name: 'Коньячный', nameEn: 'Cognac',  hex: '#8B4513' },
  { id: 'fancy_black',   name: 'Чёрный',    nameEn: 'Black',   hex: '#1a1a1a' },
]

export const FANCY_INTENSITIES = [
  { id: 'faint',   name: 'Бледный',     nameEn: 'Faint' },
  { id: 'light',   name: 'Светлый',     nameEn: 'Light' },
  { id: 'fancy',   name: 'Фантазийный', nameEn: 'Fancy' },
  { id: 'intense', name: 'Насыщенный',  nameEn: 'Intense' },
  { id: 'vivid',   name: 'Яркий',       nameEn: 'Vivid' },
  { id: 'deep',    name: 'Глубокий',    nameEn: 'Deep' },
]

export const REGIONS = [
  { id: 'cis',     name: 'СНГ',            nameEn: 'CIS' },
  { id: 'europe',  name: 'Европа',         nameEn: 'Europe' },
  { id: 'asia',    name: 'Азия',           nameEn: 'Asia' },
  { id: 'america', name: 'Америка',        nameEn: 'Americas' },
  { id: 'mena',    name: 'Ближний Восток', nameEn: 'Middle East' },
]

export const CARAT_RANGE = { min: 0.3, max: 10.0, step: 0.01 }

// ═══════════════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════════════

const K = {
  wCost: 'nss_wCost', wCostC: 'nss_wCostC',
  fCost: 'nss_fCost', fCostC: 'nss_fCostC',
  fInt: 'nss_fInt', shape: 'nss_shape',
  region: 'nss_region', disc: 'nss_disc',
  nstMax: 'nss_nstMax', nstPer: 'nss_nstPer',
}

// ═══════════════════════════════════════════════════
// DEFAULTS — СЕБЕСТОИМОСТЬ ($ за 1 карат, Round)
// ═══════════════════════════════════════════════════

// Белые БЕЗ сертификата
const D_W = {
  IF:   [15000,13000,11000,9500,8000,6500,5200,4000,3200],
  VVS1: [11000,9500,8200,7000,6000,4800,3900,3100,2500],
  VVS2: [8500,7300,6400,5500,4800,3900,3100,2500,2000],
  VS1:  [6500,5700,5000,4400,3800,3100,2500,2000,1600],
  VS2:  [5300,4700,4100,3600,3100,2600,2100,1700,1400],
  SI1:  [3800,3400,3000,2700,2300,2000,1600,1300,1100],
  SI2:  [2800,2500,2200,2000,1700,1400,1200,1000,850],
}

// Белые С сертификатом
const D_WC = {
  IF:   [18000,15500,13000,11200,9400,7600,6100,4700,3800],
  VVS1: [13000,11200,9700,8300,7100,5700,4600,3700,3000],
  VVS2: [10000,8600,7500,6500,5600,4600,3700,3000,2400],
  VS1:  [7700,6700,5900,5200,4500,3600,2900,2400,1900],
  VS2:  [6300,5500,4800,4200,3700,3100,2500,2000,1650],
  SI1:  [4500,4000,3500,3200,2700,2300,1900,1550,1300],
  SI2:  [3300,2900,2600,2300,2000,1650,1400,1150,1000],
}

const D_FC  = { fancy_yellow:2500, fancy_pink:15000, fancy_blue:25000, fancy_green:9000, fancy_orange:5000, fancy_brown:1500, fancy_black:1800 }
const D_FCC = { fancy_yellow:3200, fancy_pink:19000, fancy_blue:32000, fancy_green:11500, fancy_orange:6500, fancy_brown:2000, fancy_black:2300 }
const D_FI  = { faint:0.6, light:1.0, fancy:1.8, intense:3.0, vivid:5.0, deep:4.0 }
const D_SH  = { round:1.00, princess:0.70, cushion:0.75, oval:0.78, emerald:0.72, radiant:0.72, marquise:0.68, pear:0.73, heart:0.75, asscher:0.74, trillion:0.65 }
const D_RG  = { cis:75, europe:120, asia:100, america:130, mena:110 }

// ═══════════════════════════════════════════════════
// LOAD / SAVE API
// ═══════════════════════════════════════════════════

const isBrowser = typeof window !== 'undefined'
function ld(k, d) { if (!isBrowser) return d; try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d } catch { return d } }
function sv(k, v) { if (!isBrowser) return; localStorage.setItem(k, JSON.stringify(v)) }

export const getWhiteCost     = () => ld(K.wCost, D_W)
export const getWhiteCostCert = () => ld(K.wCostC, D_WC)
export const getFancyCost     = () => ld(K.fCost, D_FC)
export const getFancyCostCert = () => ld(K.fCostC, D_FCC)
export const getFancyIntMult  = () => ld(K.fInt, D_FI)
export const getShapeMultipliers = () => ld(K.shape, D_SH)
export const getRegionMarkups = () => ld(K.region, D_RG)
export const getClubDiscount  = () => ld(K.disc, 30)
export const getNstBonusMax   = () => ld(K.nstMax, 3)
export const getNstPerPercent = () => ld(K.nstPer, 1000)

export const saveWhiteCost     = d => sv(K.wCost, d)
export const saveWhiteCostCert = d => sv(K.wCostC, d)
export const saveFancyCost     = d => sv(K.fCost, d)
export const saveFancyCostCert = d => sv(K.fCostC, d)
export const saveFancyIntMult  = d => sv(K.fInt, d)
export const saveShapeMultipliers = d => sv(K.shape, d)
export const saveRegionMarkups = d => sv(K.region, d)
export const saveClubDiscount  = d => sv(K.disc, d)
export const saveNstBonusMax   = d => sv(K.nstMax, d)
export const saveNstPerPercent = d => sv(K.nstPer, d)

export function resetAllPrices() { if (!isBrowser) return; Object.values(K).forEach(k => localStorage.removeItem(k)) }

// ═══════════════════════════════════════════════════
// РАСЧЁТ ЦЕНЫ — БЕЛЫЙ БРИЛЛИАНТ
// ═══════════════════════════════════════════════════

export function calcWhitePrice(shape, clarity, color, carats, hasCert, regionId = 'cis', userNst = 0) {
  const matrix = hasCert ? getWhiteCostCert() : getWhiteCost()
  const sm = getShapeMultipliers()
  const rm = getRegionMarkups()
  const disc = getClubDiscount()
  const nMax = getNstBonusMax()
  const nPer = getNstPerPercent()

  const ci = WHITE_COLORS.findIndex(c => c.id === color)
  const row = matrix[clarity]
  if (!row || ci < 0) return null

  const base = row[ci]
  const shM = sm[shape] || 1.0

  // Каратный коэфф
  let cM = 1.0
  if (carats >= 1.0) cM = 1.0 + (carats - 1.0) * 0.12
  if (carats >= 2.0) cM = 1.12 + (carats - 2.0) * 0.18
  if (carats >= 3.0) cM = 1.30 + (carats - 3.0) * 0.25
  if (carats >= 5.0) cM = 1.80 + (carats - 5.0) * 0.35

  const costPC = Math.round(base * shM * cM)
  const cost = Math.round(costPC * carats)
  const mkp = (rm[regionId] || 75) / 100
  const retail = Math.round(cost * (1 + mkp))
  const retailPC = Math.round(costPC * (1 + mkp))
  const nstB = Math.min(nMax, Math.floor(userNst / nPer))
  const totalDisc = disc + nstB
  const club = Math.round(retail * (1 - totalDisc / 100))

  return {
    cost, costPerCarat: costPC,
    retailPrice: retail, retailPerCarat: retailPC,
    clubPrice: club, clubPerCarat: Math.round(club / carats),
    savings: retail - club, discountPct: totalDisc, nstBonus: nstB,
    regionMarkupPct: rm[regionId] || 75,
    details: { basePPC: base, shapeM: shM, caratM: cM, hasCert, carats }
  }
}

// ═══════════════════════════════════════════════════
// РАСЧЁТ ЦЕНЫ — ЦВЕТНОЙ БРИЛЛИАНТ
// ═══════════════════════════════════════════════════

export function calcFancyPrice(shape, fancyColor, intensityId, clarity, carats, hasCert, regionId = 'cis', userNst = 0) {
  const costs = hasCert ? getFancyCostCert() : getFancyCost()
  const iM = getFancyIntMult()
  const sm = getShapeMultipliers()
  const rm = getRegionMarkups()
  const disc = getClubDiscount()
  const nMax = getNstBonusMax()
  const nPer = getNstPerPercent()

  const base = costs[fancyColor]
  if (!base) return null

  const intM = iM[intensityId] || 1.0
  const shM = sm[shape] || 1.0
  const clM = { IF:1.3, VVS1:1.15, VVS2:1.08, VS1:1.0, VS2:0.92, SI1:0.82, SI2:0.72 }[clarity] || 1.0

  let cM = 1.0
  if (carats >= 1.0) cM = 1.0 + (carats - 1.0) * 0.20
  if (carats >= 2.0) cM = 1.20 + (carats - 2.0) * 0.30
  if (carats >= 3.0) cM = 1.50 + (carats - 3.0) * 0.40

  const costPC = Math.round(base * intM * clM * shM * cM)
  const cost = Math.round(costPC * carats)
  const mkp = (rm[regionId] || 75) / 100
  const retail = Math.round(cost * (1 + mkp))
  const retailPC = Math.round(costPC * (1 + mkp))
  const nstB = Math.min(nMax, Math.floor(userNst / nPer))
  const totalDisc = disc + nstB
  const club = Math.round(retail * (1 - totalDisc / 100))

  return {
    cost, costPerCarat: costPC,
    retailPrice: retail, retailPerCarat: retailPC,
    clubPrice: club, clubPerCarat: Math.round(club / carats),
    savings: retail - club, discountPct: totalDisc, nstBonus: nstB,
    regionMarkupPct: rm[regionId] || 75,
    details: { base, intM, clM, shM, cM, hasCert, carats }
  }
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

export function formatUSD(n) {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:0, maximumFractionDigits:0 }).format(n)
}

export function gemSpecString(c) {
  const cert = c.hasCert ? 'CERT' : 'NO_CERT'
  return c.type === 'white'
    ? `${c.shape}|${c.clarity}|${c.color}|${c.carats}ct|${cert}|${c.region}`
    : `${c.shape}|${c.fancyColor}|${c.intensity}|${c.clarity}|${c.carats}ct|${cert}|${c.region}`
}

export function exportAllPrices() {
  return { v:'2.0', at: new Date().toISOString(),
    wCost: getWhiteCost(), wCostC: getWhiteCostCert(),
    fCost: getFancyCost(), fCostC: getFancyCostCert(),
    fInt: getFancyIntMult(), shape: getShapeMultipliers(),
    region: getRegionMarkups(), disc: getClubDiscount(),
    nstMax: getNstBonusMax(), nstPer: getNstPerPercent() }
}

export function importAllPrices(d) {
  if (d.wCost) saveWhiteCost(d.wCost)
  if (d.wCostC) saveWhiteCostCert(d.wCostC)
  if (d.fCost) saveFancyCost(d.fCost)
  if (d.fCostC) saveFancyCostCert(d.fCostC)
  if (d.fInt) saveFancyIntMult(d.fInt)
  if (d.shape) saveShapeMultipliers(d.shape)
  if (d.region) saveRegionMarkups(d.region)
  if (d.disc !== undefined) saveClubDiscount(d.disc)
  if (d.nstMax !== undefined) saveNstBonusMax(d.nstMax)
  if (d.nstPer !== undefined) saveNstPerPercent(d.nstPer)
}

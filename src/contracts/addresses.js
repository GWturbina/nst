/**
 * Diamond Club v2.4 — Contract Addresses on opBNB Mainnet
 * ════════════════════════════════════════════════════════
 * 
 * ОБНОВЛЕНИЕ v2.4 (5 мая 2026):
 * - Исправлено распределение маркетинга:
 *   85% камень + 5% реклама + 10% маркетинг
 *   Внутри 10% маркетинга: 90% партнёры, 3% тех, 2.5% GWT, 2.5% CGT, 2% автор
 * - Передеплоены ClubPools и ClubMarketing с новой логикой
 * - Остальные 3 контракта тоже передеплоены (для связности cross-wiring)
 * 
 * Старые адреса v2.3 — заброшены (не использовались).
 */
const ADDRESSES = {
  // ═══════════════════════════════════════════════════════
  // ВНЕШНИЕ ТОКЕНЫ
  // ═══════════════════════════════════════════════════════
  USDT: '0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3',  // Tether USD (18 decimals на opBNB)
  
  // ═══════════════════════════════════════════════════════
  // GLOBALWAY ЭКОСИСТЕМА (без изменений)
  // ═══════════════════════════════════════════════════════
  NSSPlatform:       '0xFb1ddFa8A7EAB0081EAe24ec3d24B0ED4Dd84f2B',
  GlobalWay:         '0xe8e2af46AEEec1B51B335f10C5912620B1a2707F',
  GlobalWayBridge:   '0xdc18816018F995502A40010AA811461ce98308dd',
  MatrixRegistry:    '0xD62945edFF7605dFc77A4bF607c96Da72E03cd0C',
  GWTToken:          '0x933B0Cb1f43170f3F0fcf082572CC931D6e93b5F',
  GlobalWayStats:    '0x1c5A63AfC7dd0b057B9dcAA3B6B47B4078a5A808',
  CardGiftMarketing: '0x67dD9ed3E63bA44047A70DA70AeC508101F048b7',
  MatrixPaymentsV2:  '0x959217Aab60f01cc582373E1a2bc36e7a076bc39',
  NSTToken:          '0xE9a2758F4BB29C4869d3Eee8fB9c9b176Fc4816A',
  SwapHelper:        '0xFF0e9BFFf1cc5A6B65f689bF2442056627686Bf5',
  
  // ═══════════════════════════════════════════════════════
  // PRIVATE MAILBOX (без изменений)
  // ═══════════════════════════════════════════════════════
  PrivateMailbox:    '0xb251919Fa79dA48b060f57D5f0A0ECD1291e37A5',
  
  // ═══════════════════════════════════════════════════════
  // DIAMOND CLUB v2.4 (deployed 5 мая 2026, opBNB mainnet)
  // ═══════════════════════════════════════════════════════
  ClubDirectors:  '0x04Ace39aE3386FC6Af75AE37F1eF2fFEDf5D5058',
  ClubDCT:        '0xc3D300e07E063d1dEAA75F5B2fF40652172f5434',
  ClubMarketing:  '0x559291b6fAD0cb11C4630553B92139500bf202e4',
  ClubPools:      '0xf7e9c12D9f6DC0a426E0f43465958ce020b7432e',
  ClubMarket:     '0xEf3dc061992fff128661F74BE3A8543C8AE23c59',
}
export default ADDRESSES

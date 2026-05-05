/**
 * Diamond Club v2.3 — Contract Addresses on opBNB Mainnet
 * ════════════════════════════════════════════════════════
 * 
 * ИЗМЕНЕНИЯ (5 мая 2026):
 * - Diamond Club v10.2 контракты УДАЛЕНЫ (заменены на 5 контрактов v2.3)
 * - DCT v3.2 контракты УДАЛЕНЫ (заменены на ClubDCT внутри v2.3)
 * - GlobalWay экосистема — БЕЗ ИЗМЕНЕНИЙ (регистрация, уровни, команда)
 * - PrivateMailbox — оставлен (используется в DeliverySection для доставки)
 */
const ADDRESSES = {
  // ═══════════════════════════════════════════════════════
  // ВНЕШНИЕ ТОКЕНЫ
  // ═══════════════════════════════════════════════════════
  USDT: '0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3',  // Tether USD (18 decimals на opBNB)
  
  // ═══════════════════════════════════════════════════════
  // GLOBALWAY ЭКОСИСТЕМА (регистрация + партнёрская программа)
  // ═══════════════════════════════════════════════════════
  NSSPlatform:       '0xFb1ddFa8A7EAB0081EAe24ec3d24B0ED4Dd84f2B',
  GlobalWay:         '0xe8e2af46AEEec1B51B335f10C5912620B1a2707F',
  GlobalWayBridge:   '0x4489851e530924eB25e684E6b97c7C47364780F5',
  MatrixRegistry:    '0xD62945edFF7605dFc77A4bF607c96Da72E03cd0C',
  GWTToken:          '0x933B0Cb1f43170f3F0fcf082572CC931D6e93b5F',
  GlobalWayStats:    '0x1c5A63AfC7dd0b057B9dcAA3B6B47B4078a5A808',
  CardGiftMarketing: '0x67dD9ed3E63bA44047A70DA70AeC508101F048b7',
  MatrixPaymentsV2:  '0x959217Aab60f01cc582373E1a2bc36e7a076bc39',
  NSTToken:          '0xE9a2758F4BB29C4869d3Eee8fB9c9b176Fc4816A',
  SwapHelper:        '0xFF0e9BFFf1cc5A6B65f689bF2442056627686Bf5',
  
  // ═══════════════════════════════════════════════════════
  // PRIVATE MAILBOX (личные сообщения, треккинг доставки)
  // ═══════════════════════════════════════════════════════
  PrivateMailbox:    '0xb251919Fa79dA48b060f57D5f0A0ECD1291e37A5',
  
  // ═══════════════════════════════════════════════════════
  // DIAMOND CLUB v2.3 (deployed 5 мая 2026, opBNB mainnet)
  // ═══════════════════════════════════════════════════════
  ClubDirectors:  '0x595940E6Bb55c679ca3B481086db75eD69E98876',
  ClubDCT:        '0x76347A3764C4CD1E61e33f6bC3F2Da66111Bc52c',
  ClubMarketing:  '0x092209b7dB90d34A9803F226e27744D86c11129F',
  ClubPools:      '0x7cE3ac959c87683d6ccF4F82dA2Fad33f576B5C7',
  ClubMarket:     '0x95269901933c6931ac5503d995bB94BCC4f43312',
}
export default ADDRESSES

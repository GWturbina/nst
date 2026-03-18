/**
 * Web3 Module — SafePal + opBNB
 *
 * Этот модуль отвечает ТОЛЬКО за:
 * 1. Подключение / отключение кошелька
 * 2. Переключение сети на opBNB
 * 3. Хранение signer, address, chainId, walletType
 * 4. Генерацию событий wallet:disconnected / wallet:accountChanged / wallet:chainChanged
 *
 * Все вызовы контрактов — в contracts.js
 */
import { ethers } from 'ethers';

// opBNB Mainnet
const OPBNB_CHAIN = {
  chainId: '0xCC',  // 204
  chainName: 'opBNB Mainnet',
  rpcUrls: ['https://opbnb-mainnet-rpc.bnbchain.org'],
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  blockExplorerUrls: ['https://opbnb.bscscan.com'],
};

const TARGET_CHAIN    = OPBNB_CHAIN;
const TARGET_CHAIN_ID = 204;

class Web3Module {
  constructor() {
    this.provider    = null;
    this.signer      = null;
    this.address     = null;
    this.chainId     = null;
    this.isConnected = false;
    this.walletType  = null; // 'safepal' | 'metamask' | 'injected'
  }

  // ───────────────────────────────────────────────────
  // ОПРЕДЕЛЕНИЕ КОШЕЛЬКА
  // ───────────────────────────────────────────────────

  detectWallet() {
    if (typeof window === 'undefined') return null;
    if (window.ethereum?.isSafePal)  return 'safepal';
    if (window.ethereum?.isMetaMask) return 'metamask';
    if (window.ethereum)             return 'injected';
    return null;
  }

  // ───────────────────────────────────────────────────
  // ПОДКЛЮЧЕНИЕ
  // ───────────────────────────────────────────────────

  async connect() {
    const walletType = this.detectWallet();
    if (!walletType) {
      throw new Error('Кошелёк не найден. Откройте в SafePal Browser или установите SafePal.');
    }

    this.walletType = walletType;

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('Нет доступных аккаунтов');
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
    this.signer   = await this.provider.getSigner();
    this.address  = accounts[0];

    const network = await this.provider.getNetwork();
    this.chainId  = Number(network.chainId);

    if (this.chainId !== TARGET_CHAIN_ID) {
      await this.switchNetwork();
    }

    // Подписываемся на события кошелька
    window.ethereum.on('accountsChanged', this._handleAccountsChanged.bind(this));
    window.ethereum.on('chainChanged',    this._handleChainChanged.bind(this));

    this.isConnected = true;

    return {
      address:    this.address,
      chainId:    this.chainId,
      walletType: this.walletType,
    };
  }

  // ───────────────────────────────────────────────────
  // ПЕРЕКЛЮЧЕНИЕ СЕТИ
  // ───────────────────────────────────────────────────

  async switchNetwork() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: TARGET_CHAIN.chainId }],
      });
    } catch (switchError) {
      // Сеть не добавлена — добавляем
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [TARGET_CHAIN],
        });
      } else {
        throw switchError;
      }
    }

    // Обновляем провайдер после переключения
    this.provider = new ethers.BrowserProvider(window.ethereum);
    this.signer   = await this.provider.getSigner();
    this.chainId  = TARGET_CHAIN_ID;
  }

  // ───────────────────────────────────────────────────
  // ОТКЛЮЧЕНИЕ
  // ───────────────────────────────────────────────────

  disconnect() {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', this._handleAccountsChanged);
      window.ethereum.removeListener('chainChanged',    this._handleChainChanged);
    }
    this.provider    = null;
    this.signer      = null;
    this.address     = null;
    this.isConnected = false;
  }

  // ───────────────────────────────────────────────────
  // ОБРАБОТЧИКИ СОБЫТИЙ КОШЕЛЬКА
  // ───────────────────────────────────────────────────

  _handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      this.disconnect();
      window.dispatchEvent(new CustomEvent('wallet:disconnected'));
    } else {
      this.address = accounts[0];
      window.dispatchEvent(new CustomEvent('wallet:accountChanged', {
        detail: { address: accounts[0] },
      }));
    }
  }

  _handleChainChanged(chainId) {
    const numericChainId = parseInt(chainId, 16);
    this.chainId = numericChainId;
    window.dispatchEvent(new CustomEvent('wallet:chainChanged', {
      detail: { chainId: numericChainId },
    }));
    if (numericChainId !== TARGET_CHAIN_ID) {
      console.warn('Неправильная сеть! Нужен opBNB (chainId 204)');
    }
  }
}

// Синглтон — один экземпляр на всё приложение
const web3 = new Web3Module();
export default web3;

// ───────────────────────────────────────────────────
// ХЕЛПЕРЫ (используются в компонентах)
// ───────────────────────────────────────────────────

/** Сократить адрес: 0x1234...abcd */
export function shortAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

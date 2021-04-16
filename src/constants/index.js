import { ethers } from 'ethers'
import { ChainId, Token, WETH } from 'uniswap-v2-sdk'
// @TODO: we should test walletconnect, walletlink before adding
import { fortmatic, injected, portis } from '../connectors'


export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const ORDER_GRAPH = {
  1: 'https://api.thegraph.com/subgraphs/name/gelatodigital/limit-orders',
  3: 'https://api.thegraph.com/subgraphs/name/gelatodigital/limit-orders-ropsten'
}

export const FACTORY_ADDRESSES = {
  1: '0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95',
  3: '0x9c83dCE8CA20E9aAF9D3efc003b2ea62aBC08351',
}

export const MULTICALL_ADDRESS = {
  1: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
}

export const UNISWAPEX_ADDRESSES = {
  [ChainId.MAINNET]: '0x36049D479A97CdE1fC6E2a5D2caE30B666Ebf92B',
  [ChainId.ROPSTEN]: '0x0e5096D201Fe2985f5C26432A76f145D6e5D1453',
}

export const LIMIT_ORDER_MODULE_ADDRESSES = {
  [ChainId.MAINNET]: '0x037fc8e71445910e1E0bBb2a0896d5e9A7485318',
  [ChainId.ROPSTEN]: '0x3f3C13b09B601fb6074124fF8D779d2964caBf8B',
}

export const UNISWAPV2_ADDRESSES = {
  1: {
    FACTORY: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
  },
  3: {
    FACTORY: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
  }
}

export const GENERIC_GAS_LIMIT_ORDER_EXECUTE = ethers.BigNumber.from(400000)

export const ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

export const DAI = new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin')
export const USDC = new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD//C')
export const USDT = new Token(ChainId.MAINNET, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether USD')
export const COMP = new Token(ChainId.MAINNET, '0xc00e94Cb662C3520282E6f5717214004A7f26888', 18, 'COMP', 'Compound')
export const MKR = new Token(ChainId.MAINNET, '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 18, 'MKR', 'Maker')

const WETH_ONLY = {
  [ChainId.MAINNET]: [WETH[ChainId.MAINNET]],
  [ChainId.ROPSTEN]: [WETH[ChainId.ROPSTEN]],
  [ChainId.RINKEBY]: [WETH[ChainId.RINKEBY]],
  [ChainId.GÖRLI]: [WETH[ChainId.GÖRLI]],
  [ChainId.KOVAN]: [WETH[ChainId.KOVAN]]
}

// used to construct intermediary pairs for trading
export const BASES_TO_CHECK_TRADES_AGAINST = {
  ...WETH_ONLY,
  [ChainId.MAINNET]: [...WETH_ONLY[ChainId.MAINNET], DAI, USDC, USDT, COMP, MKR]
}

export const NetworkContextName = 'NETWORK'

const TESTNET_CAPABLE_WALLETS = {
  INJECTED: {
    connector: injected,
    name: 'Injected',
    iconName: 'arrow-right.svg',
    description: 'Injected web3 provider.',
    href: null,
    color: '#010101',
    primary: true
  },
  METAMASK: {
    connector: injected,
    name: 'MetaMask',
    iconName: 'metamask.png',
    description: 'Easy-to-use browser extension.',
    href: null,
    color: '#E8831D'
  }
}

export const SUPPORTED_WALLETS = {
  ...TESTNET_CAPABLE_WALLETS,
  ...{
    // WALLET_CONNECT: {
    //   connector: walletconnect,
    //   name: 'WalletConnect',
    //   iconName: 'walletConnectIcon.svg',
    //   description: 'Connect to Trust Wallet, Rainbow Wallet and more...',
    //   href: null,
    //   color: '#4196FC',
    //   mobile: true
    // },
    // WALLET_LINK: {
    //   connector: walletlink,
    //   name: 'Coinbase Wallet',
    //   iconName: 'coinbaseWalletIcon.svg',
    //   description: 'Use Coinbase Wallet app on mobile device',
    //   href: null,
    //   color: '#315CF5'
    // },
    // COINBASE_LINK: {
    //   name: 'Open in Coinbase Wallet',
    //   iconName: 'coinbaseWalletIcon.svg',
    //   description: 'Open in Coinbase Wallet app.',
    //   href: 'https://go.cb-w.com/mtUDhEZPy1',
    //   color: '#315CF5',
    //   mobile: true,
    //   mobileOnly: true
    // },
    Portis: {
      connector: portis,
      name: 'Portis',
      iconName: 'portisIcon.png',
      description: 'Login using Portis hosted wallet',
      href: null,
      color: '#4A6C9B',
      mobile: true
    },
    FORTMATIC: {
      connector: fortmatic,
      name: 'Fortmatic',
      iconName: 'fortmaticIcon.png',
      description: 'Login using Fortmatic hosted wallet',
      href: null,
      color: '#6748FF',
      mobile: true
    }
  }
}

export const MULTICALL_NETWORKS = {
  [ChainId.MAINNET]: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441',
  [ChainId.ROPSTEN]: '0x53C43764255c17BD724F74c4eF150724AC50a3ed',
  [ChainId.KOVAN]: '0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A',
  [ChainId.RINKEBY]: '0x42Ad527de7d4e9d9d011aC45B31D8551f8Fe9821',
  [ChainId.GÖRLI]: '0x77dCa2C955b15e9dE4dbBCf1246B4B85b651e50e'
}

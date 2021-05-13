import { ethers } from 'ethers'
import { Token as UniswapToken, WETH } from 'uniswap-v2-sdk'
import { Token as QuickswapToken, WETH as WMATIC } from 'quickswap-sdk'
import { ChainId } from './networks'
// @TODO: we should test walletconnect, walletlink before adding
import { fortmatic, injected, portis, walletconnect } from '../connectors'

export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const UNISWAPEX_ADDRESSES = {
  [ChainId.MAINNET]: '0x36049D479A97CdE1fC6E2a5D2caE30B666Ebf92B',
  [ChainId.ROPSTEN]: '0x0e5096D201Fe2985f5C26432A76f145D6e5D1453',
  [ChainId.MATIC]: '0x38c4092b28dAB7F3d98eE6524549571c283cdfA5',
}

export const DCA_GRAPH = {
  [ChainId.MAINNET]: 'https://api.thegraph.com/subgraphs/name/gelatodigital/gelato-dca',
  [ChainId.ROPSTEN]: 'https://api.thegraph.com/subgraphs/name/gelatodigital/gelato-dca-ropsten',
}

export const LIMIT_ORDER_MODULE_ADDRESSES = {
  [ChainId.MAINNET]: '0x037fc8e71445910e1E0bBb2a0896d5e9A7485318',
  [ChainId.ROPSTEN]: '0x3f3C13b09B601fb6074124fF8D779d2964caBf8B',
  [ChainId.MATIC]: '0x5A36178E38864F5E724A2DaF5f9cD9bA473f7903',
}

export const GENERIC_GAS_LIMIT_ORDER_EXECUTE = ethers.BigNumber.from(400000)

export const ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

export const DAI_MAINNET = new UniswapToken(
  ChainId.MAINNET,
  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  18,
  'DAI',
  'Dai Stablecoin'
)
export const USDC_MAINNET = new UniswapToken(
  ChainId.MAINNET,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  6,
  'USDC',
  'USD//C'
)
export const USDT_MAINNET = new UniswapToken(
  ChainId.MAINNET,
  '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  6,
  'USDT',
  'Tether USD'
)
export const COMP_MAINNET = new UniswapToken(
  ChainId.MAINNET,
  '0xc00e94Cb662C3520282E6f5717214004A7f26888',
  18,
  'COMP',
  'Compound'
)
export const MKR_MAINNET = new UniswapToken(
  ChainId.MAINNET,
  '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
  18,
  'MKR',
  'Maker'
)

export const USDC_MATIC = new QuickswapToken(
  ChainId.MATIC,
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  6,
  'USDC',
  'USD//C'
)
export const DAI_MATIC = new QuickswapToken(
  ChainId.MATIC,
  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  18,
  'DAI',
  'Dai Stablecoin'
)
export const USDT_MATIC = new QuickswapToken(
  ChainId.MATIC,
  '0x3813e82e6f7098b9583FC0F33a962D02018B6803',
  6,
  'USDT',
  'Tether USD'
)
export const WETH_MATIC = new QuickswapToken(
  ChainId.MATIC,
  '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  18,
  'WETH',
  'Wrapped ETH'
)

const WETH_ONLY = {
  [ChainId.MAINNET]: [WETH[ChainId.MAINNET]],
  [ChainId.ROPSTEN]: [WETH[ChainId.ROPSTEN]],
  [ChainId.MATIC]: [WETH_MATIC],
}

// Min order size PER trade
export const DCA_ORDER_THRESHOLD = {
  [ChainId.MAINNET]: '0.2',
  [ChainId.ROPSTEN]: '0.00001',
}

// used to construct intermediary pairs for trading
export const BASES_TO_CHECK_TRADES_AGAINST = {
  ...WETH_ONLY,
  [ChainId.MAINNET]: [
    ...WETH_ONLY[ChainId.MAINNET],
    DAI_MAINNET,
    USDC_MAINNET,
    USDT_MAINNET,
    COMP_MAINNET,
    MKR_MAINNET,
  ],
  [ChainId.MATIC]: [...WETH_ONLY[ChainId.MATIC], DAI_MATIC, USDC_MATIC, USDT_MATIC, WMATIC],
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
    primary: true,
  },
  METAMASK: {
    connector: injected,
    name: 'MetaMask',
    iconName: 'metamask.png',
    description: 'Easy-to-use browser extension.',
    href: null,
    color: '#E8831D',
  },
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
      mobile: true,
    },
    FORTMATIC: {
      connector: fortmatic,
      name: 'Fortmatic',
      iconName: 'fortmaticIcon.png',
      description: 'Login using Fortmatic hosted wallet',
      href: null,
      color: '#6748FF',
      mobile: true,
    },
    WALLET_CONNECT: {
      connector: walletconnect,
      name: 'Wallet Connect',
      iconName: 'walletConnectIcon.svg',
      description: 'Login using Wallet Connect',
      href: null,
      color: '#6748FF',
      mobile: true,
    },
  },
}

export const MULTICALL_NETWORKS = {
  [ChainId.MAINNET]: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441',
  [ChainId.ROPSTEN]: '0x53C43764255c17BD724F74c4eF150724AC50a3ed',
  [ChainId.MATIC]: '0x95028E5B8a734bb7E2071F96De89BABe75be9C8E',
}

export const GELATO_DCA = {
  [ChainId.MAINNET]: '0x1338548a1a6Ec68277496a710815D76A02838216',
  [ChainId.ROPSTEN]: '0x8E9918Fc02826aa2283f890F6cE439085c615665',
}

export const PLATFORM_WALLET = {
  [ChainId.MAINNET]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895',
  [ChainId.ROPSTEN]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895',
  [ChainId.KOVAN]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895',
  [ChainId.RINKEBY]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895',
  [ChainId.GÖRLI]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895',
}

export const ALL_INTERVALS = ['1 hour', '1 day', '1 week']

export const KYBER = 0
export const UNI = 1
export const SUSHI = 2

import { ethers } from 'ethers'
import { ChainId, Token, WETH } from 'uniswap-v2-sdk'
// @TODO: we should test walletconnect, walletlink before adding
import { fortmatic, injected, portis } from '../connectors'

export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const UNISWAPEX_ADDRESSES = {
  [ChainId.MAINNET]: '0x36049D479A97CdE1fC6E2a5D2caE30B666Ebf92B',
  [ChainId.ROPSTEN]: '0x0e5096D201Fe2985f5C26432A76f145D6e5D1453',
}

export const DCA_GRAPH = {
  [ChainId.MAINNET]: 'https://api.thegraph.com/subgraphs/name/gelatodigital/gelato-dca',
  [ChainId.ROPSTEN]: 'https://api.thegraph.com/subgraphs/name/gelatodigital/gelato-dca-ropsten'
}

export const LIMIT_ORDER_MODULE_ADDRESSES = {
  [ChainId.MAINNET]: '0x037fc8e71445910e1E0bBb2a0896d5e9A7485318',
  [ChainId.ROPSTEN]: '0x3f3C13b09B601fb6074124fF8D779d2964caBf8B',
}

export const GUNIV3_METAPOOL_ADDRESSES = {
  [ChainId.MAINNET]: '0x810F9C4613f466F02cC7Da671a3ba9a7e8c33c69',
  [ChainId.ROPSTEN]: '0xA49eD4E312aC5911C4fF391a20131F86Fc43845A',
}

export const UNIV3_POOL_ADDRESSES = {
  [ChainId.MAINNET]: '0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8',
  [ChainId.ROPSTEN]: '0x25D0Ea8FAc3Ce2313c6a478DA92e0ccf95213B1A',
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

// Min order size PER trade
export const DCA_ORDER_THRESHOLD = {
  [ChainId.MAINNET]: "0.2",
  [ChainId.ROPSTEN]: "0.00001"
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

export const GELATO_DCA = {
  [ChainId.MAINNET]: '0x1338548a1a6Ec68277496a710815D76A02838216',
  [ChainId.ROPSTEN]: '0x8E9918Fc02826aa2283f890F6cE439085c615665',
}

export const PLATFORM_WALLET = {
  [ChainId.MAINNET]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895',
  [ChainId.ROPSTEN]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895',
  [ChainId.KOVAN]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895',
  [ChainId.RINKEBY]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895',
  [ChainId.GÖRLI]: '0xAabB54394E8dd61Dd70897E9c80be8de7C64A895'
}

export const ALL_INTERVALS = ["1 hour", "1 day", "1 week"]

export const KYBER = 0
export const UNI = 1
export const SUSHI = 2

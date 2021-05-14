import Polygon from '../assets/networks/polygon-network.jpg'
import Mainnet from '../assets/networks/mainnet-network.jpg'
import Ropsten from '../assets/networks/ropsten-network.jpg'

export const ChainId = {
  MAINNET: 1,
  ROPSTEN: 3,
  MATIC: 137,
}

export const NETWORK_ICON = {
  [ChainId.MAINNET]: Mainnet,
  [ChainId.ROPSTEN]: Ropsten,
  [ChainId.MATIC]: Polygon,
}

export const NETWORK_LABEL = {
  [ChainId.MAINNET]: 'Ethereum',
  [ChainId.ROPSTEN]: 'Ropsten (Testnet)',
  [ChainId.MATIC]: 'Polygon (Matic)',
}

export const NATIVE_TOKEN_TICKER = {
  [ChainId.MAINNET]: 'ETH',
  [ChainId.ROPSTEN]: 'ETH',
  [ChainId.MATIC]: 'MATIC',
}

export const NATIVE_WRAPPED_TOKEN_TICKER = {
  [ChainId.MAINNET]: 'WETH',
  [ChainId.ROPSTEN]: 'WETH',
  [ChainId.MATIC]: 'WMATIC',
}

export const NATIVE_TOKEN_NAME = {
  [ChainId.MAINNET]: 'Ether',
  [ChainId.ROPSTEN]: 'Ether',
  [ChainId.MATIC]: 'Matic',
}

export const NATIVE_WRAPPED_TOKEN_ADDRESS = {
  [ChainId.MAINNET]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  [ChainId.ROPSTEN]: '0xc778417e063141139fce010982780140aa0cd5ab',
  [ChainId.MATIC]: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
}
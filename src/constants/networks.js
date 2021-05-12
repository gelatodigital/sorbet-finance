



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
    [ChainId.ROPSTEN]: 'Ropsten',
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




import GELATO_TOKEN_LIST from '@gelatonetwork/default-token-list'
import { useWeb3React } from '@web3-react/core'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { ChainId } from 'uniswap-v2-sdk'
import { getTokenDecimals, getTokenName, getTokenSymbol, isAddress, safeAccess } from '../utils'

const NAME = 'name'
const SYMBOL = 'symbol'
const DECIMALS = 'decimals'
const EXCHANGE_ADDRESS = 'exchangeAddress'

// the Uniswap Default token list lives here
export const DEFAULT_TOKEN_LIST_URL = 'https://unpkg.com/@uniswap/default-token-list@latest'

const UPDATE = 'UPDATE'
const SET_LIST = 'SET_LIST'

const ETH = {
  ETH: {
    [NAME]: 'Ethereum',
    [SYMBOL]: 'ETH',
    [DECIMALS]: 18,
    [EXCHANGE_ADDRESS]: null,
  },
}

export const WETH = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417e063141139fce010982780140aa0cd5ab',
}

const EMPTY_LIST = {
  [ChainId.KOVAN]: {},
  [ChainId.RINKEBY]: {},
  [ChainId.ROPSTEN]: {},
  [ChainId.GÖRLI]: {},
  [ChainId.MAINNET]: {},
}

const TokensDcaContext = createContext()

function useTokensContext() {
  return useContext(TokensDcaContext)
}

function reducer(state, { type, payload }) {
  switch (type) {
    case UPDATE: {
      const { chainId, tokenAddress, name, symbol, decimals } = payload
      return {
        ...state,
        [chainId]: {
          ...(safeAccess(state, [chainId]) || {}),
          [tokenAddress]: {
            [NAME]: name,
            [SYMBOL]: symbol,
            [DECIMALS]: decimals,
          },
        },
      }
    }
    case SET_LIST: {
      return payload
    }
    default: {
      throw Error(`Unexpected action type in TokensContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, EMPTY_LIST)

  useEffect(() => {
    const tokenList = GELATO_TOKEN_LIST.tokens.reduce(
      (tokenMap, token) => {
        if (tokenMap[token.chainId][token.address] !== undefined) {
          console.warn('Duplicate tokens.')
          return tokenMap
        }

        return {
          ...tokenMap,
          [token.chainId]: {
            ...tokenMap[token.chainId],
            [token.address]: token,
          },
        }
      },
      { ...EMPTY_LIST }
    )
    dispatch({ type: SET_LIST, payload: tokenList })
  }, [])

  const update = useCallback((chainId, tokenAddress, name, symbol, decimals) => {
    dispatch({ type: UPDATE, payload: { chainId, tokenAddress, name, symbol, decimals } })
  }, [])

  return (
    <TokensDcaContext.Provider value={useMemo(() => [state, { update }], [state, update])}>
      {children}
    </TokensDcaContext.Provider>
  )
}

export function useTokenDcaDetails(tokenAddress) {
  const { chainId, library } = useWeb3React()

  const [state, { update }] = useTokensContext()
  const allTokensInNetwork = { ...ETH, ...(safeAccess(state, [chainId]) || {}) }
  const { [NAME]: name, [SYMBOL]: symbol, [DECIMALS]: decimals } = safeAccess(allTokensInNetwork, [tokenAddress]) || {}

  useEffect(() => {
    if (
      isAddress(tokenAddress) &&
      (name === undefined || symbol === undefined || decimals === undefined) &&
      (chainId || chainId === 0) &&
      library
    ) {
      let stale = false

      const namePromise = getTokenName(tokenAddress, library).catch(() => null)
      const symbolPromise = getTokenSymbol(tokenAddress, library).catch(() => null)
      const decimalsPromise = getTokenDecimals(tokenAddress, library).catch(() => null)

      Promise.all([namePromise, symbolPromise, decimalsPromise]).then(
        ([resolvedName, resolvedSymbol, resolvedDecimals]) => {
          if (!stale) {
            update(chainId, tokenAddress, resolvedName, resolvedSymbol, resolvedDecimals)
          }
        }
      )
      return () => {
        stale = true
      }
    }
  }, [tokenAddress, name, symbol, decimals, chainId, library, update])

  return { name, symbol, decimals, chainId }
}

export function useAllTokenDcaDetails(r) {
  const { chainId } = useWeb3React()

  const [state] = useTokensContext()
  const tokenDetails = { ...ETH, ...(safeAccess(state, [chainId]) || {}) }

  return tokenDetails
}

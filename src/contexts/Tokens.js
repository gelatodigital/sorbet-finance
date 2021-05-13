import { useWeb3React } from '@web3-react/core'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import * as ls from 'local-storage'
import { utils } from 'ethers'
import { getTokenDecimals, getTokenName, getTokenSymbol, isAddress, safeAccess } from '../utils'
import { DEFAULT_TOKENS_EXTRA, DISABLED_TOKENS } from './DefaultTokens'
import { NATIVE_TOKEN_TICKER, ChainId } from '../constants/networks'

const NAME = 'name'
const SYMBOL = 'symbol'
const DECIMALS = 'decimals'
const EXCHANGE_ADDRESS = 'exchangeAddress'

// the Uniswap Default token list lives here
export const DEFAULT_TOKEN_LIST_URL = {
  ETH: 'https://unpkg.com/@uniswap/default-token-list@latest',
  MATIC: 'https://unpkg.com/quickswap-default-token-list@1.0.55/build/quickswap-default.tokenlist.json',
}

const UPDATE = 'UPDATE'
const SET_LIST = 'SET_LIST'

const CHAIN_TOKENS = {
  ETH: {
    ETH: {
      [NAME]: 'Ethereum',
      [SYMBOL]: 'ETH',
      [DECIMALS]: 18,
      [EXCHANGE_ADDRESS]: null,
    },
  },
  MATIC: {
    MATIC: {
      [NAME]: 'Matic',
      [SYMBOL]: 'MATIC',
      [DECIMALS]: 18,
      [EXCHANGE_ADDRESS]: null,
    },
  },
}

export const WETH = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417e063141139fce010982780140aa0cd5ab',
  137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
}

const EMPTY_LIST = {
  [ChainId.MATIC]: {},
  [ChainId.ROPSTEN]: {},
  [ChainId.MAINNET]: {},
}

const TokensContext = createContext()

function useTokensContext() {
  return useContext(TokensContext)
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
  const { chainId } = useWeb3React()
  useEffect(() => {
    fetch(DEFAULT_TOKEN_LIST_URL[NATIVE_TOKEN_TICKER[chainId]])
      .then((res) =>
        res.json().then((list) => {
          const tokenList = list.tokens
            .filter((token) => !DISABLED_TOKENS[token.symbol])
            .concat(DEFAULT_TOKENS_EXTRA)
            .reduce(
              (tokenMap, token) => {
                try {
                  const tokenAddress = utils.getAddress(token.address)
                  if (tokenMap[token.chainId][tokenAddress] !== undefined) {
                    console.warn('Duplicate tokens.')
                    return tokenMap
                  }

                  return {
                    ...tokenMap,
                    [token.chainId]: {
                      ...tokenMap[token.chainId],
                      [tokenAddress]: token,
                    },
                  }
                } catch (error) {
                  return {
                    ...tokenMap,
                  }
                }
              },
              { ...EMPTY_LIST }
            )

          dispatch({ type: SET_LIST, payload: tokenList })
        })
      )
      .catch((e) => console.error(e.message))
  }, [chainId])

  const update = useCallback((chainId, tokenAddress, name, symbol, decimals) => {
    dispatch({ type: UPDATE, payload: { chainId, tokenAddress, name, symbol, decimals } })
  }, [])

  return (
    <TokensContext.Provider value={useMemo(() => [state, { update }], [state, update])}>
      {children}
    </TokensContext.Provider>
  )
}

export function useTokenDetails(tokenAddress) {
  const { chainId, library } = useWeb3React()
  const [state, { update }] = useTokensContext()
  const allTokensInNetwork = { ...CHAIN_TOKENS[NATIVE_TOKEN_TICKER[chainId]], ...(safeAccess(state, [chainId]) || {}) }
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

export function useAllTokenDetails(r) {
  const { chainId } = useWeb3React()

  const [state] = useTokensContext()
  const tokenDetails = { ...CHAIN_TOKENS[NATIVE_TOKEN_TICKER[chainId]], ...(safeAccess(state, [chainId]) || {}) }

  return tokenDetails
}

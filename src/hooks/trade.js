import { Trade as UniswapTrade, TokenAmount as UniswapTokenAmount, Pair as UniswapPair, Token as UniswapToken, CurrencyAmount as UniswapCurrencyAmount, ETHER, WETH, JSBI } from 'uniswap-v2-sdk'
import { Trade as QuickswapTrade, TokenAmount as QuickswapTokenAmount, Pair as QuickswapPair, Token as QuickswapToken, ETHER as MATIC, WETH as WMATIC, CurrencyAmount as QuickswapCurrencyAmount } from 'quickswap-sdk'
import flatMap from 'lodash.flatmap'
import { useMemo } from 'react'
import { Interface } from '@ethersproject/abi'
import { parseUnits } from '@ethersproject/units'
import * as ls from 'local-storage'

import { BASES_TO_CHECK_TRADES_AGAINST } from '../constants'
import PAIR_ABI from '../constants/abis/pair.json'
import { useActiveWeb3React } from './index'
import { useTokenDetails } from '../contexts/Tokens'
import { NATIVE_TOKEN_TICKER } from '../constants/networks'

import { useMultipleContractSingleData } from '../state/multicall/hooks'

export const PairState = {
  LOADING: 'LOADING',
  NOT_EXISTS: 'NOT_EXISTS',
  EXISTS: 'EXISTS',
  INVALID: 'INVALID'
}

const PAIR_INTERFACE = new Interface(PAIR_ABI)


const getBestTradeExactIn = (chainId, allowedPairs, currencyAmountIn, currencyOut) =>{
  if(NATIVE_TOKEN_TICKER[chainId] === "ETH"){
    return UniswapTrade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, {
      maxHops: 3,
      maxNumResults: 1
    })[0]
  }
  if(NATIVE_TOKEN_TICKER[chainId] === "MATIC"){
    return QuickswapTrade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, {
      maxHops: 3,
      maxNumResults: 1
    })[0]
  }
}

const getTokenAmount = (chainId, token0, reserve0)=>{
  if(NATIVE_TOKEN_TICKER[chainId] === "ETH"){
    return new UniswapTokenAmount(token0, reserve0)
  }
  if(NATIVE_TOKEN_TICKER[chainId] === "MATIC"){
    return new QuickswapTokenAmount(token0, reserve0)
  }
}

const getPair = (chainId, tokenA, tokenB)=>{
  if(NATIVE_TOKEN_TICKER[chainId] === "ETH"){
    return new UniswapPair(tokenA, tokenB)
  }
  if(NATIVE_TOKEN_TICKER[chainId] === "MATIC"){
    return new QuickswapPair(tokenA, tokenB)
  }
}

const getPairAddress = (chainId, tokenA, tokenB)=>{
  if(NATIVE_TOKEN_TICKER[chainId] === "ETH"){
    return UniswapPair.getAddress(tokenA, tokenB)
  }
  if(NATIVE_TOKEN_TICKER[chainId] === "MATIC"){
    return QuickswapPair.getAddress(tokenA, tokenB)
  }
}

const getToken = (chainId,currencyAddress, decimals, symbol, name)=>{
  if(NATIVE_TOKEN_TICKER[chainId] === "ETH"){
    return currencyAddress === 'ETH'
        ? ETHER :
        new UniswapToken(chainId, currencyAddress, decimals, symbol, name)
  }
  if(NATIVE_TOKEN_TICKER[chainId] === "MATIC"){
    return currencyAddress === 'MATIC'
    ? MATIC :
    new QuickswapToken(chainId, currencyAddress, decimals, symbol, name)
  }
}

function useAllCommonPairs(currencyA, currencyB) {
  const { chainId } = useActiveWeb3React()

  const bases = chainId ? BASES_TO_CHECK_TRADES_AGAINST[chainId] : []

  const [tokenA, tokenB] = chainId
    ? [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)]
    : [undefined, undefined]

  const allPairCombinations = useMemo(
    () => [
      // the direct pair
      [tokenA, tokenB],
      // token A against all bases
      ...bases.map(base => [tokenA, base]),
      // token B against all bases
      ...bases.map(base => [tokenB, base]),
      // each base against all bases
      ...flatMap(bases, base => bases.map(otherBase => [base, otherBase]))
    ],
    [tokenA, tokenB, bases]
  )

  const allPairs = usePairs(allPairCombinations)

  // only pass along valid pairs, non-duplicated pairs
  return useMemo(
    () =>
      Object.values(
        allPairs
          // filter out invalid pairs
          .filter(result => Boolean(result[0] === PairState.EXISTS && result[1]))
          // filter out duplicated pairs
          .reduce((memo, [, curr]) => {
            memo[curr.liquidityToken.address] = memo[curr.liquidityToken.address]
              ? memo[curr.liquidityToken.address]
              : curr
            return memo
          }, {})
      ),
    [allPairs]
  )
}

/**
 * Returns the best trade for the exact amount of tokens in to the given token out
 */
export function useTradeExactIn(currencyAddressIn, currencyValueIn, currencyAddressOut) {
  const chainId = ls.get("chainId")
  const currencyIn = useTokenDetails(currencyAddressIn)
  const currencyOutDetail = useTokenDetails(currencyAddressOut)
  const currencyOut = currencyAddressOut && currencyOutDetail && currencyOutDetail.decimals
    ?  getToken(
          currencyOutDetail.chainId,
          currencyAddressOut,
          currencyOutDetail.decimals,
          currencyOutDetail.symbol,
          currencyOutDetail.name
        )
    : undefined

    const currencyAmountIn = tryParseAmount(
    currencyValueIn,
    currencyAddressIn && currencyIn.symbol
      ? getToken(currencyIn.chainId, currencyAddressIn, currencyIn.decimals, currencyIn.symbol, currencyIn.name)
      : undefined
  )

  const allowedPairs = useAllCommonPairs(currencyAmountIn ? currencyAmountIn.currency : undefined, currencyOut)

  return useMemo(() => {
    if (currencyAmountIn && currencyOut && allowedPairs.length > 0) {
      try {
        const tradeRes = getBestTradeExactIn(chainId, allowedPairs, currencyAmountIn, currencyOut)
        return tradeRes ? tradeRes : null
      } catch{}
    }
    return null
  }, [allowedPairs, currencyAmountIn, currencyOut, chainId])
}

export function usePairs(currencies) {
  const { chainId } = useActiveWeb3React()

  const tokens = useMemo(
    () =>
      currencies.map(([currencyA, currencyB]) => [
        wrappedCurrency(currencyA, chainId),
        wrappedCurrency(currencyB, chainId)
      ]),
    [chainId, currencies]
  )

  const pairAddresses = useMemo(
    () =>
      tokens.map(([tokenA, tokenB]) => {
        return tokenA && tokenB && !tokenA.equals(tokenB) ? getPairAddress(chainId, tokenA, tokenB) : undefined
      }),
    [tokens, chainId]
  )

  const results = useMultipleContractSingleData(pairAddresses, PAIR_INTERFACE, 'getReserves')

  return useMemo(() => {
    return results.map((result, i) => {
      const { result: reserves, loading } = result
      const tokenA = tokens[i][0]
      const tokenB = tokens[i][1]

      if (loading) return [PairState.LOADING, null]
      if (!tokenA || !tokenB || tokenA.equals(tokenB)) return [PairState.INVALID, null]
      if (!reserves) return [PairState.NOT_EXISTS, null]
      const { _reserve0, _reserve1 } = reserves

      const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
      return [
        PairState.EXISTS,
        getPair(chainId, getTokenAmount(chainId, token0, _reserve0.toString()), getTokenAmount(chainId, token1, _reserve1.toString()))
      ]
    })
  }, [results, tokens, chainId])
}

export function usePair(tokenA, tokenB) {
  return usePairs([[tokenA, tokenB]])[0]
}

export function wrappedCurrency(currency, chainId) {
  //   return chainId && currency === ETHER ? WETH[chainId] : currency instanceof Token ? currency : undefined

if(chainId){
  if(NATIVE_TOKEN_TICKER[chainId] === "ETH")
  return  currency === ETHER ? WETH[chainId] : currency instanceof UniswapToken ? currency : undefined
  if(NATIVE_TOKEN_TICKER[chainId] === "MATIC")
  return  currency === MATIC ? WMATIC[chainId] : currency instanceof QuickswapToken ? currency : undefined
}else return undefined

}

// try to parse a user entered amount for a given token
export function tryParseAmount(value, currency) {
  if (!value || !currency) {
    return
  }
  try {
    const chainId = ls.get("chainId")
    const typedValueParsed = parseUnits(value.toString(), currency.decimals).toString()
    if (typedValueParsed !== '0') {
      if(NATIVE_TOKEN_TICKER[chainId] === "ETH")
      return currency instanceof UniswapToken
        ? getTokenAmount(chainId, currency, JSBI.BigInt(typedValueParsed))
        : UniswapCurrencyAmount.ether(JSBI.BigInt(typedValueParsed))
      if(NATIVE_TOKEN_TICKER[chainId] === "MATIC")
      return currency instanceof QuickswapToken
        ? getTokenAmount(chainId, currency, JSBI.BigInt(typedValueParsed))
        : QuickswapCurrencyAmount.ether(JSBI.BigInt(typedValueParsed))
    }
  } catch (error) {
    // should fail if the user specifies too many decimal places of precision (or maybe exceed max uint?)
    console.error(`Failed to parse input amount: "${value}"`, error)
  }
  // necessary for all paths to return a value
  return
}

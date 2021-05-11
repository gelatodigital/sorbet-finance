import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import * as ls from 'local-storage'
import React, { useEffect, useReducer, useState } from 'react'
//import ReactGA from 'react-ga'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { useFetchAllBalances } from '../../contexts/AllBalances'
import { useAddressBalance } from '../../contexts/Balances'
//import { useGasPrice } from '../../contexts/GasPrice'
import { usePendingApproval, useTransactionAdder } from '../../contexts/Transactions'
import { Button } from '../../theme'
import { useGelatoMetapoolContract, usePoolV3Contract, useTokenContract } from '../../hooks'
//import { getExchangeRate } from '../../utils/rate'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import OversizedPanel from '../../components/OversizedPanel'
import { BigNumber } from "bignumber.js";
import ModeSelector from '../AddLiquidity/ModeSelector'
import { useGasPrice } from '../../contexts/GasPrice'

/* eslint-disable-next-line */
BigNumber.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

// returns the sqrt price as a 64x96
function encodePriceSqrt(reserve1, reserve0) {
  return new BigNumber(reserve1)
    .div(reserve0)
    .sqrt()
    .multipliedBy(new BigNumber(2).pow(96))
    .integerValue(3)
    .toString();
}

const GUNI_OP = 0

const BlueSpan = styled.span`
  color: ${({ theme }) => theme.royalBlue};
`

const LastSummaryText = styled.div`
  margin-top: 1rem;
`

const DownArrowBackground = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  justify-content: center;
  align-items: center;
`
const SummaryPanel = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap}
  padding: 1rem 0;
`

const CenteredHeader = styled.div`
  text-align: center;
  font-family: Inter, sans-serif;
  font-weight: 600;
`

const ExchangeRateWrapper = styled.div`
  ${({ theme }) => theme.flexRowNoWrap};
  align-items: center;
  color: ${({ theme }) => theme.doveGray};
  font-size: 0.75rem;
  padding: 0.5rem 1rem;
`

const ExchangeRate = styled.span`
  flex: 1 1 auto;
  width: 0;
  color: ${({ theme }) => theme.doveGray};
`

const Flex = styled.div`
  display: flex;
  justify-content: center;
  padding: 1rem;

  button {
    max-width: 20rem;
  }
`

function initialAddLiquidityState(state) {
  return {
    gUniValue: '',
    lastEditedField: GUNI_OP,
  }
}
  
function addLiquidityStateReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_VALUE': {
      const { gUniValue } = state
      const { field, value } = action.payload
      return {
        ...state,
        gUniValue: field === GUNI_OP ? value : gUniValue,
        lastEditedField: field
      }
    }
    default: {
      return initialAddLiquidityState()
    }
  }
}

const getPoolCurrentInfo = async (poolV3, gelatoPool) => {
  const {sqrtPriceX96, tick} = await poolV3.slot0()
  const price = 1/(1.0001**Number(tick))
  const lowerTick = await gelatoPool.currentLowerTick()
  const upperPrice = 1/(1.0001**Number(lowerTick))
  const sqrtUpperPriceX96 = encodePriceSqrt("1", upperPrice.toString())
  const upperTick = await gelatoPool.currentUpperTick()
  const lowerPrice = 1/(1.0001**Number(upperTick))
  const sqrtLowerPriceX96 = encodePriceSqrt("1", lowerPrice.toString())
  const totalSupply = await gelatoPool.totalSupply()
  const {liquidity} = await poolV3.positions(await gelatoPool.getPositionID())
  const {amount0, amount1} = await gelatoPool.getAmountsForLiquidity(sqrtPriceX96, sqrtLowerPriceX96, sqrtUpperPriceX96, liquidity)
  const totalDollarValue = Number(ethers.utils.formatEther(amount0)) + price*Number(ethers.utils.formatEther(amount1))
  return {
    price: price,
    sqrtPrice: sqrtPriceX96,
    upperPrice: upperPrice,
    lowerPrice: lowerPrice,
    amount0: amount0,
    amount1: amount1,
    liquidity: liquidity,
    totalSupply: totalSupply,
    totalDollarValue: totalDollarValue
  }
};
export default function RemoveLiquidity() {
  const { t } = useTranslation()
  const { account, library, active, chainId } = useWeb3React()

  // core swap state
  const [addLiquidityState, dispatchAddLiquidityState] = useReducer(addLiquidityStateReducer, null, initialAddLiquidityState)

  const { gUniValue, lastEditedField } = addLiquidityState

  const [isRemoveLiquidityPending, setIsRemoveLiquidityPending] = useState(null)
  const [wethReturn, setWethReturn] = useState(null)
  const [daiReturn, setDaiReturn] = useState(null)
  const [totalDollarValue, setTotalDollarValue] = useState(null)
  const [marketRate, setMarketRate] = useState(null)
  const [lowerBoundRate, setLowerBoundRate] = useState(null)
  const [upperBoundRate, setUpperBoundRate] = useState(null)
  const [metapoolBalanceWeth, setMetapoolBalanceWeth] = useState(null)
  const [metapoolBalanceDai, setMetapoolBalanceDai] = useState(null)
  const [dollarValueReturn, setDollarValueReturn] = useState(null)
  const [metapoolSupply, setMetapoolSupply] = useState(null)
  const [poolShareBurned, setPoolShareBurned] = useState(null)

  const addTransaction = useTransactionAdder()
  const gasPrice = useGasPrice()

  const [inputError, setInputError] = useState()

  const poolV3 = usePoolV3Contract()
  const gelatoPool = useGelatoMetapoolContract()

  let gelatoPoolAddress = ethers.constants.AddressZero
  if (gelatoPool) {
    gelatoPoolAddress = gelatoPool.address
  }
  const gUniBalance = useAddressBalance(account, gelatoPoolAddress)
  const gUniBalanceFormatted = !!(gUniBalance) ? 0.0001 > Number(ethers.utils.formatEther(gUniBalance)) > 0 ?  ethers.utils.formatEther(gUniBalance) : Number(ethers.utils.formatEther(gUniBalance)).toFixed(5) : ''

  async function onRemoveLiquidity() {
    gelatoPool.burn(ethers.utils.parseEther(gUniValue), {/*gasPrice: gasPrice,*/ gasLimit: 250000}).then((tx) => {
      setIsRemoveLiquidityPending(true);
      tx.wait().then(() => {
        setIsRemoveLiquidityPending(false);
        setWethReturn(null)
        setDaiReturn(null)
        setPoolShareBurned(null)
        dispatchAddLiquidityState({ type: 'UPDATE_VALUE', payload: { value: '', field: GUNI_OP } })
      })
    }).catch((err) => {
      console.log('error removing liquidity!', err)
      setIsRemoveLiquidityPending(false)
    })
  }

  // declare/get parsed and formatted versions of input/output values
  //const [independentValueParsed, setIndependentValueParsed] = useState()
  //const inputValueParsed = independentField === WETH_OP ? independentValueParsed : inputValue
  useEffect(() => {
    setInputError(null)
    if (Number(gUniValue) > 0) {
      gelatoPool.balanceOf(account).then((res) => {
        if (Number(ethers.utils.formatEther(res)) < Number(gUniValue)) {
          setInputError('insufficient Balance!')
          return
        }
      })
      getPoolCurrentInfo(poolV3, gelatoPool).then((result) => {
        setMarketRate(result.price)
        setUpperBoundRate(result.upperPrice)
        setLowerBoundRate(result.lowerPrice)
        setMetapoolBalanceWeth(result.amount1)
        setMetapoolBalanceDai(result.amount0)
        setTotalDollarValue(result.totalDollarValue)
        const percentSupply = gUniValue/Number(ethers.utils.formatEther(result.totalSupply))
        const returnDai = Number(ethers.utils.formatEther(result.amount0))*percentSupply
        const returnWeth = Number(ethers.utils.formatEther(result.amount1))*percentSupply
        const dollarValue = returnDai+(returnWeth*result.price)
        setDaiReturn(returnDai)
        setWethReturn(returnWeth)
        setDollarValueReturn(dollarValue)
        setPoolShareBurned(100*percentSupply)
      })
    }
  }, [gUniValue])

  //let outputValueParsed;
  const allBalances = useFetchAllBalances()

  const isActive = active && account

  const isValid = !inputError && Number(gUniValue) > 0

  function formatBalance(value) {
    return `(${t('balance', { balanceInput: value })})`
  }

  useEffect(() => {
    getPoolCurrentInfo(poolV3, gelatoPool).then((result) => {
      setMarketRate(result.price)
      setUpperBoundRate(result.upperPrice)
      setLowerBoundRate(result.lowerPrice)
      setMetapoolBalanceWeth(result.amount1)
      setMetapoolBalanceDai(result.amount0)
      setTotalDollarValue(result.totalDollarValue)
      setMetapoolSupply(result.totalSupply)
    })
  }, []);

  return <>
      {gelatoPool ? 
        <>
          <OversizedPanel hideBottom>
            <SummaryPanel>
              <CenteredHeader>
                Gelato's Uniswap V3 WETH/DAI Automated LP
                <br></br>
                <ExchangeRateWrapper><ExchangeRate>
                  An ERC20 aggregating V3 LPs to passively earn competitive yeild
                  <br></br>
                  <a href="https://gelato-1.gitbook.io/sorbet-finance/">Learn More</a>
                </ExchangeRate></ExchangeRateWrapper>
              </CenteredHeader>
            </SummaryPanel>
          </OversizedPanel>
          <br></br>
          <ModeSelector />
          <CurrencyInputPanel
            title={'Burn'}
            allBalances={allBalances}
            extraText={gUniBalanceFormatted && formatBalance(gUniBalanceFormatted)}
            extraTextClickHander={() => {
              if (gUniBalance) {
                if (gUniBalance.gt(ethers.constants.Zero)) {
                  dispatchAddLiquidityState({
                    type: 'UPDATE_VALUE',
                    payload: { value: ethers.utils.formatEther(gUniBalance), field: GUNI_OP }
                  })
                }
              }
            }}
            onValueChange={gUniValue => {
              dispatchAddLiquidityState({ type: 'UPDATE_VALUE', payload: { value: gUniValue, field: GUNI_OP } })
            }}
            selectedTokenAddress={gelatoPool.address}
            value={gUniValue}
            errorMessage={inputError ? inputError : ''}
            disableTokenSelect
            disableUnlock
          />
          <OversizedPanel hideBottom>
            <SummaryPanel>
              <CenteredHeader>You Receive: {(wethReturn && daiReturn && dollarValueReturn) ? `${wethReturn.toFixed(3)} WETH + ${daiReturn.toFixed(3)} DAI (~ $${dollarValueReturn.toFixed(2)})` : '-'}</CenteredHeader>
            </SummaryPanel>
            <ExchangeRateWrapper>
                <ExchangeRate>{t('exchangeRate')}</ExchangeRate>
                {<span>{marketRate  ? `1 WETH = ${marketRate.toFixed(3)} DAI` : ' - '}</span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Gelato Pool Position Range'}</ExchangeRate>
                {<span>
                  {lowerBoundRate && upperBoundRate
                    ? `${lowerBoundRate.toFixed(3)} WETH <---> ${upperBoundRate.toFixed(3)} DAI`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Gelato Pool Position Before'}</ExchangeRate>
                {<span>
                  {(metapoolBalanceWeth && metapoolBalanceDai && totalDollarValue)
                    ? `${Number(ethers.utils.formatEther(metapoolBalanceWeth)).toFixed(3)} WETH + ${Number(ethers.utils.formatEther(metapoolBalanceDai)).toFixed(3)} DAI (~ $${totalDollarValue.toFixed(2)})`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Gelato Pool Position After'}</ExchangeRate>
                {<span>
                  {(metapoolBalanceWeth && metapoolBalanceDai && wethReturn && daiReturn && totalDollarValue && dollarValueReturn)
                    ? `${(Number(ethers.utils.formatEther(metapoolBalanceWeth)) - Number(wethReturn)).toFixed(3)} WETH + ${(Number(ethers.utils.formatEther(metapoolBalanceDai)) - Number(daiReturn)).toFixed(3)} DAI (~ $${(totalDollarValue-dollarValueReturn).toFixed(2)})`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{`Pool Token Supply After (${poolShareBurned ? '-'+poolShareBurned.toFixed(2) : '-'}%)`}</ExchangeRate>
                {<span>
                  {(metapoolSupply && gUniValue) ?  (Number(ethers.utils.formatEther(metapoolSupply))-Number(gUniValue)).toFixed(5) + ' gUNIV3': '-'}
                  </span>}
              </ExchangeRateWrapper>
          </OversizedPanel>
          <Flex>
            <Button disabled={!isValid || isRemoveLiquidityPending } onClick={onRemoveLiquidity}>
              {!isRemoveLiquidityPending ? t('removeLiquidity') : "Pending..."}
            </Button>
          </Flex>
        </>
      :
        <>
          <OversizedPanel hideBottom>
            <SummaryPanel>Network not Supported</SummaryPanel>
          </OversizedPanel>
        </>
      }
  </>
}
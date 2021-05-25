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
import { useTokenDetails } from '../../contexts/Tokens'
import { WETH, DAI } from '../../contexts/TokensDca'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import OversizedPanel from '../../components/OversizedPanel'
import { BigNumber } from "bignumber.js";
import ModeSelector from '../AddLiquidity/ModeSelector'
import { getCounterfactualFees } from '../AddLiquidity/feeMath'
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

const getPoolCurrentInfo = async (poolV3, gelatoPool, wethContract, daiContract) => {
  const {sqrtPriceX96, tick} = await poolV3.slot0()
  const price = 1/(1.0001**Number(tick))
  const lowerTick = await gelatoPool.currentLowerTick()
  const upperPrice = 1/(1.0001**Number(lowerTick))
  const sqrtUpperPriceX96 = encodePriceSqrt("1", upperPrice.toString())
  const upperTick = await gelatoPool.currentUpperTick()
  const lowerPrice = 1/(1.0001**Number(upperTick))
  const sqrtLowerPriceX96 = encodePriceSqrt("1", lowerPrice.toString())
  const totalSupply = await gelatoPool.totalSupply()
  const {liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1} = await poolV3.positions(await gelatoPool.getPositionID())
  const {
    feeGrowthOutside0X128: feeGrowthOutsideL0,
    feeGrowthOutside1X128: feeGrowthOutsideL1,
  } = await poolV3.ticks(lowerTick);
  const {
    feeGrowthOutside0X128: feeGrowthOutsideU0,
    feeGrowthOutside1X128: feeGrowthOutsideU1,
  } = await poolV3.ticks(upperTick);
  const feeGlobal0 = await poolV3.feeGrowthGlobal0X128();
  const feeGlobal1 = await poolV3.feeGrowthGlobal1X128();
  const {amount0, amount1} = await gelatoPool.getAmountsForLiquidity(sqrtPriceX96, sqrtLowerPriceX96, sqrtUpperPriceX96, liquidity)
  const totalDollarValue = Number(ethers.utils.formatEther(amount0)) + price*Number(ethers.utils.formatEther(amount1))
  const maxTokens = await gelatoPool.supplyCap();
  const fee0 = getCounterfactualFees(
    feeGlobal0,
    feeGrowthOutsideL0,
    feeGrowthOutsideU0,
    feeGrowthInside0LastX128,
    Number(tick),
    liquidity,
    Number(lowerTick),
    Number(upperTick)
  );

  const fee1 = getCounterfactualFees(
    feeGlobal1,
    feeGrowthOutsideL1,
    feeGrowthOutsideU1,
    feeGrowthInside1LastX128,
    Number(tick),
    liquidity,
    Number(lowerTick),
    Number(upperTick)
  );
  const feeTotalDollarValue = Number(ethers.utils.formatEther(fee0)) + Number(ethers.utils.formatEther(tokensOwed0)) + price*(Number(ethers.utils.formatEther(fee1)) + Number(ethers.utils.formatEther(tokensOwed1)));
  const timestamp = await gelatoPool.lastRebalanceTimestamp();
  const timeDiff = Number(new Date().getTime() / 1000) - timestamp;
  const feePerYear = feeTotalDollarValue * 31557600  / timeDiff;
  const apyLong = feePerYear/totalDollarValue;
  const feeTotalValue2 = Number(ethers.utils.formatEther(fee0)) + price*Number(ethers.utils.formatEther(fee1));
  const timestamp2 = await gelatoPool.lastMintOrBurnTimestamp();
  const timeDiff2 = Number(new Date().getTime() / 1000) - timestamp2;
  const feePerYear2 = feeTotalValue2 * 31557600  / timeDiff2;
  const apyShort = feePerYear2/totalDollarValue;
  let apy = 0;
  if (apyShort > apyLong) {
    apy = apyShort;
  } else {
    apy = apyLong;
  }
  const leftover0 = await daiContract.balanceOf(gelatoPool.address);
  const leftover1 = await wethContract.balanceOf(gelatoPool.address);
  return {
    price: price,
    sqrtPrice: sqrtPriceX96,
    upperPrice: upperPrice,
    lowerPrice: lowerPrice,
    amount0: amount0,
    amount1: amount1,
    liquidity: liquidity,
    totalSupply: totalSupply,
    totalDollarValue: totalDollarValue,
    supplyCap: maxTokens,
    fee0: fee0.add(tokensOwed0),
    fee1: fee1.add(tokensOwed1),
    feesDollarValue: feeTotalDollarValue,
    apy: apy,
    leftover0: leftover0,
    leftover1: leftover1
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
  const [unclaimedFeeDai, setUnclaimedFeeDai] = useState(null)
  const [unclaimedFeeWeth, setUnclaimedFeeWeth] = useState(null)
  const [unclaimedFeesDollarValue, setUnclaimedFeesDollarValue] = useState(null)
  const [apy, setApy] = useState(null)

  const addTransaction = useTransactionAdder()
  const gasPrice = useGasPrice()

  const [inputError, setInputError] = useState()

  const poolV3 = usePoolV3Contract()
  const gelatoPool = useGelatoMetapoolContract()

  const wethAddress = WETH[chainId]
  const daiAddress = DAI[chainId]
  const { symbol: wethSymbol } = useTokenDetails(wethAddress)
  const { symbol: daiSymbol } = useTokenDetails(daiAddress)

  const wethContract = useTokenContract(wethAddress)
  const daiContract = useTokenContract(daiAddress)

  let gelatoPoolAddress = ethers.constants.AddressZero
  if (gelatoPool) {
    gelatoPoolAddress = gelatoPool.address
  }
  const gUniBalance = useAddressBalance(account, gelatoPoolAddress)
  const gUniBalanceFormatted = !!(gUniBalance) ? 0.0001 > Number(ethers.utils.formatEther(gUniBalance)) > 0 ?  ethers.utils.formatEther(gUniBalance) : Number(ethers.utils.formatEther(gUniBalance)).toFixed(5) : ''

  async function onRemoveLiquidity() {
    gelatoPool.burn(ethers.utils.parseEther(gUniValue), account, {gasPrice: gasPrice, gasLimit: 300000}).then((tx) => {
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
      getPoolCurrentInfo(poolV3, gelatoPool, wethContract, daiContract).then((result) => {
        setMarketRate(result.price)
        setUpperBoundRate(result.upperPrice)
        setLowerBoundRate(result.lowerPrice)
        setMetapoolBalanceWeth(result.amount1)
        setMetapoolBalanceDai(result.amount0)
        setMetapoolSupply(result.totalSupply)
        setTotalDollarValue(result.totalDollarValue)
        setUnclaimedFeeDai(result.fee0)
        setUnclaimedFeeWeth(result.fee1)
        setUnclaimedFeesDollarValue(result.feesDollarValue)
        setApy(result.apy)
        const percentSupply = gUniValue/Number(ethers.utils.formatEther(result.totalSupply))
        const returnDai = (Number(ethers.utils.formatEther(result.amount0))*percentSupply)+(Number(ethers.utils.formatEther(result.leftover0))*percentSupply)
        const returnWeth = (Number(ethers.utils.formatEther(result.amount1))*percentSupply)+(Number(ethers.utils.formatEther(result.leftover1))*percentSupply)
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
    getPoolCurrentInfo(poolV3, gelatoPool, wethContract, daiContract).then((result) => {
      setMarketRate(result.price)
      setUpperBoundRate(result.upperPrice)
      setLowerBoundRate(result.lowerPrice)
      setMetapoolBalanceWeth(result.amount1)
      setMetapoolBalanceDai(result.amount0)
      setTotalDollarValue(result.totalDollarValue)
      setMetapoolSupply(result.totalSupply)
      setUnclaimedFeeDai(result.fee0)
      setUnclaimedFeeWeth(result.fee1)
      setUnclaimedFeesDollarValue(result.feesDollarValue)
      setApy(result.apy)
    })
  }, []);

  return <>
      {(gelatoPool && apy) ? 
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
                {<span>{marketRate  ? `1 ${wethSymbol} = ${marketRate.toFixed(3)} ${daiSymbol}` : ' - '}</span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Position Range'}</ExchangeRate>
                {<span>
                  {lowerBoundRate && upperBoundRate
                    ? `${lowerBoundRate.toFixed(3)} ${daiSymbol} <---> ${upperBoundRate.toFixed(3)} ${daiSymbol}`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Position Capital'}</ExchangeRate>
                {<span>
                  {(metapoolBalanceWeth && metapoolBalanceDai && totalDollarValue)
                    ? `${Number(ethers.utils.formatEther(metapoolBalanceWeth)).toFixed(3)} ${wethSymbol} + ${Number(ethers.utils.formatEther(metapoolBalanceDai)).toFixed(3)} ${daiSymbol} (~ $${totalDollarValue.toFixed(2)})`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Position Unclaimed Fees'}</ExchangeRate>
                {<span>
                  {(unclaimedFeeWeth && unclaimedFeeDai && unclaimedFeesDollarValue)
                    ? `${Number(ethers.utils.formatEther(unclaimedFeeWeth)).toFixed(3)} ${wethSymbol} + ${Number(ethers.utils.formatEther(unclaimedFeeDai)).toFixed(3)} ${daiSymbol} (~ $${unclaimedFeesDollarValue.toFixed(2)})`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Current APY'}</ExchangeRate>
                {<span>
                  {(apy)
                    ? `~ ${apy.toFixed(2)}%`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Token Supply'}</ExchangeRate>
                {<span>
                  {metapoolSupply
                    ? `${Number(ethers.utils.formatEther(metapoolSupply)).toFixed(5)} gUNI`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{`Token Supply After (${poolShareBurned ? '-'+poolShareBurned.toFixed(2) : '-'}%)`}</ExchangeRate>
                {<span>
                  {(metapoolSupply && gUniValue) ?  (Number(ethers.utils.formatEther(metapoolSupply))-Number(gUniValue)).toFixed(5) + ' gUNI': '-'}
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
          {(!gelatoPool) ?
            <OversizedPanel hideBottom>
              <SummaryPanel>Network not Supported</SummaryPanel>
            </OversizedPanel> 
          :
            <OversizedPanel hideBottom>
              <SummaryPanel>loading...</SummaryPanel>
            </OversizedPanel>
          }
        </>
      }
  </>
}
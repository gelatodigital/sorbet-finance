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
import { useTokenDetails, WETH, DAI } from '../../contexts/Tokens'
import { usePendingApproval, useTransactionAdder } from '../../contexts/Transactions'
import { Button } from '../../theme'
import { useGelatoMetapoolContract, usePoolV3Contract, useTokenContract } from '../../hooks'
//import { getExchangeRate } from '../../utils/rate'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import { ReactComponent as Plus } from '../../assets/images/plus-blue.svg'
import OversizedPanel from '../../components/OversizedPanel'
import { BigNumber } from "bignumber.js";
import ModeSelector from './ModeSelector'
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

const WETH_OP = 0
const DAI_OP = 1

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
  padding: 0.5rem;

  button {
    max-width: 20rem;
  }
`

const WrappedPlus = ({ isError, highSlippageWarning, ...rest }) => <Plus {...rest} />
const ColoredWrappedPlus = styled(WrappedPlus)`
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
  padding: 0.875rem;
  path {
    stroke: ${({ active, theme }) => (active ? theme.royalBlue : theme.chaliceGray)};
  }
`

function initialAddLiquidityState(state) {
  return {
    wethValue: '',
    daiValue: '',
    lastEditedField: WETH_OP,
  }
}
  
function addLiquidityStateReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_VALUE': {
      const { wethValue, daiValue } = state
      const { field, value } = action.payload
      return {
        ...state,
        wethValue: field === WETH_OP ? value : wethValue,
        daiValue: field === DAI_OP ? value : daiValue,
        lastEditedField: field
      }
    }
    case 'UPDATE_DEPENDENT_VALUE': {
      const { wethValue, daiValue } = state
      const { field, value } = action.payload
      return {
        ...state,
        inputValue: field === WETH_OP ? value : wethValue,
        outputValue: field === DAI_OP ? value : daiValue
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
  const {_liquidity: liquidity} = await poolV3.positions(await gelatoPool.getPositionID())
  const {amount0, amount1} = await gelatoPool.getAmountsForLiquidity(sqrtPriceX96, sqrtLowerPriceX96, sqrtUpperPriceX96, liquidity)
  return {
    price: price,
    sqrtPrice: sqrtPriceX96,
    upperPrice: upperPrice,
    lowerPrice: lowerPrice,
    amount0: amount0,
    amount1: amount1,
    liquidity: liquidity,
    totalSupply: totalSupply
  }
};

const getAllowance = async (token, account, spenderAddress) => {
  return await token.allowance(account, spenderAddress)
}

export default function AddLiquidity() {
  const { t } = useTranslation()
  const { account, library, active, chainId } = useWeb3React()

  // core swap state
  const [addLiquidityState, dispatchAddLiquidityState] = useReducer(addLiquidityStateReducer, null, initialAddLiquidityState)

  const wethAddress = WETH[chainId]
  const daiAddress = DAI[chainId]

  const { wethValue, daiValue, lastEditedField } = addLiquidityState

  const [confirmationPending, setConfirmationPending] = useState(false)
  const [isWethApproved, setIsWethApproved] = useState(false)
  const [isDaiApproved, setIsDaiApproved] = useState(false)
  const [marketRate, setMarketRate] = useState(null)
  const [sqrtPrice, setSqrtPrice] = useState(null)
  const [lowerBoundRate, setLowerBoundRate] = useState(null)
  const [upperBoundRate, setUpperBoundRate] = useState(null)
  const [metapoolBalanceWeth, setMetapoolBalanceWeth] = useState(null)
  const [metapoolBalanceDai, setMetapoolBalanceDai] = useState(null)
  const [wethValueFormatted, setWethValueFormatted] = useState(null)
  const [daiValueFormatted, setDaiValueFormatted] = useState(null)
  const [userLiquidityDelta, setUserLiquidityDelta] = useState(null)
  const [userEstimatedMint, setUserEstimatedMint] = useState(null)
  const [metapoolSupply, setMetapoolSupply] = useState(null)
  const [metapoolLiquidity, setMetapoolLiquidity] = useState(null)
  const [poolShare, setPoolShare] = useState(null)

  const [isAddLiquidityPending, setIsAddLiquidityPending] = useState(null)
  const [isApproveWethPending, setIsApproveWethPending] = useState(null)
  const [isApproveDaiPending, setIsApproveDaiPending] = useState(null)

  const addTransaction = useTransactionAdder()
  const gasPrice = useGasPrice()

  const [inputErrorDai, setInputErrorDai] = useState()
  const [inputErrorWeth, setInputErrorWeth] = useState()

  //const [inputValueParsed, setInputValueParsed] = useState()
  //const [outputValueParsed, setOutputValueParsed] = useState()
  //const [outputError, setOutputError] = useState()
  //const [zeroDecimalError, setZeroDecimalError] = useState()
  //const [brokenTokenWarning, setBrokenTokenWarning] = useState()

  // get symbols
  const { symbol: wethSymbol } = useTokenDetails(wethAddress)
  const { symbol: daiSymbol } = useTokenDetails(daiAddress)

  // get balances for each of the currency types
  const wethBalance = useAddressBalance(account, wethAddress)
  const daiBalance = useAddressBalance(account, daiAddress)
  const wethBalanceFormatted = !!(wethBalance) ? Number(ethers.utils.formatEther(wethBalance)).toFixed(5) : ''
  const daiBalanceFormatted = !!(daiBalance) ? Number(ethers.utils.formatEther(daiBalance)).toFixed(5) : ''

  const poolV3 = usePoolV3Contract()
  const gelatoPool = useGelatoMetapoolContract()
  const wethContract = useTokenContract(wethAddress)
  const daiContract = useTokenContract(daiAddress)

  async function onAddLiquidity() {
    getPoolCurrentInfo(poolV3, gelatoPool).then((result) => {
      setMarketRate(result.price)
      setUpperBoundRate(result.upperPrice)
      setLowerBoundRate(result.lowerPrice)
      setSqrtPrice(result.sqrtPrice)
      setMetapoolBalanceWeth(result.amount1)
      setMetapoolBalanceDai(result.amount0)
      setMetapoolLiquidity(result.liquidity)
      setMetapoolSupply(result.totalSupply)
      console.log(wethValueFormatted, daiValueFormatted)
      const parsedWeth = ethers.utils.parseUnits(wethValueFormatted, 18)
      const parsedDai = ethers.utils.parseUnits(daiValueFormatted, 18)
      if (((Number(daiValueFormatted)/Number(wethValueFormatted)) - (Number(ethers.utils.formatEther(result.amount0)/Number(ethers.utils.formatEther(result.amount1)))))**2 > Number(daiValue)/(Number(wethValue)*10)) {
        console.log('error out of range');
        return
      }
      const sqrtLowerPriceX96 = encodePriceSqrt("1", result.lowerPrice.toString())
      const sqrtUpperPriceX96 = encodePriceSqrt("1", result.upperPrice.toString())
      gelatoPool.getLiquidityForAmounts(result.sqrtPrice.toString(), sqrtLowerPriceX96.toString(), sqrtUpperPriceX96.toString(), parsedDai.toString(), parsedWeth.toString()).then((r2) => {
        //gelatoPool.estimateGas.mint(r2.toString()).then((estimatedGas) => {
          gelatoPool.mint(r2.toString(), {/*gasPrice: gasPrice,*/ gasLimit: 400000}).then((tx) => {
            setIsAddLiquidityPending(true)
            tx.wait().then(() => {
              console.log("complete!")
              setIsAddLiquidityPending(false)
              setDaiValueFormatted('')
              setWethValueFormatted('')
            })
          }).catch((error) => {
            console.log("error adding liquidity!", error)
            setIsAddLiquidityPending(false)
          })
        //})
      })
    })
  }

  // declare/get parsed and formatted versions of input/output values
  //const [independentValueParsed, setIndependentValueParsed] = useState()
  //const inputValueParsed = independentField === WETH_OP ? independentValueParsed : inputValue
  useEffect(() => {
    setInputErrorDai(null)
    setInputErrorWeth(null)
    if (lowerBoundRate && upperBoundRate && metapoolBalanceDai && metapoolBalanceWeth) {
      if (lastEditedField === WETH_OP) {
        setWethValueFormatted(wethValue)
        if (wethValue) {
          if (Number(wethValue) > Number(wethBalanceFormatted)) {
            setInputErrorWeth("Insufficient Balance!")
            return
          }
          getPoolCurrentInfo(poolV3, gelatoPool).then((result) => {
            setMarketRate(result.price)
            setUpperBoundRate(result.upperPrice)
            setLowerBoundRate(result.lowerPrice)
            setSqrtPrice(result.sqrtPrice)
            setMetapoolBalanceWeth(result.amount1)
            setMetapoolBalanceDai(result.amount0)
            setMetapoolLiquidity(result.liquidity)
            setMetapoolSupply(result.totalSupply)
            let currentLiquidity = result.liquidity
            let supply = result.totalSupply
            let parsedWeth = ethers.utils.parseUnits(wethValue, 18)
            const factor = Number(ethers.utils.formatEther(result.amount0))/Number(ethers.utils.formatEther(result.amount1))
            let daiEstimate = factor*Number(wethValue)*1.25
            let parsedDai = ethers.utils.parseUnits(daiEstimate.toString(), 18)
            let sqrtLowerPriceX96 = encodePriceSqrt("1", result.lowerPrice.toString())
            let sqrtUpperPriceX96 = encodePriceSqrt("1", result.upperPrice.toString())
            gelatoPool.getLiquidityForAmounts(sqrtPrice.toString(), sqrtLowerPriceX96.toString(), sqrtUpperPriceX96.toString(), parsedDai.toString(), parsedWeth.toString()).then((r2) => {
              setUserLiquidityDelta(r2)
              let amountToMint = Number(ethers.utils.formatEther(r2))*Number(ethers.utils.formatEther(supply))/Number(ethers.utils.formatEther(currentLiquidity))
              setUserEstimatedMint(ethers.utils.parseEther(amountToMint.toString(), 18));
              let percentage = (amountToMint/(Number(ethers.utils.formatEther(supply))+amountToMint))*100
              setPoolShare(percentage)
              gelatoPool.getAmountsForLiquidity(sqrtPrice.toString(), sqrtLowerPriceX96.toString(), sqrtUpperPriceX96.toString(), r2.toString()).then(({amount0, amount1}) => {
                getAllowance(wethContract, account, gelatoPool.address).then((allowance) => {
                  if (Number(ethers.utils.formatEther(allowance)) >= Number(ethers.utils.formatEther(amount1))) {
                    setIsWethApproved(true);
                  } else {
                    setIsWethApproved(false)
                  }
                })
                getAllowance(daiContract, account, gelatoPool.address).then((allowanceDai) => {
                  if (Number(ethers.utils.formatEther(allowanceDai)) >= Number(ethers.utils.formatEther(amount0))) {
                    setIsDaiApproved(true);
                  } else {
                    setIsDaiApproved(false)
                  }
                })
                setDaiValueFormatted(Number(ethers.utils.formatEther(amount0)).toFixed(5))
                if (Number(ethers.utils.formatEther(amount0)) > Number(daiBalanceFormatted)) {
                  setInputErrorDai('Insufficient Balance!')
                }
              })
            }).catch((error) => {
              console.log(error);
            })
          })
        } else {
          setDaiValueFormatted('')
        }
      } else {
        setDaiValueFormatted(daiValue)
        if (daiValue) {
          if (Number(daiValue) > Number(daiBalanceFormatted)) {
            setInputErrorWeth("Insufficient Balance!")
            return
          }
          getPoolCurrentInfo(poolV3, gelatoPool).then((result) => {
            setMarketRate(result.price)
            setUpperBoundRate(result.upperPrice)
            setLowerBoundRate(result.lowerPrice)
            setSqrtPrice(result.sqrtPrice)
            setMetapoolBalanceWeth(result.amount1)
            setMetapoolBalanceDai(result.amount0)
            setMetapoolLiquidity(result.liquidity)
            setMetapoolSupply(result.totalSupply)
            let currentLiquidity = result.liquidity
            let supply = result.totalSupply
            let parsedDai = ethers.utils.parseUnits(daiValue, 18)
            const factor = Number(ethers.utils.formatEther(result.amount0))/Number(ethers.utils.formatEther(result.amount1))
            let wethEstimate = factor*Number(daiValue)*1.25
            let parsedWeth = ethers.utils.parseUnits(wethEstimate.toString(), 18)
            let sqrtLowerPriceX96 = encodePriceSqrt("1", result.lowerPrice.toString())
            let sqrtUpperPriceX96 = encodePriceSqrt("1", result.upperPrice.toString())
            gelatoPool.getLiquidityForAmounts(sqrtPrice.toString(), sqrtLowerPriceX96.toString(), sqrtUpperPriceX96.toString(), parsedDai.toString(), parsedWeth.toString()).then((r2) => {
              setUserLiquidityDelta(r2)
              let amountToMint = Number(ethers.utils.formatEther(r2))*Number(ethers.utils.formatEther(supply))/Number(ethers.utils.formatEther(currentLiquidity))
              setUserEstimatedMint(ethers.utils.parseEther(amountToMint.toString(), 18));
              let percentage = (amountToMint/(Number(ethers.utils.formatEther(supply))+amountToMint))*100
              setPoolShare(percentage)
              gelatoPool.getAmountsForLiquidity(sqrtPrice.toString(), sqrtLowerPriceX96.toString(), sqrtUpperPriceX96.toString(), r2.toString()).then(({amount0, amount1}) => {
                getAllowance(wethContract, account, gelatoPool.address).then((allowance) => {
                  if (Number(ethers.utils.formatEther(allowance)) >= Number(ethers.utils.formatEther(amount1))) {
                    setIsWethApproved(true);
                  } else {
                    setIsWethApproved(false)
                  }
                })
                getAllowance(daiContract, account, gelatoPool.address).then((allowanceDai) => {
                  if (Number(ethers.utils.formatEther(allowanceDai)) >= Number(ethers.utils.formatEther(amount0))) {
                    setIsDaiApproved(true);
                  } else {
                    setIsDaiApproved(false)
                  }
                })
                setWethValueFormatted(Number(ethers.utils.formatEther(amount1)).toFixed(5))
                if (Number(ethers.utils.formatEther(amount1)) > Number(wethBalanceFormatted)) {
                  setInputErrorWeth('Insufficient Balance!')
                }
              })
            }).catch((error) => {
              console.log(error);
            })
          })
        } else {
          setWethValueFormatted('')
        }
      }
    }
  }, [wethValue, daiValue])

  //let outputValueParsed;
  const allBalances = useFetchAllBalances()

  const isActive = active && account

  const isValid = !inputErrorDai && !inputErrorWeth && isWethApproved && isDaiApproved && (Number(wethValue) > 0 || Number(daiValue) > 0)

  function formatBalance(value) {
    return `(${t('balance', { balanceInput: value })})`
  }

  const onApproveWeth = async () => {
    console.log("Approving Dai")
    wethContract.approve(gelatoPool.address, ethers.constants.MaxUint256, {/*gasPrice,*/ gasLimit: 200000}).then((tx) => {
      setIsApproveWethPending(true)
      tx.wait().then(() => {
        setIsWethApproved(true)
        setIsApproveWethPending(false)
      })
    }).catch((error) => {
      console.log('error approving weth!', error)
      setIsApproveWethPending(false)
    })
  }

  const onApproveDai = async () => {
    console.log("Approving Dai")
    daiContract.approve(gelatoPool.address, ethers.constants.MaxUint256, {/*gasPrice,*/ gasLimit: 200000}).then((tx) => {
      setIsApproveDaiPending(true)
      tx.wait().then(() => {
        setIsDaiApproved(true)
        setIsApproveDaiPending(false)
      })
    }).catch((error) => {
      console.log('error approving dai!', error)
      setIsApproveDaiPending(false)
    })
  }

  useEffect(() => {
    getPoolCurrentInfo(poolV3, gelatoPool).then((result) => {
      setMarketRate(result.price)
      setUpperBoundRate(result.upperPrice)
      setLowerBoundRate(result.lowerPrice)
      setSqrtPrice(result.sqrtPrice)
      setMetapoolBalanceWeth(result.amount1)
      setMetapoolBalanceDai(result.amount0)
      setMetapoolLiquidity(result.liquidity)
      setMetapoolSupply(result.totalSupply)
    })
    if (!daiValueFormatted) {
      setIsDaiApproved(true);
    }
    if (!wethValueFormatted) {
      setIsWethApproved(true);
    }
  }, []);

  return <>
      <ModeSelector />
      <CurrencyInputPanel
        title={t('deposit')}
        allBalances={allBalances}
        extraText={wethBalanceFormatted && formatBalance(wethBalanceFormatted)}
        extraTextClickHander={() => {
          if (wethBalance) {
            if (wethBalance.gt(ethers.constants.Zero)) {
              dispatchAddLiquidityState({
                type: 'UPDATE_VALUE',
                payload: { value: ethers.utils.formatEther(wethBalance), field: WETH_OP }
              })
            }
          }
        }}
        onValueChange={wethValue => {
          dispatchAddLiquidityState({ type: 'UPDATE_VALUE', payload: { value: wethValue, field: WETH_OP } })
        }}
        selectedTokens={[wethAddress, daiAddress]}
        selectedTokenAddress={wethAddress}
        value={wethValueFormatted}
        errorMessage={inputErrorWeth ? inputErrorWeth : ''}
        disableTokenSelect
        disableUnlock
      />
      <OversizedPanel>
        <DownArrowBackground>
          <ColoredWrappedPlus active={isActive} alt="plus" />
        </DownArrowBackground>
      </OversizedPanel>
      <CurrencyInputPanel
        title={t('deposit')}
        allBalances={allBalances}
        extraText={daiBalanceFormatted && formatBalance(daiBalanceFormatted)}
        onValueChange={daiValue => {
          dispatchAddLiquidityState({ type: 'UPDATE_VALUE', payload: { value: daiValue, field: DAI_OP } })
        }}
        selectedTokens={[wethAddress, daiAddress]}
        selectedTokenAddress={daiAddress}
        value={daiValueFormatted}
        errorMessage={inputErrorDai ? inputErrorDai : ''}
        disableTokenSelect
        disableUnlock
      />
      <OversizedPanel hideBottom>
        <SummaryPanel>
          <ExchangeRateWrapper>
            <ExchangeRate>{t('exchangeRate')}</ExchangeRate>
            {<span>{marketRate  ? `1 ${wethSymbol} = ${marketRate.toFixed(3)} ${daiSymbol}` : ' - '}</span>}
          </ExchangeRateWrapper>
          <ExchangeRateWrapper>
            <ExchangeRate>{'Gelato Pool Position Range'}</ExchangeRate>
            {<span>
              {lowerBoundRate && upperBoundRate
                ? `${lowerBoundRate.toFixed(3)} ${daiSymbol} <---> ${upperBoundRate.toFixed(3)} ${daiSymbol}`
              : ' - '}
              </span>}
          </ExchangeRateWrapper>
          <ExchangeRateWrapper>
            <ExchangeRate>{'Gelato Pool Position Amounts'}</ExchangeRate>
            {<span>
              {(metapoolBalanceWeth && metapoolBalanceDai)
                ? `${Number(ethers.utils.formatEther(metapoolBalanceWeth)).toFixed(3)} ${wethSymbol} + ${Number(ethers.utils.formatEther(metapoolBalanceDai)).toFixed(3)} ${daiSymbol}`
              : ' - '}
              </span>}
          </ExchangeRateWrapper>
          <ExchangeRateWrapper>
            <ExchangeRate>{'Gelato Pool Token Supply'}</ExchangeRate>
            {<span>
              {(metapoolSupply)
                ? `${Number(ethers.utils.formatEther(metapoolSupply)).toFixed(5)} gUNIV3`
              : ' - '}
              </span>}
          </ExchangeRateWrapper>
          <ExchangeRateWrapper>
            <ExchangeRate>
              {t('yourPoolShare')} ({poolShare ? poolShare.toFixed(5) : '-'}%)
            </ExchangeRate>
            <span>{userEstimatedMint ? Number(ethers.utils.formatEther(userEstimatedMint)).toFixed(5)+' gUNIV3' : '-'}</span>
            {/*<span>
              {ethShare && tokenShare
                ? `${amountFormatter(ethShare, 18, 4)} ETH + ${amountFormatter(
                    tokenShare,
                    decimals,
                    Math.min(4, decimals)
                  )} ${symbol}`
                : ' - '}
                </span>*/}
          </ExchangeRateWrapper>
        </SummaryPanel>
      </OversizedPanel>
      {!isWethApproved && (
        <Flex>
          <Button disabled={isApproveWethPending || isApproveDaiPending} onClick={onApproveWeth}>
          {isApproveWethPending ? `Pending...` : `Approve ${wethSymbol}`}
          </Button>
        </Flex>
      )}
      {!isDaiApproved && (
        <Flex>
          <Button disabled={isApproveDaiPending || isApproveWethPending} onClick={onApproveDai}>
            {isApproveDaiPending ? `Pending...` : `Approve ${daiSymbol}`}
          </Button>
        </Flex>
      )}
      <Flex>
        <Button disabled={!isValid || isAddLiquidityPending } onClick={onAddLiquidity}>
          {!isAddLiquidityPending ? t('addLiquidity') : "Pending..."}
        </Button>
      </Flex>
  </>
}
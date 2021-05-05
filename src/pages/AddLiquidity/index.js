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
import { useTransactionAdder } from '../../contexts/Transactions'
import { Button } from '../../theme'
import { amountFormatter } from '../../utils'
import { useGelatoMetapoolContract, usePoolV3Contract } from '../../hooks'
//import { getExchangeRate } from '../../utils/rate'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import { ReactComponent as Plus } from '../../assets/images/plus-blue.svg'
import OversizedPanel from '../../components/OversizedPanel'
import { BigNumber } from "bignumber.js";

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

let inputValue;

const INPUT = 0
const OUTPUT = 1

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

function getInitialAddLiquidityState() {
    return {
      independentValue: '', // this is a user input
      dependentValue: '', // this is a calculated number
      independentField: INPUT,
      prevIndependentField: OUTPUT,
    }
  }
  
  function addLiquidityStateReducer(state, action) {
    switch (action.type) {
      case 'UPDATE_INDEPENDENT': {
        const { field, value } = action.payload
        const { dependentValue, independentValue, independentField, prevIndependentField } = state
  
        return {
          ...state,
          independentValue: value,
          dependentValue: Number(value) === Number(independentValue) ? dependentValue : '',
          independentField: field,
          prevIndependentField: independentField === field ? prevIndependentField : independentField
        }
      }
      case 'UPDATE_DEPENDENT': {
        return {
          ...state,
          dependentValue: action.payload === null ? inputValue : action.payload
        }
      }
      default: {
        return getInitialAddLiquidityState()
      }
    }
  }
  async function onAddLiquidity() {
    console.log("AddinfLiquidity!!");
  }

export default function AddLiquidity() {
  const { t } = useTranslation()
  const { account, library, active, chainId } = useWeb3React()

  // core swap state
  const [addLiquidityState, dispatchAddLiquidityState] = useReducer(addLiquidityStateReducer, null, getInitialAddLiquidityState)

  const inputCurrency = WETH[chainId]
  const outputCurrency = DAI[chainId]

  const { independentValue, independentField } = addLiquidityState

  const [confirmationPending, setConfirmationPending] = useState(false)
  const [isInputApproved, setIsInputApproved] = useState(false)
  const [isOutputApproved, setIsOutputApproved] = useState(false)
  const [marketRate, setMarketRate] = useState(null)
  const [lowerBoundRate, setLowerBoundRate] = useState(null)
  const [upperBoundRate, setUpperBoundRate] = useState(null)
  const [balance0, setBalance0] = useState(null)
  const [balance1, setBalance1] = useState(null)


  const addTransaction = useTransactionAdder()

  const [independentError, setIndependentError] = useState()

  //const [inputValueParsed, setInputValueParsed] = useState()
  //const [outputValueParsed, setOutputValueParsed] = useState()
  const [inputError, setInputError] = useState()
  //const [outputError, setOutputError] = useState()
  //const [zeroDecimalError, setZeroDecimalError] = useState()
  //const [brokenTokenWarning, setBrokenTokenWarning] = useState()

  // get decimals and exchange address for each of the currency types
  const { symbol: inputSymbol, decimals: inputDecimals } = useTokenDetails(inputCurrency)
  const { symbol: outputSymbol, decimals: outputDecimals } = useTokenDetails(outputCurrency)

  // get balances for each of the currency types
  const inputBalance = useAddressBalance(account, inputCurrency)
  const outputBalance = useAddressBalance(account, outputCurrency)
  const inputBalanceFormatted = !!(inputBalance && Number.isInteger(inputDecimals))
    ? amountFormatter(inputBalance, inputDecimals, Math.min(4, inputDecimals))
    : ''
  const outputBalanceFormatted = !!(outputBalance && Number.isInteger(outputDecimals))
    ? amountFormatter(outputBalance, outputDecimals, Math.min(4, outputDecimals))
    : ''

  // declare/get parsed and formatted versions of input/output values
  //const [independentValueParsed, setIndependentValueParsed] = useState()
  //const inputValueParsed = independentField === INPUT ? independentValueParsed : inputValue
  const inputValueFormatted =
    independentField === INPUT ? independentValue : amountFormatter(inputValue, inputDecimals, inputDecimals, false)

  let outputValueFormatted;
  //let outputValueParsed;
  const allBalances = useFetchAllBalances()

  const isActive = active && account

  const isValid = !inputError && !independentError && isInputApproved && isOutputApproved

  function formatBalance(value) {
    return `(${t('balance', { balanceInput: value })})`
  }

  const poolV3 = usePoolV3Contract()

  const gelatoPool = useGelatoMetapoolContract()

  const onApprove = async () => {
    console.log("Approving")
  }

  useEffect(() => {
    let sqrtMidPrice;
    poolV3.slot0().then(({sqrtPriceX96, tick}) => {
      let price = 1/(1.0001**Number(tick))
      sqrtMidPrice = sqrtPriceX96;
      setMarketRate(price);
    })
    let lowerTick;
    let sqrtUpperPriceX96;
    let sqrtLowerPriceX96;
    gelatoPool.currentLowerTick().then((result) => {
      lowerTick = Number(result)
      gelatoPool.currentUpperTick().then((result) => {
        let upperTick = Number(result)
        let upperPrice = 1/(1.0001**Number(lowerTick))
        let lowerPrice = 1/(1.0001**Number(upperTick))
        sqrtUpperPriceX96 = encodePriceSqrt("1", upperPrice.toString())
        sqrtLowerPriceX96 = encodePriceSqrt("1", lowerPrice.toString())
        setLowerBoundRate(lowerPrice)
        setUpperBoundRate(upperPrice)
        console.log("sup")
        gelatoPool.getPositionID().then((result) => {
          console.log("POSITION ID", result)
          poolV3.positions(result).then(({_liquidity}) => {
            console.log("LIQUIDITY", _liquidity);
            gelatoPool.getAmountsForLiquidity(sqrtMidPrice, sqrtLowerPriceX96, sqrtUpperPriceX96, _liquidity).then(({amount0, amount1}) => {
              setBalance0(amount1)
              setBalance1(amount0)
            })
          })
        })
      })
    })
  }, []);

  return <>
      <CurrencyInputPanel
        title={t('deposit')}
        allBalances={allBalances}
        extraText={inputBalanceFormatted && formatBalance(inputBalanceFormatted)}
        extraTextClickHander={() => {
          if (inputBalance && inputDecimals) {
            if (inputBalance.gt(ethers.constants.Zero)) {
              dispatchAddLiquidityState({
                type: 'UPDATE_INDEPENDENT',
                payload: { value: amountFormatter(inputBalance, inputDecimals, inputDecimals, false), field: INPUT }
              })
            }
          }
        }}
        onValueChange={inputValue => {
          dispatchAddLiquidityState({ type: 'UPDATE_INDEPENDENT', payload: { value: inputValue, field: INPUT } })
        }}
        selectedTokens={[inputCurrency, outputCurrency]}
        selectedTokenAddress={inputCurrency}
        value={inputValueFormatted}
        errorMessage={inputError ? inputError : independentField === INPUT ? independentError : ''}
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
        extraText={outputBalanceFormatted && formatBalance(outputBalanceFormatted)}
        onValueChange={outputValue => {
          dispatchAddLiquidityState({ type: 'UPDATE_INDEPENDENT', payload: { value: outputValue, field: OUTPUT } })
        }}
        selectedTokens={[inputCurrency, outputCurrency]}
        selectedTokenAddress={outputCurrency}
        value={outputValueFormatted}
        errorMessage={independentField === OUTPUT ? independentError : ''}
        disableTokenSelect
        disableUnlock
      />
      <OversizedPanel hideBottom>
        <SummaryPanel>
          <ExchangeRateWrapper>
            <ExchangeRate>{t('exchangeRate')}</ExchangeRate>
            {<span>{marketRate  ? `1 ${inputSymbol} = ${marketRate.toFixed(5)} ${outputSymbol}` : ' - '}</span>}
          </ExchangeRateWrapper>
          <ExchangeRateWrapper>
            <ExchangeRate>{'Gelato Pool Position'}</ExchangeRate>
            {<span>
              {lowerBoundRate && upperBoundRate
                ? `${lowerBoundRate.toFixed(3)} ${outputSymbol} - ${upperBoundRate.toFixed(3)} ${outputSymbol}`
              : ' - '}
              </span>}
          </ExchangeRateWrapper>
          <ExchangeRateWrapper>
            <ExchangeRate>{'Gelato Pool Reserves'}</ExchangeRate>
            {<span>
              {(balance0 && balance1)
                ? `${amountFormatter(balance0, 18, 4)} ${inputSymbol} + ${amountFormatter(balance1, 18, 4)} ${outputSymbol}`
              : ' - '}
              </span>}
          </ExchangeRateWrapper>
          <ExchangeRateWrapper>
            <ExchangeRate>
              {t('yourPoolShare')} ({/*amountFormatter(poolTokenPercentage, 16, 2)*/}%)
            </ExchangeRate>
            <span>{'-'}</span>
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
      {!isInputApproved && (
        <Flex>
          <Button onClick={onApprove}>
            {`Approve ${inputSymbol}`}
          </Button>
        </Flex>
      )}
      {!isOutputApproved && (
        <Flex>
          <Button onClick={onApprove}>
            {`Approve ${outputSymbol}`}
          </Button>
        </Flex>
      )}
      <Flex>
        <Button disabled={!isValid} onClick={onAddLiquidity}>
          {t('addLiquidity')}
        </Button>
      </Flex>
  </>
}
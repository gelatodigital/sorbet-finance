import { getLimitOrderPayloadWithSecret } from '@gelatonetwork/limit-orders-lib'
import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import * as ls from 'local-storage'
import React, { useEffect, useReducer, useState } from 'react'
import ReactGA from 'react-ga'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import ArrowDown from '../../assets/svg/SVGArrowDown'
import SVGClose from '../../assets/svg/SVGClose'
import SVGDiv from '../../assets/svg/SVGDiv'
import { ETH_ADDRESS, GENERIC_GAS_LIMIT_ORDER_EXECUTE, LIMIT_ORDER_MODULE_ADDRESSES } from '../../constants'
import { useFetchAllBalances } from '../../contexts/AllBalances'
import { useAddressBalance } from '../../contexts/Balances'
import { useGasPrice } from '../../contexts/GasPrice'
import { useTokenDetails } from '../../contexts/Tokens'
import { ACTION_PLACE_ORDER, useTransactionAdder } from '../../contexts/Transactions'
import { useUniswapExContract } from '../../hooks'
import { useTradeExactIn } from '../../hooks/trade'
import { Button } from '../../theme'
import { amountFormatter } from '../../utils'
import { getExchangeRate } from '../../utils/rate'
import CurrencyInputPanel from '../CurrencyInputPanel'
import OversizedPanel from '../OversizedPanel'

import './ExchangePage.css'



// Use to detach input from output
let inputValue

const INPUT = 0
const OUTPUT = 1
const RATE = 2

const ETH_TO_TOKEN = 0
const TOKEN_TO_ETH = 1
const TOKEN_TO_TOKEN = 2

// Denominated in bips
const SLIPPAGE_WARNING = '30' // [30+%
const EXECUTION_WARNING = '3' // [10+%

const RATE_OP_MULT = 'x'
const RATE_OP_DIV = '/'

const DownArrowBackground = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  justify-content: center;
  align-items: center;
`

const WrappedArrowDown = ({ clickable, active, ...rest }) => <ArrowDown {...rest} />
const DownArrow = styled(WrappedArrowDown)`
  color: ${({ theme, active }) => (active ? theme.royalPurple : theme.chaliceGray)};
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
  padding: 0.875rem;
  cursor: ${({ clickable }) => clickable && 'pointer'};
`

const WrappedRateIcon = ({ RateIconSVG, clickable, active, icon, ...rest }) => <RateIconSVG {...rest} />

const RateIcon = styled(WrappedRateIcon)`
  stroke: ${({ theme, active }) => (active ? theme.royalPurple : theme.chaliceGray)};
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
  padding: 0.875rem;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  cursor: ${({ clickable }) => clickable && 'pointer'};
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
  padding: 2rem;

  button {
    max-width: 20rem;
  }
`

// ///
// Local storage
// ///
const LS_ORDERS = 'orders_'

function lsKey(key, account, chainId) {
  return key + account.toString() + chainId
}

function saveOrder(account, orderData, chainId) {
  if (!account) return

  const key = lsKey(LS_ORDERS, account, chainId)
  const prev = ls.get(key)

  if (prev === null) {
    ls.set(key, [orderData])
  } else {
    if (prev.indexOf(orderData) === -1) {
      prev.push(orderData)
      ls.set(key, prev)
    }
  }
}

// ///
// Helpers
// ///

function getSwapType(inputCurrency, outputCurrency) {
  if (!inputCurrency || !outputCurrency) {
    return null
  } else if (inputCurrency === 'ETH') {
    return ETH_TO_TOKEN
  } else if (outputCurrency === 'ETH') {
    return TOKEN_TO_ETH
  } else {
    return TOKEN_TO_TOKEN
  }
}

function getInitialSwapState(outputCurrency) {
  return {
    independentValue: '', // this is a user input
    dependentValue: '', // this is a calculated number
    independentField: INPUT,
    prevIndependentField: OUTPUT,
    inputCurrency: 'ETH',
    outputCurrency: outputCurrency ? outputCurrency : '',
    rateOp: RATE_OP_MULT,
    inputRateValue: ''
  }
}

function swapStateReducer(state, action) {
  switch (action.type) {
    case 'FLIP_INDEPENDENT': {
      const { inputCurrency, outputCurrency } = state
      return {
        ...state,
        dependentValue: '',
        independentField: INPUT,
        independentValue: '',
        inputRateValue: '',
        inputCurrency: outputCurrency,
        outputCurrency: inputCurrency
      }
    }
    case 'FLIP_RATE_OP': {
      const { rateOp, inputRateValue } = state

      const rate = inputRateValue ? ethers.BigNumber.from(ethers.utils.parseUnits(inputRateValue, 18)) : undefined
      const flipped = rate ? amountFormatter(flipRate(rate), 18, 18, false) : ''

      return {
        ...state,
        inputRateValue: flipped,
        rateOp: rateOp === RATE_OP_DIV ? RATE_OP_MULT : RATE_OP_DIV
      }
    }
    case 'SELECT_CURRENCY': {
      const { inputCurrency, outputCurrency } = state
      const { field, currency } = action.payload

      const newInputCurrency = field === INPUT ? currency : inputCurrency
      const newOutputCurrency = field === OUTPUT ? currency : outputCurrency

      if (newInputCurrency === newOutputCurrency) {
        return {
          ...state,
          inputCurrency: field === INPUT ? currency : '',
          outputCurrency: field === OUTPUT ? currency : ''
        }
      } else {
        return {
          ...state,
          inputCurrency: newInputCurrency,
          outputCurrency: newOutputCurrency
        }
      }
    }
    case 'UPDATE_INDEPENDENT': {
      const { field, value } = action.payload
      const { dependentValue, independentValue, independentField, prevIndependentField, inputRateValue } = state

      return {
        ...state,
        independentValue: field !== RATE ? value : independentValue,
        dependentValue: Number(value) === Number(independentValue) ? dependentValue : '',
        independentField: field,
        inputRateValue: field === RATE ? value : inputRateValue,
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
      return getInitialSwapState()
    }
  }
}

function applyExchangeRateTo(inputValue, exchangeRate, inputDecimals, outputDecimals, invert = false) {
  try {
    if (
      inputValue &&
      exchangeRate &&
      (inputDecimals || inputDecimals === 0) &&
      (outputDecimals || outputDecimals === 0)
    ) {
      const factor = ethers.BigNumber.from(10).pow(ethers.BigNumber.from(18))

      if (invert) {
        return inputValue
          .mul(factor)
          .div(exchangeRate)
          .mul(ethers.BigNumber.from(10).pow(ethers.BigNumber.from(outputDecimals)))
          .div(ethers.BigNumber.from(10).pow(ethers.BigNumber.from(inputDecimals)))
      } else {
        return exchangeRate
          .mul(inputValue)
          .div(factor)
          .mul(ethers.BigNumber.from(10).pow(ethers.BigNumber.from(outputDecimals)))
          .div(ethers.BigNumber.from(10).pow(ethers.BigNumber.from(inputDecimals)))
      }
    }
  } catch {}
}

function exchangeRateDiff(exchangeRateA, exchangeRateB) {
  try {
    if (exchangeRateA && exchangeRateB) {
      const factor = ethers.BigNumber.from(10).pow(ethers.BigNumber.from(18))
      const deltaRaw = factor.mul(exchangeRateA).div(exchangeRateB)

      if (false && deltaRaw < factor) {
        return factor.sub(deltaRaw)
      } else {
        return deltaRaw.sub(factor)
      }
    }
  } catch {}
}

function flipRate(rate) {
  try {
    if (rate) {
      const factor = ethers.BigNumber.from(10).pow(ethers.BigNumber.from(18))
      return factor.mul(factor).div(rate)
    }
  } catch {}
}

function safeParseUnits(number, units) {
  try {
    return ethers.utils.parseUnits(number, units)
  } catch {
    const margin = units * 8
    const decimals = ethers.utils.parseUnits(number, margin)
    return decimals.div(ethers.BigNumber.from(10).pow(margin - units))
  }
}

export default function ExchangePage({ initialCurrency }) {
  const { t } = useTranslation()
  const { account, library, chainId } = useWeb3React()

  // core swap state
  const [swapState, dispatchSwapState] = useReducer(swapStateReducer, initialCurrency, getInitialSwapState)

  const { independentValue, independentField, inputCurrency, outputCurrency, rateOp, inputRateValue } = swapState

  const [inputError, setInputError] = useState()

  const addTransaction = useTransactionAdder()

  // get swap type from the currency types
  const swapType = getSwapType(inputCurrency, outputCurrency)

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

  // compute useful transforms of the data above
  const independentDecimals = independentField === INPUT || independentField === RATE ? inputDecimals : outputDecimals
  const dependentDecimals = independentField === OUTPUT ? inputDecimals : outputDecimals

  // declare/get parsed and formatted versions of input/output values
  const [independentValueParsed, setIndependentValueParsed] = useState()
  const inputValueParsed = independentField === INPUT ? independentValueParsed : inputValue
  const inputValueFormatted =
    independentField === INPUT ? independentValue : amountFormatter(inputValue, inputDecimals, inputDecimals, false)

  let outputValueFormatted
  let outputValueParsed
  let rateRaw

  const bestTradeExactIn = useTradeExactIn(
    inputCurrency,
    independentField === INPUT ? independentValue : inputValueFormatted,
    outputCurrency
  )

  if (bestTradeExactIn) {
    inputValue = ethers.BigNumber.from(
      ethers.utils.parseUnits(bestTradeExactIn.inputAmount.toExact(), inputDecimals)
    )
  } else if (independentField === INPUT && independentValue) {
    inputValue = ethers.BigNumber.from(ethers.utils.parseUnits(independentValue, inputDecimals))
  }

  switch (independentField) {
    case OUTPUT:
      outputValueParsed = independentValueParsed
      outputValueFormatted = independentValue
      rateRaw = getExchangeRate(
        inputValueParsed,
        inputDecimals,
        outputValueParsed,
        outputDecimals,
        rateOp === RATE_OP_DIV
      )
      break
    case RATE:
      if (!inputRateValue || Number(inputRateValue) === 0) {
        outputValueParsed = ''
        outputValueFormatted = ''
      } else {
        rateRaw = safeParseUnits(inputRateValue, 18)
        outputValueParsed = applyExchangeRateTo(
          inputValueParsed,
          rateRaw,
          inputDecimals,
          outputDecimals,
          rateOp === RATE_OP_DIV
        )
        outputValueFormatted = amountFormatter(
          outputValueParsed,
          dependentDecimals,
          Math.min(4, dependentDecimals),
          false
        )
      }
      break
    case INPUT:
      outputValueParsed = bestTradeExactIn
        ? ethers.utils.parseUnits(bestTradeExactIn.outputAmount.toExact(), dependentDecimals)
        : null
      outputValueFormatted = bestTradeExactIn ? bestTradeExactIn.outputAmount.toSignificant(6) : ''
      rateRaw = getExchangeRate(
        inputValueParsed,
        inputDecimals,
        outputValueParsed,
        outputDecimals,
        rateOp === RATE_OP_DIV
      )
      break
    default:
      break
  }

  // rate info
  const rateFormatted = independentField === RATE ? inputRateValue : amountFormatter(rateRaw, 18, 4, false)
  const inverseRateInputSymbol = rateOp === RATE_OP_DIV ? inputSymbol : outputSymbol
  const inverseRateOutputSymbol = rateOp === RATE_OP_DIV ? outputSymbol : inputSymbol
  const inverseRate = flipRate(rateRaw)

  // load required gas
  const gasPrice = useGasPrice()
  const gasLimit = GENERIC_GAS_LIMIT_ORDER_EXECUTE
  const requiredGas = gasPrice?.mul(gasLimit)

  const gasInInputTokens = useTradeExactIn('ETH', amountFormatter(requiredGas, 18, 18), inputCurrency)

  let usedInput
  if (inputSymbol === 'ETH') {
    usedInput = requiredGas
  } else if (gasInInputTokens) {
    usedInput = ethers.utils.parseUnits(gasInInputTokens.outputAmount.toExact(), inputDecimals)
  }

  const realInputValue = usedInput && inputValueParsed?.sub(usedInput)
  const executionRate =
    realInputValue &&
    getExchangeRate(realInputValue, inputDecimals, outputValueParsed, outputDecimals, rateOp === RATE_OP_DIV)

  const limitSlippage = ethers.BigNumber.from(SLIPPAGE_WARNING)
    .mul(ethers.BigNumber.from(10).pow(ethers.BigNumber.from(16)))

  const limitExecution = ethers.BigNumber.from(EXECUTION_WARNING)
    .mul(ethers.BigNumber.from(10).pow(ethers.BigNumber.from(16)))

  // validate + parse independent value
  const [independentError, setIndependentError] = useState()

  const executionRateDelta = executionRate && exchangeRateDiff(executionRate, rateRaw)
  const executionRateNegative = executionRate?.lt(ethers.constants.Zero)
  const executionRateWarning = executionRateNegative || executionRateDelta?.abs()?.gt(limitExecution)

  useEffect(() => {
    if (independentValue && (independentDecimals || independentDecimals === 0)) {
      try {
        const parsedValue = ethers.utils.parseUnits(independentValue, independentDecimals)

        if (parsedValue.lte(ethers.constants.Zero) || parsedValue.gte(ethers.constants.MaxUint256)) {
          throw Error()
        } else {
          setIndependentValueParsed(parsedValue)
          setIndependentError(null)
        }
      } catch {
        setIndependentError(t('inputNotValid'))
      }

      return () => {
        setIndependentValueParsed()
        setIndependentError()
      }
    }
  }, [independentValue, independentDecimals, t])

  // validate input balance
  const [showUnlock, setShowUnlock] = useState(false)
  useEffect(() => {
    const inputValueCalculation = inputValueParsed
    if (inputBalance && inputValueCalculation) {
      if (inputBalance.lt(inputValueCalculation)) {
        setInputError(t('insufficientBalance'))
      } else {
        setInputError(null)
        setShowUnlock(false)
      }
    }
  }, [inputBalance, inputCurrency, t, inputValueParsed])

  // calculate dependent value
  useEffect(() => {
    if (independentField === OUTPUT || independentField === RATE) {
      return () => {
        dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: null })
      }
    }
  }, [independentField])

  const [inverted, setInverted] = useState(false)

  const marketRate = getExchangeRate(
    inputValueParsed,
    inputDecimals,
    bestTradeExactIn ? ethers.utils.parseUnits(bestTradeExactIn.outputAmount.toExact(), outputDecimals) : null,
    outputDecimals,
    rateOp === RATE_OP_DIV
  )

  const exchangeRate = marketRate
  const exchangeRateInverted = flipRate(exchangeRate)

  const rateDelta =
    rateOp === RATE_OP_DIV
      ? exchangeRateDiff(inverseRate, exchangeRateInverted)
      : exchangeRateDiff(rateRaw, exchangeRate)

  const highSlippageWarning = rateDelta && rateDelta.lt(ethers.BigNumber.from(0).sub(limitSlippage))
  const rateDeltaFormatted = amountFormatter(rateDelta, 16, 2, true)

  const isValid = outputValueParsed && !inputError && !independentError

  const estimatedText = `(${t('estimated')})`
  function formatBalance(value) {
    return `(${t('balance', {balanceInput: value})})`
  }

  async function onPlace() {
    let fromCurrency, toCurrency, inputAmount, minimumReturn, data
    ReactGA.event({
      category: 'place',
      action: 'place'
    })

    inputAmount = inputValueParsed
    minimumReturn = outputValueParsed

    if (swapType === ETH_TO_TOKEN) {
      fromCurrency = ETH_ADDRESS
      toCurrency = outputCurrency
    } else if (swapType === TOKEN_TO_ETH) {
      fromCurrency = inputCurrency
      toCurrency = ETH_ADDRESS
    } else if (swapType === TOKEN_TO_TOKEN) {
      fromCurrency = inputCurrency
      toCurrency = outputCurrency
    }
    try {

      const transactionDataWithSecret = await getLimitOrderPayloadWithSecret(
        (await provider.getNetwork()).chainId,
        fromCurrency,
        toCurrency,
        inputAmount,
        minimumReturn,
        account.toLowerCase()
      );

      const order = {
        inputAmount: inputAmount.toString(),
        creationAmount: inputAmount.toString(),
        inputToken: fromCurrency.toLowerCase(),
        id: '???',
        minReturn: minimumReturn.toString(),
        module: LIMIT_ORDER_MODULE_ADDRESSES[chainId].toLowerCase(),
        owner: account.toLowerCase(),
        secret: transactionDataWithSecret.secret,
        status: 'open',
        outputToken: toCurrency.toLowerCase(),
        witness: transactionDataWithSecret.witness.toLowerCase()
      }

      saveOrder(account, order, chainId)

      const provider = new ethers.providers.Web3Provider(library.provider)
      const res = await provider.getSigner().sendTransaction({
        ...transactionDataWithSecret.txData,
        gasPrice: gasPrice
      })

      if (res.hash) {
        addTransaction(res, { action: ACTION_PLACE_ORDER, order: order })
      }
    } catch (e) {
      console.log('Error on place order', e.message)
    }
  }

  const [customSlippageError] = useState('')

  const allBalances = useFetchAllBalances()

  return (
    <>
      <CurrencyInputPanel
        title={t('input')}
        allBalances={allBalances}
        extraText={inputBalanceFormatted && formatBalance(inputBalanceFormatted)}
        extraTextClickHander={() => {
          if (inputBalance && inputDecimals) {
            const valueToSet = inputCurrency === 'ETH' ? inputBalance.sub(ethers.utils.parseEther('.1')) : inputBalance
            if (valueToSet.gt(ethers.constants.Zero)) {
              dispatchSwapState({
                type: 'UPDATE_INDEPENDENT',
                payload: { value: amountFormatter(valueToSet, inputDecimals, inputDecimals, false), field: INPUT }
              })
            }
          }
        }}
        onCurrencySelected={inputCurrency => {
          dispatchSwapState({ type: 'SELECT_CURRENCY', payload: { currency: inputCurrency, field: INPUT } })
        }}
        onValueChange={inputValue => {
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: inputValue, field: INPUT } })
        }}
        showUnlock={showUnlock}
        selectedTokens={[inputCurrency, outputCurrency]}
        selectedTokenAddress={inputCurrency}
        value={inputValueFormatted}
        errorMessage={inputError ? inputError : independentField === INPUT ? independentError : ''}
      />
      <OversizedPanel>
        <DownArrowBackground>
          <RateIcon
            RateIconSVG={rateOp === RATE_OP_MULT ? SVGClose : SVGDiv}
            icon={rateOp}
            onClick={() => {
              dispatchSwapState({ type: 'FLIP_RATE_OP' })
            }}
            clickable
            alt="swap"
            active={isValid}
          />
        </DownArrowBackground>
      </OversizedPanel>
      <CurrencyInputPanel
        title={t('rate')}
        showCurrencySelector={false}
        extraText={
          inverseRateInputSymbol && inverseRate && inverseRateOutputSymbol
            ? `1 ${inverseRateInputSymbol} = ${amountFormatter(inverseRate, 18, 4, false)} ${inverseRateOutputSymbol}`
            : '-'
        }
        extraTextClickHander={() => {
          dispatchSwapState({ type: 'FLIP_RATE_OP' })
        }}
        value={rateFormatted || ''}
        onValueChange={rateValue => {
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: rateValue, field: RATE } })
        }}
      />
      <OversizedPanel>
        <ExchangeRateWrapper
          onClick={() => {
            setInverted(inverted => !inverted)
          }}
        >
          <ExchangeRate>
            {t('executionRate', {gasPrice: gasPrice ? amountFormatter(gasPrice, 9, 0, false) : '...'})}
            {/* Execution rate at {gasPrice ? amountFormatter(gasPrice, 9, 0, false) : '...'} GWEI */}
          </ExchangeRate>
          {executionRateNegative ? (
            'Never executes'
          ) : rateOp !== RATE_OP_DIV ? (
            <span>
              {executionRate
                ? `1 ${inputSymbol} = ${amountFormatter(executionRate, 18, 4, false)} ${outputSymbol}`
                : ' - '}
            </span>
          ) : rateOp !== RATE_OP_DIV ? (
            <span>
              {executionRate
                ? `1 ${inputSymbol} = ${amountFormatter(executionRate, 18, 4, false)} ${outputSymbol}`
                : ' - '}
            </span>
          ) : (
            <span>
              {executionRate
                ? `1 ${outputSymbol} = ${amountFormatter(executionRate, 18, 4, false)} ${inputSymbol}`
                : ' - '}
            </span>
          )}
        </ExchangeRateWrapper>
        <DownArrowBackground>
          <DownArrow
            onClick={() => {
              dispatchSwapState({ type: 'FLIP_INDEPENDENT' })
            }}
            clickable
            alt="swap"
            active={isValid}
          />
        </DownArrowBackground>
      </OversizedPanel>
      <CurrencyInputPanel
        title={t('output')}
        allBalances={allBalances}
        description={estimatedText}
        extraText={outputBalanceFormatted && formatBalance(outputBalanceFormatted)}
        onCurrencySelected={outputCurrency => {
          dispatchSwapState({ type: 'SELECT_CURRENCY', payload: { currency: outputCurrency, field: OUTPUT } })
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: inputValueFormatted, field: INPUT } })
        }}
        onValueChange={outputValue => {
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: outputValue, field: OUTPUT } })
        }}
        selectedTokens={[inputCurrency, outputCurrency]}
        selectedTokenAddress={outputCurrency}
        value={outputValueFormatted}
        errorMessage={independentField === OUTPUT ? independentError : ''}
        disableUnlock
      />
      <OversizedPanel hideBottom>
        <ExchangeRateWrapper
          onClick={() => {
            setInverted(inverted => !inverted)
          }}
        >
          <ExchangeRate>{t('exchangeRate')}</ExchangeRate>
          {inverted ? (
            <span>
              {exchangeRate
                ? `1 ${inputSymbol} = ${amountFormatter(exchangeRate, 18, 4, false)} ${outputSymbol}`
                : ' - '}
            </span>
          ) : (
            <span>
              {exchangeRate
                ? `1 ${outputSymbol} = ${amountFormatter(exchangeRateInverted, 18, 4, false)} ${inputSymbol}`
                : ' - '}
            </span>
          )}
        </ExchangeRateWrapper>
      </OversizedPanel>
      <Flex>
        <Button
          disabled={!account || !isValid || customSlippageError === 'invalid'}
          onClick={onPlace}
          warning={highSlippageWarning || executionRateWarning || customSlippageError === 'warning'}
        >
          {customSlippageError === 'warning' ? t('placeAnyway') : t('place')}
        </Button>
      </Flex>
      {rateDeltaFormatted && (
        <div className="market-delta-info">
          {rateDeltaFormatted.startsWith('-')
            ? t('placeBelow', { rateDelta: rateDeltaFormatted })
            : t('placeAbove', { rateDelta: rateDeltaFormatted })}
        </div>
      )}
      {highSlippageWarning && (
        <div className="slippage-warning">
          <span role="img" aria-label="warning">
            ⚠️
          </span>
          {t('highSlippageWarning')}
        </div>
      )}
      {executionRateWarning && (
        <div className="slippage-warning">
          <span role="img" aria-label="warning">
            ⚠️
          </span>
          {t('orderWarning')}
        </div>
      )}
    </>
  )
}

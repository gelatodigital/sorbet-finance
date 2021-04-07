import { AbiCoder } from '@ethersproject/abi'
import { Zero } from '@ethersproject/constants'
import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import * as ls from 'local-storage'
import React, { useEffect, useReducer, useState } from 'react'
import ReactGA from 'react-ga'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import ArrowDown from '../../assets/svg/SVGArrowDown'
import SVGDiv from '../../assets/svg/SVGDiv'
import { DCA_ORDER_THRESHOLD, ETH_ADDRESS, GELATO_DCA, GENERIC_GAS_LIMIT_ORDER_EXECUTE, PLATFORM_WALLET } from '../../constants'
import { useFetchAllBalances } from '../../contexts/AllBalances'
import { useAddressAllowance } from '../../contexts/Allowances'
import { useAddressBalance } from '../../contexts/Balances'
import { useGasPrice } from '../../contexts/GasPrice'
import { useTokenDetails, WETH } from '../../contexts/Tokens'
import { ACTION_PLACE_ORDER, useTransactionAdder } from '../../contexts/Transactions'
import { useGelatoDcaContract } from '../../hooks'
import { useTradeExactIn } from '../../hooks/trade'
import { Button } from '../../theme'
import { amountFormatter, trackTx } from '../../utils'
import { getExchangeRate } from '../../utils/rate'
import CurrencyInputPanel from '../CurrencyInputPanel'
import CurrencyInputPanelDca from '../CurrencyInputPanelDca'
import OversizedPanel from '../OversizedPanel'
import TimeIntervalInputPancel from '../TimeIntervalInputPancel'
import './TimeExchangePage.css'



// Use to detach input from output
let inputValue

const INPUT = 0
const OUTPUT = 1
const RATE = 2
const NUM_TRADES = 3
const INTERVAL = 4

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
const LS_DCA_ORDERS = 'dca_orders_'

function lsKey(key, account, chainId) {
  return key + account.toString() + chainId
}

function saveOrder(account, orderData, chainId) {
  if (!account) return

  const key = lsKey(LS_DCA_ORDERS, account, chainId)
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
    inputRateValue: '',
    numTrades: 3,
    interval: "10 minutes"
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
    case 'UPDATE_NUM_TRADES': {
      const {value} = action.payload
      return {
        ...state,
        numTrades: value === '' ? 0 : value
      }
    }
    case 'UPDATE_INTERVAL': {
      const {value} = action.payload
      return {
        ...state,
        interval: value
      }
    }
    default: {
      return getInitialSwapState()
    }
  }
}

// export const ALL_INTERVALS = ["10 minutes", "1 hour", "1 day", "1 week"]
function getIntervalSeconds(interval) {
  switch(interval) {
    case("10 minutes"): 
      return 10 * 60;
    case("1 hour"): 
      return 60 * 60;
    case("1 day"): 
      return 24 * 60 * 60;
    case("1 week"): 
      return 7 * 24 * 60 * 60;
    default: 
      throw Error("Smth went wrong in getIntervalSeconds")
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

export default function TimeExchangePage({ initialCurrency }) {
  const { t } = useTranslation()
  const { account, library, chainId } = useWeb3React()

  const gelatoDcaAddress = GELATO_DCA[chainId]

  // core swap state
  const [swapState, dispatchSwapState] = useReducer(swapStateReducer, initialCurrency, getInitialSwapState)

  const { independentValue, independentField, inputCurrency, outputCurrency, rateOp, inputRateValue, numTrades, interval } = swapState

  const gelatoDcaContract = useGelatoDcaContract()
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

  // get token allowance for gelatoDCA
  const inputAllowance = useAddressAllowance(account, inputCurrency, gelatoDcaAddress)

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
    .mul(ethers.BigNumber.from("10").pow(ethers.BigNumber.from(16)))

  const limitExecution = ethers.BigNumber.from(EXECUTION_WARNING)
    .mul(ethers.BigNumber.from("10").pow(ethers.BigNumber.from(16)))

  // validate + parse independent value
  const [independentError, setIndependentError] = useState()

  const executionRateDelta = executionRate && exchangeRateDiff(executionRate, rateRaw)
  const executionRateNegative = executionRate?.lt(ethers.constants.Zero)
  // const executionRateWarning = executionRateNegative || executionRateDelta?.abs()?.gt(limitExecution)
  

  // Calc minimum order size
  const orderThresholdInEth = DCA_ORDER_THRESHOLD[chainId ? chainId : 3]
  let minOrderSize

  const minOrderSizeTrade =  useTradeExactIn('ETH', orderThresholdInEth, inputCurrency)
  if(inputCurrency === 'ETH' ) {
    minOrderSize = ethers.utils.parseEther(orderThresholdInEth.toString())
  } else {
    if(outputCurrency && minOrderSizeTrade) {
      minOrderSize = ethers.utils.parseUnits(minOrderSizeTrade.outputAmount.toExact(), inputDecimals)
    }
  }
  const numTradesBn = ethers.BigNumber.from(numTrades.toString())
  const numTradesIsZero = numTradesBn.eq(Zero) ? true : false
  const executionRateWarning = !numTradesIsZero && inputValue && numTradesBn && minOrderSize && inputValue.div(numTradesBn).lt(minOrderSize) ? true : false

  const isLOBtwEthAndWeth =
    (inputCurrency === 'ETH' && outputCurrency.toLocaleLowerCase() === WETH[chainId]) ||
    (outputCurrency === 'ETH' && inputCurrency.toLocaleLowerCase() === WETH[chainId])
  

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

  
  useEffect(() => {
    if (inputValue && inputAllowance) {
      // console.log(`Input Value: ${inputValue.toString()}`)
      // console.log(`Input Allowance: ${inputAllowance.toString()}`)
      if (inputAllowance.lt(inputValue)) {
        // Approval of user insufficient
        setShowUnlock(true)
      } else {
        setInputError(null)
        setShowUnlock(false)
      }
    }
  }, [inputBalance, inputCurrency, t, inputValueParsed, inputAllowance])
  
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
    return `Balance: ${value}`
  }

  async function onPlace() {
    let fromCurrency, toCurrency, inputAmount, amountPerTrade, value
    ReactGA.event({
      category: 'placeDCA',
      action: 'place'
    })

    inputAmount = inputValueParsed
    amountPerTrade = inputAmount.div(numTradesBn)
    
    if (swapType === ETH_TO_TOKEN) {
      fromCurrency = ETH_ADDRESS
      toCurrency = outputCurrency
      value = amountPerTrade.mul(numTradesBn)
    } else if (swapType === TOKEN_TO_ETH) {
      fromCurrency = inputCurrency
      toCurrency = ETH_ADDRESS
      value = 0
    } else if (swapType === TOKEN_TO_TOKEN) {
      fromCurrency = inputCurrency
      toCurrency = outputCurrency
      value = 0
    }

    const order = {
      inToken: fromCurrency,
      outToken: outputCurrency === "ETH" ? ETH_ADDRESS : outputCurrency,
      amountPerTrade: amountPerTrade.toString(),
      numTrades: numTradesBn.toString(),
      minSlippage: 1000,
      maxSlippage: 9999,
      delay: getIntervalSeconds(interval),
      platformWallet: PLATFORM_WALLET[chainId],
      platformFeeBps: 50
    }

    try {
      // Prefix Hex for secret message
      // this secret it's only intended for avoiding relayer front-running
      // so a decreased entropy it's not an issue
      const secret = ethers.utils.hexlify(ethers.utils.randomBytes(13)).replace('0x', '')
      const fullSecret = `2070696e652e66696e616e63652020d83ddc09${secret}`
      const { privateKey, address } = new ethers.Wallet(fullSecret)
      const witness = address.toLowerCase()


      const abiCoder = new AbiCoder()
      const funcSig = gelatoDcaContract.interface.getSighash("submit")
      // console.log(funcSig)
      let submitData = abiCoder.encode(['tuple(address inToken, address outToken, uint256 amountPerTrade, uint256 numTrades, uint256 minSlippage, uint256 maxSlippage, uint256 delay, address platformWallet, uint256 platformFeeBps)', 'bool submitAndExec', 'address witness'], [order, false, witness]);
      submitData = "0x" + funcSig.substring(2, funcSig.length) + submitData.substring(2, submitData.length)



      // const indexOf = submitData.indexOf(witness.substring(2, witness.length))
      // const witnessCut = submitData.substring(indexOf, indexOf + 64)
      // console.log(indexOf)
      // console.log(witnessCut)
      // console.log(witness === ("0x" + witnessCut))
      // console.log(witnessHash)
      

      const provider = new ethers.providers.Web3Provider(library.provider)
      let res = await provider.getSigner().sendTransaction({
        to: gelatoDcaContract.address,
        data: submitData,
        value: value,
        gasPrice: gasPrice ? gasPrice: undefined
      })

      trackTx(res.hash, chainId)


      const submissionDate = (Math.floor(Date.now() / 1000)).toString()
      const currentId = await gelatoDcaContract.taskId()
      for(let i = 0; i < numTrades; i++) {
        const estimatedExecutionDate = ((order.delay * (i + 1)) + Math.floor(Date.now() / 1000)).toString()
        const nTradesLeft = order.numTrades.sub(ethers.BigNumber.from(i.toString())).toString()
        const index = (numTrades - i).toString()
        const witnessHash = witness + i.toString()
        const localOrder = {
          id: `${(parseInt(currentId) + 1)}:${i+1}`,
          user: account.toLowerCase(),
          status: 'awaitingExec',
          submissionDate: submissionDate,
          submissionHash: res.hash.toLowerCase(),
          estExecutionDate: estimatedExecutionDate,
          amount: amountPerTrade.toString(),
          inToken: fromCurrency.toLowerCase(),
          outToken: toCurrency.toLowerCase(),
          minSlippage: order.minSlippage.toString(),
          maxSlippage: order.maxSlippage.toString(),
          index: index,
          witness: witnessHash,
          cycleWrapper: {
            cycle: {
              nTradesLeft: nTradesLeft
            }
          }
        }

        saveOrder(account, localOrder, chainId)

        if (res.hash) {
          addTransaction(res, { action: ACTION_PLACE_ORDER, order: localOrder })
        }
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
        title={t('Total Sell Volume')}
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
        addressToApprove={gelatoDcaAddress}
        searchDisabled={true}
      />
      <OversizedPanel>
        <DownArrowBackground>
          <RateIcon
            // RateIconSVG={rateOp === RATE_OP_MULT ? SVGClose : SVGDiv}
            RateIconSVG={ SVGDiv }
            icon={rateOp}
            // onClick={() => {
            //   dispatchSwapState({ type: 'FLIP_RATE_OP' })
            // }}
            // clickable
            alt="swap"
            active={isValid}
          />
        </DownArrowBackground>
      </OversizedPanel>
      <TimeIntervalInputPancel
        title={t('Split into how many orders?')}
        allBalances={allBalances}
        description={""}
        extraText={'Time between orders'}
        onIntervalSelect={outputInterval => {
          dispatchSwapState({ type: 'UPDATE_INTERVAL', payload: { value: outputInterval, field: INTERVAL } })
        }}
        onValueChange={newNumTrades => {
          // Dispatch change in value
          dispatchSwapState({ type: 'UPDATE_NUM_TRADES', payload: { value: newNumTrades, field: NUM_TRADES } })
        }}
        selectedTokens={[inputCurrency, outputCurrency]}
        interval={interval}
        value={numTrades}
        errorMessage={independentField === OUTPUT ? independentError : ''}
        disableUnlock
      />
      <OversizedPanel>
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
      <CurrencyInputPanelDca
        title={t('')}
        allBalances={allBalances}
        description={''}
        extraText={'Token to buy'}
        onCurrencySelected={outputCurrency => {
          dispatchSwapState({ type: 'SELECT_CURRENCY', payload: { currency: outputCurrency, field: OUTPUT } })
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: inputValueFormatted, field: INPUT } })
        }}
        onValueChange={outputValue => {
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: outputValue, field: OUTPUT } })
        }}
        selectedTokens={[inputCurrency, outputCurrency]}
        selectedTokenAddress={outputCurrency}
        // value={outputValueFormatted}
        errorMessage={independentField === OUTPUT ? independentError : ''}
        disableUnlock
        searchDisabled={true}
      />
      <OversizedPanel hideBottom>
        <ExchangeRateWrapper
        >
          {numTrades && (
            <span>
              {`${numTrades} Orders, each swapping ${numTrades ? (inputValueFormatted / numTrades).toFixed(4) : 0} ${inputSymbol} ${outputSymbol ? `to ${outputSymbol}` : ''} every ${interval}`}
          </span>
          )}
        </ExchangeRateWrapper>
      </OversizedPanel>
      <Flex>
        <Button
          disabled={showUnlock || !account || !isValid || customSlippageError === 'invalid' || numTradesIsZero || executionRateWarning || isLOBtwEthAndWeth}
          onClick={onPlace}
          warning={highSlippageWarning || executionRateWarning || customSlippageError === 'warning'}
        >
          {customSlippageError === 'warning' ? t('placeAnyway') : t('place')}
        </Button>
      </Flex>
      {executionRateWarning && (
        <div className="slippage-warning">
          <span role="img" aria-label="warning">
            ⚠️
          </span>
          {`Min. total order size: ${amountFormatter(minOrderSize.mul(numTradesBn), inputDecimals, 4, false)} ${inputSymbol} for ${numTrades} orders`}
        </div>
      )}
      {isLOBtwEthAndWeth && (
        <div className="slippage-warning">
          <span role="img" aria-label="warning">
            ⚠️
          </span>
          {t('ethToWethLOWng')}
        </div>
      )}
    </>
  )
}

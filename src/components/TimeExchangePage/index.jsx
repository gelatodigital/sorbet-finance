import { getMinOrderRequirements, getOrdersArray, placeDcaOrder, storeOrdersInLocalStorage } from '@gelatonetwork/dca-sdk'
import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import * as ls from 'local-storage'
import { transparentize } from 'polished'
import React, { useEffect, useReducer, useState } from 'react'
import ReactGA from 'react-ga'
import { useTranslation } from 'react-i18next'
import { Redirect } from 'react-router-dom'
import styled from 'styled-components'
import ArrowDown from '../../assets/svg/SVGArrowDown'
import SVGDiv from '../../assets/svg/SVGDiv'
import { ALL_INTERVALS, DCA_ORDER_THRESHOLD, ETH_ADDRESS, GELATO_DCA, PLATFORM_WALLET } from '../../constants'
import { NATIVE_TOKEN_TICKER } from '../../constants/networks'
import { useFetchAllBalances } from '../../contexts/AllBalances'
import { useAddressAllowance } from '../../contexts/Allowances'
import { useAddressBalance } from '../../contexts/Balances'
import { useGasPrice } from '../../contexts/GasPrice'
import { useTokenDcaDetails, WETH } from '../../contexts/TokensDca'
import { ACTION_PLACE_ORDER, useTransactionAdder } from '../../contexts/Transactions'
import { useTradeExactIn } from '../../hooks/trade'
import { Button, Link } from '../../theme'
import { amountFormatter, trackTx } from '../../utils'
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

const RATE_OP_MULT = 'x'
const RATE_OP_DIV = '/'

const BetaMessage = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  cursor: pointer;
  flex: 1 0 auto;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0.5rem 1rem;
  padding-right: 2rem;
  margin-bottom: 1rem;
  border: 1px solid ${({ theme }) => transparentize(0.6, theme.wisteriaPurple)};
  background-color: ${({ theme }) => transparentize(0.9, theme.wisteriaPurple)};
  border-radius: 1rem;
  font-size: 0.75rem;
  line-height: 1rem;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ theme }) => theme.wisteriaPurple};
  &:after {
    content: '✕';
    top: 0.5rem;
    right: 1rem;
    position: absolute;
    color: ${({ theme }) => theme.wisteriaPurple};
  }
  .how-it-works {
    text-decoration: underline;
    text-align: center;
  }
`

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
    interval: ALL_INTERVALS[0],
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
        outputCurrency: inputCurrency,
      }
    }
    case 'FLIP_RATE_OP': {
      const { rateOp, inputRateValue } = state

      const rate = inputRateValue ? ethers.BigNumber.from(ethers.utils.parseUnits(inputRateValue, 18)) : undefined
      const flipped = rate ? amountFormatter(flipRate(rate), 18, 18, false) : ''

      return {
        ...state,
        inputRateValue: flipped,
        rateOp: rateOp === RATE_OP_DIV ? RATE_OP_MULT : RATE_OP_DIV,
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
          outputCurrency: field === OUTPUT ? currency : '',
        }
      } else {
        return {
          ...state,
          inputCurrency: newInputCurrency,
          outputCurrency: newOutputCurrency,
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
        prevIndependentField: independentField === field ? prevIndependentField : independentField,
      }
    }
    case 'UPDATE_DEPENDENT': {
      return {
        ...state,
        dependentValue: action.payload === null ? inputValue : action.payload,
      }
    }
    case 'UPDATE_NUM_TRADES': {
      const { value } = action.payload
      return {
        ...state,
        numTrades: value === '' ? 0 : value,
      }
    }
    case 'UPDATE_INTERVAL': {
      const { value } = action.payload
      return {
        ...state,
        interval: value,
      }
    }
    default: {
      return getInitialSwapState()
    }
  }
}

// export const ALL_INTERVALS = ["10 minutes", "1 hour", "1 day", "1 week"]
function getIntervalSeconds(interval) {
  switch (interval) {
    case '1 hour':
      return 60 * 60
    case '1 day':
      return 24 * 60 * 60
    case '1 week':
      return 7 * 24 * 60 * 60
    default:
      throw Error('Smth went wrong in getIntervalSeconds')
  }
}

function flipRate(rate) {
  try {
    if (rate) {
      const factor = ethers.BigNumber.from(10).pow(ethers.BigNumber.from(18))
      return factor.mul(factor).div(rate)
    }
  } catch {}
}

export default function TimeExchangePage({ initialCurrency }) {
  const { t } = useTranslation()
  const { account, library, chainId } = useWeb3React()

  const gelatoDcaAddress = GELATO_DCA[chainId]

  // core swap state
  const [swapState, dispatchSwapState] = useReducer(swapStateReducer, initialCurrency, getInitialSwapState)

  const { independentValue, independentField, inputCurrency, outputCurrency, rateOp, numTrades, interval } = swapState

  const [inputError, setInputError] = useState()

  const addTransaction = useTransactionAdder()

  // get swap type from the currency types
  const swapType = getSwapType(inputCurrency, outputCurrency)

  // get decimals and exchange address for each of the currency types
  const { symbol: inputSymbol, decimals: inputDecimals } = useTokenDcaDetails(inputCurrency)
  const { symbol: outputSymbol, decimals: outputDecimals } = useTokenDcaDetails(outputCurrency)

  // get balances for each of the currency types
  const inputBalance = useAddressBalance(account, inputCurrency)
  const inputBalanceFormatted = !!(inputBalance && Number.isInteger(inputDecimals))
    ? amountFormatter(inputBalance, inputDecimals, Math.min(4, inputDecimals))
    : ''

  // get token allowance for gelatoDCA
  const inputAllowance = useAddressAllowance(account, inputCurrency, gelatoDcaAddress)

  // compute useful transforms of the data above
  const independentDecimals = independentField === INPUT || independentField === RATE ? inputDecimals : outputDecimals

  // declare/get parsed and formatted versions of input/output values
  const [independentValueParsed, setIndependentValueParsed] = useState()
  const inputValueParsed = independentField === INPUT ? independentValueParsed : inputValue
  const inputValueFormatted =
    independentField === INPUT ? independentValue : amountFormatter(inputValue, inputDecimals, inputDecimals, false)

  const bestTradeExactIn = useTradeExactIn(
    inputCurrency,
    independentField === INPUT ? independentValue : inputValueFormatted,
    outputCurrency
  )

  if (bestTradeExactIn) {
    inputValue = ethers.BigNumber.from(ethers.utils.parseUnits(bestTradeExactIn.inputAmount.toExact(), inputDecimals))
  } else if (independentField === INPUT && independentValue) {
    inputValue = ethers.BigNumber.from(ethers.utils.parseUnits(independentValue, inputDecimals))
  }

  // load required gas
  const gasPrice = useGasPrice()

  // validate + parse independent value
  const [independentError, setIndependentError] = useState()
  const [minOrderSize, setMinOrderSize]  = useState(ethers.utils.parseEther(DCA_ORDER_THRESHOLD[chainId]))
  const [executionRateWarning, setExecutionRateWarning]  = useState(false)

  const numTradesBn = ethers.BigNumber.from(numTrades.toString())
  const numTradesIsZero = numTradesBn.eq(ethers.constants.Zero) ? true : false


  const isLOBtwEthAndWeth =
    (inputCurrency === 'ETH' && outputCurrency.toLocaleLowerCase() === WETH[chainId]) ||
    (outputCurrency === 'ETH' && inputCurrency.toLocaleLowerCase() === WETH[chainId])

  const insufficientNumTrades = !numTrades || numTradesBn.lt(2) ? true : false

  useEffect(() => {
    const updateOrderRequirements = async() => {
        const provider = new ethers.providers.Web3Provider(library.provider)
        const signer = await provider.getSigner()
        const minOrderRequirements = await getMinOrderRequirements(
          inputCurrency === 'ETH' ? ETH_ADDRESS : inputCurrency,
          inputValue,
          numTradesBn,
          signer,
          ethers.utils.parseEther(DCA_ORDER_THRESHOLD[chainId])
        )
        setMinOrderSize(minOrderRequirements.minOrderSize)
        setExecutionRateWarning(minOrderRequirements.warning)
    
    }
    if (library && inputValueFormatted && inputCurrency) {
      updateOrderRequirements()
    }
    
  }, [inputCurrency, inputValueFormatted.toString(), numTradesBn.toString(), account])

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

  const [showUnlock, setShowUnlock] = useState(false)
  useEffect(() => {
    if (inputValue && inputAllowance) {
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
  useEffect(() => {
    const inputValueCalculation = inputValueParsed
    if (inputBalance && inputValueCalculation) {
      if (inputBalance.lt(inputValueCalculation)) {
        setInputError(t('insufficientBalance'))
      } else {
        setInputError(null)
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

  const isValid = !inputError && !independentError

  function formatBalance(value) {
    return `Balance: ${value}`
  }

  async function onPlace() {
    let fromCurrency, inputAmount, amountPerTrade
    ReactGA.event({
      category: 'placeDCA',
      action: 'place',
    })

    inputAmount = inputValueParsed
    amountPerTrade = inputAmount.div(numTradesBn)

    if (swapType === ETH_TO_TOKEN) {
      fromCurrency = ETH_ADDRESS
    } else if (swapType === TOKEN_TO_ETH) {
      fromCurrency = inputCurrency
    } else if (swapType === TOKEN_TO_TOKEN) {
      fromCurrency = inputCurrency
    }

    const order = {
      inToken: fromCurrency,
      outToken: outputCurrency === 'ETH' ? ETH_ADDRESS : outputCurrency,
      amountPerTrade: amountPerTrade,
      numTrades: numTradesBn,
      minSlippage: ethers.BigNumber.from("1000"),
      maxSlippage: ethers.BigNumber.from("9999"),
      // delay: 120,
      delay: ethers.BigNumber.from(getIntervalSeconds(interval).toString()),
      platformWallet: PLATFORM_WALLET[chainId],
      platformFeeBps: ethers.BigNumber.from("0"),
    }

    try {
      const provider = new ethers.providers.Web3Provider(library.provider)
      const signer = provider.getSigner()
      const slippage = 100 // 1%

      const {tx, txData} = await placeDcaOrder(
        order,
        slippage,
        gasPrice,
        signer
      )

      const localOrders = getOrdersArray(
        order,
        account,
        txData.witness,
        tx.hash,
      )

      storeOrdersInLocalStorage(localOrders, account, chainId);

      trackTx(tx.hash, chainId)
      localOrders.forEach(order => {
        if (tx.hash) {
          addTransaction(tx, { action: ACTION_PLACE_ORDER, order: order })
        }
      })
    } catch (e) {
      console.log('Error on place order', e.message)
    }
  }

  const [customSlippageError] = useState('')

  const allBalances = useFetchAllBalances()

  const [showBetaMessage, setShowBetaMessage] = useState(true)

  const [showWhatIsDca, setShowWhatIsDca] = useState(true)

  if (NATIVE_TOKEN_TICKER[chainId] !== 'ETH') {
    return <Redirect to="/limit-order" />
  }

  return (
    <>
      {showBetaMessage && (
        <BetaMessage onClick={() => setShowBetaMessage(false)}>
          <span role="img" aria-label="warning">
            🚨
          </span>{' '}
          <Link id="link" className="how-it-works">
            {`Experimental - Use at own risk`}
          </Link>
        </BetaMessage>
      )}
      {showWhatIsDca && (
        <BetaMessage onClick={() => setShowWhatIsDca(false)}>
          <span role="img" aria-label="warning">
            ❓
          </span>{' '}
          <Link
            id="link"
            href="https://www.investopedia.com/terms/d/dollarcostaveraging.asp#:~:text=Dollar%2Dcost%20averaging%20(DCA)%20is%20an%20investment%20strategy%20in,volatility%20on%20the%20overall%20purchase.&text=Dollar%2Dcost%20averaging%20is%20also%20known%20as%20the%20constant%20dollar%20plan."
            className="how-it-works"
          >
            {`What is Dollar Cost Averaging?`}
          </Link>
        </BetaMessage>
      )}

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
                payload: { value: amountFormatter(valueToSet, inputDecimals, inputDecimals, false), field: INPUT },
              })
            }
          }
        }}
        onCurrencySelected={(inputCurrency) => {
          dispatchSwapState({ type: 'SELECT_CURRENCY', payload: { currency: inputCurrency, field: INPUT } })
        }}
        onValueChange={(inputValue) => {
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
            RateIconSVG={SVGDiv}
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
        description={''}
        extraText={'Time between orders'}
        onIntervalSelect={(outputInterval) => {
          dispatchSwapState({ type: 'UPDATE_INTERVAL', payload: { value: outputInterval, field: INTERVAL } })
        }}
        onValueChange={(newNumTrades) => {
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
        onCurrencySelected={(outputCurrency) => {
          dispatchSwapState({ type: 'SELECT_CURRENCY', payload: { currency: outputCurrency, field: OUTPUT } })
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: inputValueFormatted, field: INPUT } })
        }}
        onValueChange={(outputValue) => {
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
        <ExchangeRateWrapper>
          {numTrades && (
            <span>
              {`${numTrades} Orders, each swapping ${
                numTrades ? (inputValueFormatted / numTrades).toFixed(4) : 0
              } ${inputSymbol} ${outputSymbol ? `to ${outputSymbol}` : ''} every ${interval}`}
            </span>
          )}
        </ExchangeRateWrapper>
      </OversizedPanel>
      <Flex>
        <Button
          disabled={
            showUnlock ||
            !account ||
            !isValid ||
            customSlippageError === 'invalid' ||
            numTradesIsZero ||
            executionRateWarning ||
            isLOBtwEthAndWeth ||
            !outputSymbol ||
            insufficientNumTrades
          }
          onClick={onPlace}
          warning={executionRateWarning || customSlippageError === 'warning'}
        >
          {customSlippageError === 'warning' ? t('placeAnyway') : t('place')}
        </Button>
      </Flex>
      {executionRateWarning && (
        <div className="slippage-warning">
          <span role="img" aria-label="warning">
            ⚠️
          </span>
          {`Min. total order size: ${amountFormatter(
            minOrderSize.mul(numTradesBn),
            inputDecimals,
            4,
            false
          )} ${inputSymbol} for ${numTrades} orders`}
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
      {insufficientNumTrades && (
        <div className="slippage-warning">
          <span role="img" aria-label="warning">
            ⚠️
          </span>
          {t('insufficientNumTrades')}
        </div>
      )}
    </>
  )
}

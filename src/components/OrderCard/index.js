import { getCancelLimitOrderPayload } from "@gelatonetwork/limit-orders-lib"
import Tooltip from '@reach/tooltip'
import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import ArrowDown from '../../assets/svg/SVGArrowDown'
import { ETH_ADDRESS, GENERIC_GAS_LIMIT_ORDER_EXECUTE } from '../../constants'
import { useGasPrice } from '../../contexts/GasPrice'
import { useTokenDetails } from '../../contexts/Tokens'
import {
  ACTION_CANCEL_ORDER, ACTION_PLACE_ORDER, useOrderPendingState, useTransactionAdder
} from '../../contexts/Transactions'
import { useTradeExactIn } from '../../hooks/trade'
import { amountFormatter, getEtherscanLink, trackTx } from '../../utils'
import { getExchangeRate } from '../../utils/rate'
import { Aligner, CurrencySelect, StyledTokenName } from '../CurrencyInputPanel'
import TokenLogo from '../TokenLogo'
import './OrderCard.css'
import { NATIVE_TOKEN_TICKER } from '../../constants/networks'


const CancelButton = styled.div`
  color: ${({ selected, theme }) => (selected ? theme.textColor : theme.textColor)};
  padding: 0px 6px 0px 6px;
  font-size: 0.85rem;
`

const Order = styled.div`
  display: -webkit-box;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  -webkit-flex-flow: column nowrap;
  -ms-flex-flow: column nowrap;
  flex-flow: column nowrap;
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.05);
  position: relative;
  border-radius: 1.25rem;
  z-index: 1;
  padding: 20px;
  margin-bottom: 40px;
  border: ${({ theme }) => `1px solid ${theme.mercuryGray}`};
  background-color: ${({ theme }) => theme.concreteGray};
`

const Spacer = styled.div`
  flex: 1 1 auto;
`
const WrappedArrowRight = ({ clickable, active, ...rest }) => <ArrowDown {...rest} transform="rotate(-90)" />

const RightArrow = styled(WrappedArrowRight)`
  color: ${({ theme }) => theme.royalPurple};
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
`

export function OrderCard(props) {
  const { t } = useTranslation()
  const { library, chainId } = useWeb3React()

  const order = props.data

  const inputToken = order.inputToken === ETH_ADDRESS.toLowerCase() ? NATIVE_TOKEN_TICKER[chainId] : ethers.utils.getAddress(order.inputToken)
  const outputToken =
    order.outputToken === ETH_ADDRESS.toLowerCase() ? NATIVE_TOKEN_TICKER[chainId] : ethers.utils.getAddress(order.outputToken)

  const { symbol: fromSymbol, decimals: fromDecimals } = useTokenDetails(inputToken)
  const { symbol: toSymbol, decimals: toDecimals } = useTokenDetails(outputToken)
  const { state, last } = useOrderPendingState(order)

  const canceling = state === ACTION_CANCEL_ORDER
  const pending = state === ACTION_PLACE_ORDER

  const addTransaction = useTransactionAdder()

  async function onCancel(order, pending) {

    const { inputToken, outputToken, minReturn, owner, witness } = order

    const transactionData = await getCancelLimitOrderPayload(chainId, inputToken, outputToken, minReturn, owner, witness, new ethers.providers.Web3Provider(library.provider))
    const res = await (new ethers.providers.Web3Provider(library.provider)).getSigner().sendTransaction({
      to: transactionData.to,
      data: transactionData.data,
      value: transactionData.value,
      gasPrice: gasPrice,
      gasLimit: 400000
    });

    if (res.hash) {
      trackTx(res.hash, chainId)
      addTransaction(res, { action: ACTION_CANCEL_ORDER, order: order })
    }
    
  }

  const inputAmount = ethers.BigNumber.from(
    order.inputAmount !== '0' || !order.creationAmount ? order.inputAmount : order.creationAmount
  )
  const minReturn = ethers.BigNumber.from(order.minReturn)

  const explorerLink = last ? getEtherscanLink(chainId, last.response.hash, 'transaction') : undefined

  const rateFromTo = getExchangeRate(inputAmount, fromDecimals, minReturn, toDecimals, false)
  const rateToFrom = getExchangeRate(inputAmount, fromDecimals, minReturn, toDecimals, true)

  const gasPrice = useGasPrice()
  const gasLimit = GENERIC_GAS_LIMIT_ORDER_EXECUTE
  const requiredGas = gasPrice?.mul(gasLimit)

  const gasInInputTokens = useTradeExactIn(NATIVE_TOKEN_TICKER[chainId], amountFormatter(requiredGas, 18, 18), inputToken)

  let tooltipText = ''
  let executionRateText = ''

  try {
    const [virtualRateFromTo, virtualRateToFrom] = useMemo(() => {
      if (!gasPrice) return [undefined, undefined]

      let usedInput

      try {
        if (inputToken === NATIVE_TOKEN_TICKER[chainId]) {
          usedInput = requiredGas
        } else if (!gasInInputTokens || !requiredGas) {
          return [undefined, undefined]
        } else {
          usedInput = ethers.utils.parseUnits(gasInInputTokens.outputAmount.toExact(), fromDecimals)
        }

        return [
          getExchangeRate(inputAmount.sub(usedInput), fromDecimals, minReturn, toDecimals, false),
          getExchangeRate(inputAmount.sub(usedInput), fromDecimals, minReturn, toDecimals, true)
        ]
      } catch {
        return [undefined, undefined]
      }
    }, [fromDecimals, inputAmount, minReturn, requiredGas, toDecimals, inputToken, gasInInputTokens, gasPrice, chainId])

    if (virtualRateFromTo?.gt(ethers.constants.Zero)) {
      executionRateText = `Execution rate: ${
        virtualRateFromTo ? amountFormatter(virtualRateFromTo, 18, 3) : '...'
      } ${fromSymbol}/${toSymbol} -
        ${virtualRateToFrom ? amountFormatter(virtualRateToFrom, 18, 3) : '...'} ${toSymbol}/${fromSymbol}* `
    } else if (virtualRateFromTo) {
      executionRateText = 'Execution rate: never executes'
    } else {
      executionRateText = ''
    }

    tooltipText = `Required rate to execute order assuming gas price of ${
      gasPrice ? amountFormatter(gasPrice, 9, 2) : '...'
    } GWEI`
  } catch (e) {
    console.warn('Error computing virtual rate', e)
  }
  return (
    <Order className={`order ${order.status}`}>
      <div className="tokens">
        <CurrencySelect selected={true}>
          <Aligner>
            {<TokenLogo address={inputToken} />}
            {<StyledTokenName>{fromSymbol}</StyledTokenName>}
          </Aligner>
        </CurrencySelect>
        <Aligner>
          <RightArrow transform="rotate(-90)" />
        </Aligner>
        <CurrencySelect selected={true}>
          <Aligner>
            {<TokenLogo address={outputToken} />}
            {<StyledTokenName>{toSymbol}</StyledTokenName>}
          </Aligner>
        </CurrencySelect>
        <Spacer />
        <CurrencySelect selected={true} disabled={canceling} onClick={() => onCancel(order, pending)}>
          <CancelButton>{canceling ? 'Cancelling ...' : t('cancel')}</CancelButton>
        </CurrencySelect>
      </div>{' '}
      <p>
        {`Sell: ${amountFormatter(inputAmount, fromDecimals, 6)}`} {fromSymbol}
      </p>
      <p>
        {`Receive: ${amountFormatter(minReturn, toDecimals, 6)}`} {toSymbol}
      </p>
      <p>
        {`Rate: ${amountFormatter(rateFromTo, 18, 6)}`} {fromSymbol}/{toSymbol} - {amountFormatter(rateToFrom, 18, 6)}{' '}
        {toSymbol}/{fromSymbol}
      </p>
      <Tooltip
        label={tooltipText}
        style={{
          background: 'hsla(0, 0%, 0%, 0.75)',
          color: 'white',
          border: 'none',
          borderRadius: '24px',
          padding: '0.5em 1em',
          marginTop: '-64px'
        }}
      >
        <p>{executionRateText}</p>
      </Tooltip>
      <p>
        {last && (
          <a rel="noopener noreferrer" target="_blank" href={explorerLink} className="order-link">
            Pending transaction...
          </a>
        )}
      </p>
    </Order>
  )
}

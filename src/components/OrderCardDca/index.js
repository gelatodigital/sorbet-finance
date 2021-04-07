import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import ArrowDown from '../../assets/svg/SVGArrowDown'
import { ETH_ADDRESS } from '../../constants'
import { useGasPrice } from '../../contexts/GasPrice'
import { useTokenDetails } from '../../contexts/Tokens'
import {
  ACTION_CANCEL_ORDER, ACTION_PLACE_ORDER, useOrderPendingStateDca, useTransactionAdder
} from '../../contexts/Transactions'
import { useGelatoDcaContract } from '../../hooks'
import { amountFormatter, getEtherscanLink, getTimeAndDate, trackTx } from '../../utils'
import { Aligner, CurrencySelect, StyledTokenName } from '../CurrencyInputPanel'
import TokenLogo from '../TokenLogo'
import './OrderCardDca.css'


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

export function OrderCardDca(props) {
  const { t } = useTranslation()
  const { chainId } = useWeb3React()
  const gelatoDcaContract = useGelatoDcaContract()

  const order = props.data

  const gasPrice = useGasPrice()
  

  const inputToken = order.inToken === ETH_ADDRESS.toLowerCase() ? 'ETH' : ethers.utils.getAddress(order.inToken)
  const outputToken =
  order.outToken === ETH_ADDRESS.toLowerCase() ? 'ETH' : ethers.utils.getAddress(order.outToken)

  const { symbol: fromSymbol, decimals: fromDecimals } = useTokenDetails(inputToken)
  const { symbol: toSymbol, decimals: toDecimals } = useTokenDetails(outputToken)

  // @dev fix 
  const { state, last } = useOrderPendingStateDca()

  const canceling = state === ACTION_CANCEL_ORDER
  const pending = state === ACTION_PLACE_ORDER

  // WHITELIST WETH DAI IN OA
  
  const addTransaction = useTransactionAdder()

  const getTimerText = (execDate) => {
    execDate =  Number(execDate)
    const now = Math.floor(new Date().getTime() / 1000);

    // Find the distance between now and the count down date
    const distance = Math.max(execDate - now, 0);

    // Time calculations for days, hours, minutes and seconds
    const days = Math.floor(distance / (60 * 60 * 24));
    const hours = Math.floor((distance % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((distance % (60 * 60)) / (60));
    // const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    if(distance > 0) {
      return `${days}d: ${hours}h: ${minutes}m`
    } else {
      return `pending ...`
    }
    
  }

  async function onCancel(cycle, id, pending) {
    gelatoDcaContract
      .cancel(
        cycle,
        id,
        {
          gasLimit: pending ? 400000 : undefined,
          gasPrice: gasPrice ? gasPrice : undefined
        }
      )
      .then(response => {
        trackTx(response.hash, chainId)
        addTransaction(response, { action: ACTION_CANCEL_ORDER, order: order })
      })
  }

  const inputAmount = ethers.BigNumber.from(
    order.amount
  )

  const explorerLink = last ? getEtherscanLink(chainId, last.response.hash, 'transaction') : undefined


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
        {order.status === "awaitingExec" && order.index === order.cycleWrapper.cycle.nTradesLeft && (
          <CurrencySelect selected={true} disabled={order.status === "cancelled" ? true : false} onClick={() => onCancel(order.cycleWrapper.cycle, order.cycleWrapper.id)}>
            <CancelButton>{canceling ? 'Cancelling ...' : t('cancel')}</CancelButton>
          </CurrencySelect>  
        )}
      </div>{' '}
      <p>
        {`Sell: ${amountFormatter(inputAmount, fromDecimals, 6)}`} {fromSymbol}
        {/* {`TEST`}  */}
      </p>
      <p>{`Status: ${order.status === "awaitingExec" ? "pending" : order.status}`}</p>
      <p>{`Time to Exec: ${getTimerText(order.estExecutionDate)}`}</p>
      <p>{`Estimated Exec Date: ${getTimeAndDate(order.estExecutionDate)}`}</p>
      {/* <Tooltip
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
      </Tooltip> */}
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

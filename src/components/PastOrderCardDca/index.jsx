import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import React from 'react'
import styled from 'styled-components'
import ArrowDown from '../../assets/svg/SVGArrowDown'
import { ETH_ADDRESS } from '../../constants'
import { useTokenDetails } from '../../contexts/Tokens'
import { amountFormatter, getEtherscanLink, getTimeAndDate } from '../../utils'
import { Aligner, CurrencySelect, StyledTokenName } from '../CurrencyInputPanel'
import TokenLogo from '../TokenLogo'
import './OrderCard.css'



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

export function PastOrderCardDca(props) {
  const { chainId } = useWeb3React()

  const order = props.data

  const cancelled = order.status === 'cancelled'
  const executed = order.status === 'execSuccess'
  
  const inputToken = order.inToken === ETH_ADDRESS.toLowerCase() ? 'ETH' : ethers.utils.getAddress(order.inToken)
  const outputToken =
  order.outToken === ETH_ADDRESS.toLowerCase() ? 'ETH' : ethers.utils.getAddress(order.outToken)
  
  let feeToken;
  if (executed && order.feeToken) feeToken = order.feeToken === ETH_ADDRESS.toLowerCase() ? 'ETH' : ethers.utils.getAddress(order.feeToken)

  const { symbol: fromSymbol, decimals: fromDecimals } = useTokenDetails(inputToken)
  const { symbol: toSymbol, decimals: toDecimals } = useTokenDetails(outputToken)
  const { symbol: feeSymbol, decimals: feeDcimals } = useTokenDetails(feeToken)

  
  const bought = ethers.BigNumber.from(executed && order.amountReceived ? order.amountReceived : 0)
  const fee = ethers.BigNumber.from(executed && order.executorFee ? order.executorFee : 0)
  
  const inputAmount = ethers.BigNumber.from(
    order.amount
  )

  const explorerLink = getEtherscanLink(
    chainId,
    order.executionHash,
    'transaction'
  )

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
      </div>
      {executed && (
        <>
          <p>
            {`Sold: ${amountFormatter(inputAmount, fromDecimals, 6)}`} {fromSymbol}
          </p>
          {/* <p>
            {`Expected: ${amountFormatter(minReturn, toDecimals, 6)}`} {toSymbol}
          </p> */}
          <p>
            {`Received: ${amountFormatter(bought, toDecimals, 6)}`} {toSymbol}
          </p>
          <p>
            {`Execution Fee: ${amountFormatter(fee, feeDcimals, 6)}`} {feeSymbol}
          </p>
          <p>{`Date: ${getTimeAndDate(order.executionDate)}`}</p>
          <a rel="noopener noreferrer" target="_blank" href={explorerLink} className="order-link">
            Executed
          </a>
        </>
      )}
      {cancelled && (
        <>
          <p>
            {`Sell: ${amountFormatter(inputAmount, fromDecimals, 6)}`} {fromSymbol}
          </p>
          {/* <p>
            {`Expected: ${amountFormatter(minReturn, toDecimals, 6)}`} {toSymbol}
          </p> */}
          <p className="order-link">
            Cancelled
          </p>
          {/* <p>{`Date: ${getTimeAndDate(order.executionDate)}`}</p>
          <a rel="noopener noreferrer" target="_blank" href={explorerLink} className="order-link">
            Cancelled
          </a> */}
        </>
      )}
    </Order>
  )
}

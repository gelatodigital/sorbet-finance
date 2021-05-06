import Tooltip from '@reach/tooltip'
import '@reach/tooltip/styles.css'
import { BigNumber } from '@uniswap/sdk'
import escapeStringRegex from 'escape-string-regexp'
import { darken, transparentize } from 'polished'
import React, { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import ClockIcon from '../../assets/images/clock.svg'
import { ReactComponent as DropDown } from '../../assets/images/dropdown.svg'
import { ReactComponent as Close } from '../../assets/images/x.svg'
import { ALL_INTERVALS } from "../../constants"
import { useUSDPrice } from '../../contexts/Application'
import { useAllTokenDetails, useTokenDetails } from '../../contexts/Tokens'
import { BorderlessInput, Spinner } from '../../theme'
import { formatEthBalance, formatTokenBalance, isAddress } from '../../utils'
import Modal from '../Modal'

const Clock =  styled.img`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  background-color: white;
  border-radius: 1rem;
`

const InputRow = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;

  padding: 0.25rem 0.85rem 0.75rem;
`

const Input = styled(BorderlessInput)`
  font-size: 1.5rem;
  color: ${({ error, theme }) => error && theme.salmonRed};
  background-color: ${({ theme }) => theme.inputBackground};
  -moz-appearance: textfield;
`

const StyledBorderlessInput = styled(BorderlessInput)`
  min-height: 2.5rem;
  flex-shrink: 0;
  text-align: left;
  padding-left: 1.6rem;
  background-color: ${({ theme }) => theme.concreteGray};
`

export const CurrencySelect = styled.button`
  align-items: center;
  font-size: 1rem;
  color: ${({ selected, theme }) => (selected ? theme.textColor : theme.primary1)};
  height: 2rem;
  border: 1px solid ${({ selected, theme }) => (selected ? theme.primary1 : theme.primary1)};
  border-radius: 2.5rem;
  background-color: #fafafa;
  outline: none;
  cursor: pointer;
  user-select: none;

  :hover {
    border: 1px solid
      ${({ selected, theme }) => (selected ? darken(0.1, theme.primary1) : darken(0.1, theme.primary1))};
  }

  :focus {
    border: 1px solid ${({ theme }) => darken(0.1, theme.primary1)};
  }
`

export const Aligner = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const StyledDropDown = styled(DropDown)`
  margin: 0 0.5rem 0 0.5rem;
  height: 35%;

  path {
    stroke: ${({ selected, theme }) => (selected ? theme.textColor : theme.primary1)};
  }
`

const InputPanel = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap}
  box-shadow: 0 4px 8px 0 ${({ theme }) => transparentize(0.95, theme.shadowColor)};
  position: relative;
  border-radius: 1.25rem;
  background-color: ${({ theme }) => theme.inputBackground};
  z-index: 1;
`

const Container = styled.div`
  border-radius: 1.25rem;
  border: 1px solid ${({ error, theme }) => (error ? theme.salmonRed : theme.primary1)};

  background-color: ${({ theme }) => theme.inputBackground};
  :focus-within {
    border: 1px solid ${({ theme }) => theme.primary1};
  }
`

const LabelRow = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  color: ${({ theme }) => theme.primary1};
  font-size: 0.75rem;
  line-height: 1rem;
  padding: 0.75rem 1rem;
  span:hover {
    cursor: pointer;
    color: ${({ theme }) => darken(0.2, theme.primary1)};
  }
`

const LabelContainer = styled.div`
  flex: 1 1 auto;
  width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const ErrorSpan = styled.span`
  color: ${({ error, theme }) => error && theme.salmonRed};
  :hover {
    cursor: pointer;
    color: ${({ error, theme }) => error && darken(0.1, theme.salmonRed)};
  }
`

const TokenModal = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap}
  width: 100%;
`

const ModalHeader = styled.div`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px 0px 0px 1rem;
  height: 60px;
`

const CloseColor = styled(Close)`
  path {
    stroke: ${({ theme }) => theme.textColor};
  }
`

const CloseIcon = styled.div`
  position: absolute;
  right: 1rem;
  top: 14px;
  &:hover {
    cursor: pointer;
    opacity: 0.6;
  }
`

const SearchContainer = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  justify-content: flex-start;
  padding: 0.5rem 1.5rem;
  background-color: ${({ theme }) => theme.concreteGray};
`

const TokenModalInfo = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  padding: 1rem 1.5rem;
  margin: 0.25rem 0.5rem;
  justify-content: center;
  user-select: none;
`

const TokenList = styled.div`
  flex-grow: 1;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`

const TokenModalRow = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  cursor: pointer;
  user-select: none;

  #symbol {
    color: ${({ theme }) => theme.doveGrey};
  }

  :hover {
    background-color: ${({ theme }) => theme.tokenRowHover};
  }

  ${({ theme }) => theme.mediaWidth.upToMedium`padding: 0.8rem 1rem;`}
`

const TokenRowLeft = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items : center;
`

const TokenSymbolGroup = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap};
  margin-left: 1rem;
`

const TokenFullName = styled.div`
  color: ${({ theme }) => theme.chaliceGray};
`

const TokenRowBalance = styled.div`
  font-size: 1rem;
  line-height: 20px;
`

const TokenRowUsd = styled.div`
  font-size: 1rem;
  line-height: 1.5rem;
  color: ${({ theme }) => theme.chaliceGray};
`

const TokenRowRight = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap};
  align-items: flex-end;
`

export const StyledTokenName = styled.span`
  margin: 0 0.25rem 0 0.25rem;
`

const SpinnerWrapper = styled(Spinner)`
  margin: 0 0.25rem 0 0.25rem;
  color: ${({ theme }) => theme.chaliceGray};
  opacity: 0.6;
`

const TimeClock = () => 
  { return (
    <Clock
    src={ClockIcon}
    size={"2rem"}
  />)
}

export default function TimeIntervalInputPancel({
  onValueChange = () => {},
  allBalances,
  renderInput,
  onIntervalSelect = () => {},
  title,
  description,
  extraText,
  extraTextClickHander = () => {},
  errorMessage,
  disableUnlock,
  disableTokenSelect,
  interval,
  showUnlock,
  value,
  showCurrencySelector = true
}) {

  const [modalIsOpen, setModalIsOpen] = useState(false)

  function _renderInput() {
    if (typeof renderInput === 'function') {
      return renderInput()
    }

    return (
      <InputRow>
        <Input
          type="number"
          min="0"
          error={!!errorMessage}
          placeholder=""
          step="0.000000000000000001"
          onChange={e => onValueChange(e.target.value)}
          onKeyPress={e => {
            const charCode = e.which ? e.which : e.keyCode

            // Prevent 'minus' character
            if (charCode === 45 || charCode === 46 || charCode === 44) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
          value={value}
        />
        {showCurrencySelector ? (
          <CurrencySelect
            // selected={!!selectedTokenAddress}
            onClick={() => {
              if (!disableTokenSelect) {
                setModalIsOpen(true)
              }
            }}
          >
            <Aligner>
              {/* {selectedTokenAddress ? <TokenLogo address={selectedTokenAddress} /> : null} */}
              {
                <StyledTokenName>
                  {interval}
                  {/* {(allTokens[selectedTokenAddress] && allTokens[selectedTokenAddress].symbol) || t('selectToken')} */}
                </StyledTokenName>
              }
              {/* {!disableTokenSelect && <StyledDropDown selected={!!selectedTokenAddress} />} */}
            </Aligner>
          </CurrencySelect>
        ) : null}
      </InputRow>
    )
  }

  return (
    <InputPanel>
      <Container error={!!errorMessage}>
        <LabelRow>
          <LabelContainer>
            <span>{title}</span> <span>{description}</span>
          </LabelContainer>

          <ErrorSpan
            data-tip={'Enter max'}
            error={!!errorMessage}
            onClick={() => {
              extraTextClickHander()
            }}
          >
            <Tooltip
              label="Enter Max"
              style={{
                background: 'hsla(0, 0%, 0%, 0.75)',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                padding: '0.5em 1em',
                marginTop: '-64px'
              }}
            >
              <span>{extraText}</span>
            </Tooltip>
          </ErrorSpan>
        </LabelRow>
        {_renderInput()}
      </Container>
      {!disableTokenSelect && (
        <TimeSelectModal
          isOpen={modalIsOpen}
          // isOpen={true}
          onDismiss={() => {
            setModalIsOpen(false)
          }}
          onIntervalSelect={onIntervalSelect}
          allBalances={allBalances}
        />
      )}
    </InputPanel>
  )
}

function TimeSelectModal({ isOpen, onDismiss, onIntervalSelect, allBalances }) {
  const { t } = useTranslation()

  const [searchQuery, setSearchQuery] = useState('')
  const { name } = useTokenDetails(searchQuery)

  const allTokens = useAllTokenDetails()

  // BigNumber.js instance
  const ethPrice = useUSDPrice()

  const _usdAmounts = Object.keys(allTokens).map(k => {
    if (
      ethPrice &&
      allBalances &&
      allBalances[k] &&
      allBalances[k].ethRate &&
      !allBalances[k].ethRate.isNaN() &&
      allBalances[k].balance
    ) {
      const USDRate = ethPrice.times(allBalances[k].ethRate)
      const balanceBigNumber = new BigNumber(allBalances[k].balance.toString())
      const usdBalance = balanceBigNumber.times(USDRate).div(new BigNumber(10).pow(allTokens[k].decimals))
      return usdBalance
    } else {
      return null
    }
  })
  const usdAmounts =
    _usdAmounts &&
    Object.keys(allTokens).reduce(
      (accumulator, currentValue, i) => Object.assign({ [currentValue]: _usdAmounts[i] }, accumulator),
      {}
    )

  const tokenList = useMemo(() => {
    return Object.keys(allTokens)
      .filter(k => allTokens[k].symbol)
      .sort((a, b) => {
        const aSymbol = allTokens[a].symbol.toLowerCase()
        const bSymbol = allTokens[b].symbol.toLowerCase()

        if (aSymbol === 'ETH'.toLowerCase() || bSymbol === 'ETH'.toLowerCase()) {
          return aSymbol === bSymbol ? 0 : aSymbol === 'ETH'.toLowerCase() ? -1 : 1
        }

        if (aSymbol === 'WETH'.toLowerCase() || bSymbol === 'WETH'.toLowerCase()) {
          return aSymbol === bSymbol ? 0 : aSymbol === 'WETH'.toLowerCase() ? -1 : 1
        }

        if (allBalances) {
          const aBalance = allBalances[a] ? allBalances[a].balance : null
          const bBalance = allBalances[b] ? allBalances[b].balance : null

          if (aBalance && !bBalance) {
            return -1
          } else if (!aBalance && bBalance) {
            return 1
          }

          if (aBalance && aBalance) {
            if (aBalance.gt(bBalance)) {
              return -1
            } else {
              return 1
            }
          }
        }

        return aSymbol < bSymbol ? -1 : aSymbol > bSymbol ? 1 : 0
      })
      .map(k => {
        let balance
        let usdBalance
        // only update if we have data
        if (k === 'ETH' && allBalances && allBalances[k]) {
          balance = formatEthBalance(allBalances[k].balance)
          usdBalance = usdAmounts[k]
        } else if (allBalances && allBalances[k]) {
          balance = formatTokenBalance(allBalances[k].balance, allTokens[k].decimals)
          usdBalance = usdAmounts[k]
        }
        return {
          name: allTokens[k].name,
          symbol: allTokens[k].symbol,
          address: k,
          balance: balance,
          usdBalance: usdBalance
        }
      })
  }, [allBalances, allTokens, usdAmounts])

  const filteredTokenList = useMemo(() => {
    return tokenList.filter(tokenEntry => {
      // check the regex for each field
      const regexMatches = Object.keys(tokenEntry).map(tokenEntryKey => {
        return (
          typeof tokenEntry[tokenEntryKey] === 'string' &&
          !!tokenEntry[tokenEntryKey].match(new RegExp(escapeStringRegex(searchQuery), 'i'))
        )
      })

      return regexMatches.some(m => m)
    })
  }, [tokenList, searchQuery])

  function _onTokenSelect(interval) {
    setSearchQuery('')
    onIntervalSelect(interval)
    onDismiss()
  }

  function renderIntervalList() {
    if (!ALL_INTERVALS.length) {
      return <TokenModalInfo>{t('noExchange')}</TokenModalInfo>
    }

    return ALL_INTERVALS.map((interval => {
      return (
        <TokenModalRow key={interval} onClick={() => _onTokenSelect(interval)}>
          <TokenRowLeft>
            <TimeClock/>
            <TokenSymbolGroup>
              <span id="symbol">{interval}</span>
              <TokenFullName>{interval}</TokenFullName>
            </TokenSymbolGroup>
          </TokenRowLeft>
          {/* <TokenRowRight>
            {balance ? (
              <TokenRowBalance>{balance && (balance > 0 || balance === '<0.0001') ? balance : '-'}</TokenRowBalance>
            ) : (
              <SpinnerWrapper src={Circle} alt="loader" />
            )}
            <TokenRowUsd>
              {usdBalance ? (usdBalance.lt(0.01) ? '<$0.01' : '$' + formatToUsd(usdBalance)) : ''}
            </TokenRowUsd>
          </TokenRowRight> */}
        </TokenModalRow>
      )
    }))
  }

  // manage focus on modal show
  const inputRef = useRef()

  function onInput(event) {
    const input = event.target.value
    const checksummedInput = isAddress(input)
    setSearchQuery(checksummedInput || input)
  }

  function clearInputAndDismiss() {
    setSearchQuery('')
    onDismiss()
  }

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={clearInputAndDismiss}
      minHeight={60}
      // initialFocusRef={isMobile ? undefined : inputRef}
    >
      <TokenModal>
        <ModalHeader>
          <p>Select Time Interval</p>
          <CloseIcon onClick={clearInputAndDismiss}>
            <CloseColor alt={'close icon'} />
          </CloseIcon>
        </ModalHeader>
        <SearchContainer>
          {/* <img src={SearchIcon} alt="search" />
          <StyledBorderlessInput
            ref={inputRef}
            type="text"
            placeholder={isMobile ? t('searchOrPasteMobile') : t('searchOrPaste')}
            onChange={onInput}
          /> */}
        </SearchContainer>
        <TokenList>{renderIntervalList()}</TokenList>
      </TokenModal>
    </Modal>
  )
}

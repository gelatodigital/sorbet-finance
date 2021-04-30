import React from 'react'
import styled from 'styled-components'
import { AutoColumn } from '../Column'
import { CardSection, DataCard } from '../earn/styled'
import { StyledTokenName } from '../CurrencyInputPanel'
import ArrowRight from '../../assets/svg/SVGArrowRight'
import Modal from '../Modal'
import TokenLogo from '../TokenLogo'
import { useTranslation } from 'react-i18next'
import { useAllTokenDetails } from '../../contexts/Tokens'
import { Button } from '../../theme'
import { amountFormatter } from '../../utils/index'

const ContentWrapper = styled(AutoColumn)`
  width: 100%;
`
const CustomTokenLogo = styled(TokenLogo)`
  justify-self: center;
  align-self: center;
  border-radius: 0rem;
`

const ModalUpper = styled(DataCard)`
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
  padding: 0.5rem;
`

const TBlack = styled.div`
  font-size: 48;
  font-weight: 600;
  color: black;
`

const ContainerCurrency = styled.div`
  padding: 2em;
  display: inline-grid;
  grid-template-columns: 10fr 20fr 10fr 20fr 10fr;
`

const Container = styled.div`
  padding: 1em;
  display: inline-grid;
  grid-template-columns: 40fr 5fr 10fr 5fr 40fr;
`

const Label = styled.div`
  grid-column-start: 0;
  grid-column-end: 1;
`

const LeftContainer = styled.div`
  display: grid;
  grid-auto-rows: auto;
  grid-column-start: 1;
  grid-column-end: 2;
  justify-items: center;
`
const LeftPriceContainer = styled.div`
  display: grid;
  grid-auto-rows: auto;
  grid-column-start: 2;
  grid-column-end: 3;
  justify-items: center;
`

const MiddleContainer = styled.div`
  display: grid;
  grid-column-start: 3;
  grid-column-end: 4;
  justify-items: center;
`

const RightPriceContainer = styled.div`
  display: grid;
  grid-auto-rows: auto;
  grid-column-start: 4;
  grid-column-end: 5;
  justify-items: center;
`

const RightContainer = styled.div`
  display: grid;
  grid-auto-rows: auto;
  grid-column-start: 5;
  grid-column-end: 6;
  justify-items: center;
`

const WarningMsg = styled.div`
  font-size: small;
  color: #f92500;
`
const SmallText = styled.div`
  margin-top: -25px;
  font-size: small;
`

const Flex = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem;

  button {
    max-width: 20rem;
  }
`
const DivToken = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
`

export default function OrderDetailModal({
  isOpen,
  inputCurrency,
  inputValueFormatted,
  outputCurrency,
  outputValueFormatted,
  rateFormatted,
  executionRate,
  adviceRate,
  warning,
  onPlaceComfirmed,
  onDismiss
}) {
  const allTokens = useAllTokenDetails()
  const { t } = useTranslation()

  inputValueFormatted = inputValueFormatted ?? amountFormatter(inputValueFormatted)
  outputValueFormatted = outputValueFormatted ?? amountFormatter(outputValueFormatted)

  function feesRounding(executionRate, rateFormatted) {
    return Math.round((Math.abs(executionRate - rateFormatted) / rateFormatted) * 1000000) / 10000
  }

  return (
    <>
      <Modal isOpen={isOpen} onDismiss={onDismiss} maxHeight={'inherit'}>
        <ContentWrapper>
          <ModalUpper>
            <CardSection>
              <AutoColumn justify="center">
                <TBlack color="black">Limit Order Summary</TBlack>
              </AutoColumn>
            </CardSection>
          </ModalUpper>
          <ContainerCurrency>
            <LeftContainer>
              <DivToken>
                <CustomTokenLogo address={inputCurrency} />
                <StyledTokenName>{allTokens[inputCurrency] && allTokens[inputCurrency].symbol}</StyledTokenName>
              </DivToken>
            </LeftContainer>
            <LeftPriceContainer>{inputValueFormatted}</LeftPriceContainer>
            <MiddleContainer>
              <ArrowRight />
            </MiddleContainer>
            <RightPriceContainer>{outputValueFormatted}</RightPriceContainer>
            <RightContainer>
              <DivToken>
                <StyledTokenName>{allTokens[outputCurrency] && allTokens[outputCurrency].symbol}</StyledTokenName>
                <CustomTokenLogo address={outputCurrency} />
              </DivToken>
            </RightContainer>
          </ContainerCurrency>
          <Container>
            <LeftContainer>Desired Rate</LeftContainer>
            <MiddleContainer></MiddleContainer>
            <RightContainer>{rateFormatted}</RightContainer>
          </Container>
          {warning ? (
            <>
              <Container>
                <LeftContainer className="slippage-warning">Actual Rate</LeftContainer>
                <MiddleContainer></MiddleContainer>
                <RightContainer className="slippage-warning">{executionRate}</RightContainer>
              </Container>
            </>
          ) : (
            <Container>
              <LeftContainer className="market-delta-info">Actual Rate</LeftContainer>
              <MiddleContainer></MiddleContainer>
              <RightContainer className="market-delta-info">{executionRate}</RightContainer>
            </Container>
          )}
          <Container>
            <LeftContainer>
              <SmallText>Extra slippage due to gas fees</SmallText>
            </LeftContainer>
            <MiddleContainer></MiddleContainer>
            <RightContainer>
              <SmallText>{feesRounding(executionRate, rateFormatted)}%</SmallText>
            </RightContainer>
          </Container>
          <Flex>
            <Button warning={warning} onClick={() => onPlaceComfirmed()}>
              {warning ? t('placeAnyway') : t('place')}
            </Button>
          </Flex>
          {warning ? (
            <AutoColumn justify="center">
              <WarningMsg>
                Order very small! Minimum recommended sell amount ~ {adviceRate}{' '}
                {allTokens[inputCurrency] && allTokens[inputCurrency].symbol}
              </WarningMsg>
            </AutoColumn>
          ) : (
            ''
          )}
          <br />
        </ContentWrapper>
      </Modal>
    </>
  )
}

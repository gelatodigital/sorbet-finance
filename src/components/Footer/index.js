import React from 'react'
import styled from 'styled-components'
import { darken } from 'polished'

import { Link } from '../../theme'
import SVGDiscord from '../../assets/svg/SVGDiscord'
import SVGTelegram from '../../assets/svg/SVGTelegram'

const FooterFrame = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`

const FooterElement = styled.div`
  margin: 1.25rem;
  display: flex;
  min-width: 0;
  display: flex;
  align-items: center;
`

const Title = styled.div`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.uniswapPink};

  :hover {
    cursor: pointer;
  }
  #link {
    text-decoration-color: ${({ theme }) => theme.uniswapPink};
  }

  #title {
    display: inline;
    font-size: 0.825rem;
    margin-right: 12px;
    font-weight: 400;
    color: ${({ theme }) => theme.uniswapPink};
    :hover {
      color: ${({ theme }) => darken(0.2, theme.uniswapPink)};
    }
  }
`

const DiscordImg = styled.div`
  height: 18px;

  svg {
    fill: ${({ theme }) => theme.uniswapPink};
    height: 28px;
  }
`

const TelegramImg = styled.div`
  height: 18px;
  margin-left: 5px;
  svg {
    fill: ${({ theme }) => theme.uniswapPink};
    height: 22px;
  }
`

export default function Footer() {
  return (
    <FooterFrame>
      <FooterElement>
        <Title>
          <Link
            id="link"
            rel="noopener noreferrer"
            target="_blank"
            href="https://medium.com/@pine_eth/pine-finance-an-amm-orders-engine-525fe1f1b1eb"
          >
            <h1 id="title">About</h1>
          </Link>
          <Link id="link" rel="noopener noreferrer" target="_blank" href="https://github.com/gelatodigital/limit-orders-ui">
            <h1 id="title">Code</h1>
          </Link>
          <Link id="link" rel="noopener noreferrer" target="_blank" href="https://etherscan.io/address/0x36049d479a97cde1fc6e2a5d2cae30b666ebf92b">
            <h1 id="title">Contract</h1>
          </Link>
          <Link id="link" rel="noopener noreferrer" target="_blank" href="https://t.me/therealgelatonetwork">
            <TelegramImg>
              <SVGTelegram />
            </TelegramImg>
          </Link>
        </Title>
      </FooterElement>
    </FooterFrame>
  )
}

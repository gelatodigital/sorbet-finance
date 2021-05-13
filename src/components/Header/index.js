import { darken } from 'polished'
import React from 'react'
import styled from 'styled-components'
import Web3Status from '../Web3Status'
import Web3Network from '../Web3Network'

const HeaderFrame = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`

const HeaderElement = styled.div`
  margin: 1.25rem;
  display: flex;
  min-width: 0;
  display: flex;
  align-items: center;
`

const Nod = styled.span`
  transform: rotate(0deg);
  transition: transform 150ms ease-out;

  :hover {
    transform: rotate(-10deg);
  }
`

const Title = styled.div`
  display: flex;
  align-items: center; 
  margin-bottom: 0.25px

  :hover {
    cursor: pointer;
  }

  #link {
    text-decoration-color: ${({ theme }) => theme.UniswapPink};
  }

  #title {
   
    display: inline;
    font-size: 1.2rem;
    font-weight: 500;
    color: ${({ theme }) => theme.wisteriaPurple};
    :hover {
      color: ${({ theme }) => darken(0.1, theme.wisteriaPurple)};
    }
  }
`
export default function Header() {
  return (
    <HeaderFrame>
      <HeaderElement>
        <Title>
          {/* <Link id="link" href="https://limit-orders-ui.vercel.app/order"> */}
          <h1 id="title">{'🍧'}Sorbet Finance</h1>
          {/* </Link> */}
        </Title>
      </HeaderElement>
      <HeaderElement>
        <Web3Network />
      </HeaderElement>
      <HeaderElement>
        <Web3Status />
      </HeaderElement>
    </HeaderFrame>
  )
}

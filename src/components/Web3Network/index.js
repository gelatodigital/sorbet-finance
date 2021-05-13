import React, { useState } from 'react'
import { useWeb3React } from '@web3-react/core'
import styled from 'styled-components'
import { darken, lighten } from 'polished'
import { NETWORK_LABEL } from '../../constants/networks'
import NetworkModal from '../NetworkModal'
import { ButtonSecondary } from '../Button'
import TokenLogo from '../TokenLogo'
import { NATIVE_TOKEN_TICKER } from '../../constants/networks'

const Web3StatusGeneric = styled(ButtonSecondary)`
  ${({ theme }) => theme.flexRowNoWrap}
  width: 100%;
  align-items: center;
  padding: 0.5rem;
  border-radius: 12px;
  cursor: pointer;
  user-select: none;
  :focus {
    outline: none;
  }
`

const Web3StatusConnected = styled(Web3StatusGeneric)`
  background-color: ${({ pending, theme }) => (pending ? theme.primary1 : theme.bg2)};
  border: 1px solid ${({ pending, theme }) => (pending ? theme.primary1 : theme.bg3)};
  color: ${({ pending, theme }) => (pending ? theme.white : theme.text1)};
  font-weight: 500;
  :hover,
  :focus {
    background-color: ${({ pending, theme }) => (pending ? darken(0.05, theme.primary1) : lighten(0.05, theme.bg2))};

    :focus {
      border: 1px solid ${({ pending, theme }) => (pending ? darken(0.1, theme.primary1) : darken(0.1, theme.bg3))};
    }
  }
`

const Text = styled.p`
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0 0.5rem 0 0.25rem;
  font-size: 1rem;
  width: fit-content;
  font-weight: 500;
`

const IconWrapper = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap};
  align-items: center;
  justify-content: center;
  & > * {
    height: ${({ size }) => (size ? size + 'px' : '32px')};
    width: ${({ size }) => (size ? size + 'px' : '32px')};
  }
`

function Web3Network() {
  const { chainId } = useWeb3React()

  const [showNetworkModal, setToggleNetworkModal] = useState(false)

  function toggleNetworkModal() {
    setToggleNetworkModal(!showNetworkModal)
  }

  if (!chainId) return null

  function getNetwork() {
    if (chainId) {
      return (
        <Web3StatusConnected id="web3-status-connected" onClick={toggleNetworkModal}>
          <>
            <IconWrapper size={16}>
              <TokenLogo address={NATIVE_TOKEN_TICKER[chainId]} />
            </IconWrapper>
            <Text>{NETWORK_LABEL[chainId]}</Text>
          </>
        </Web3StatusConnected>
      )
    }
  }

  return (
    <>
      {getNetwork()}
      <NetworkModal isOpen={showNetworkModal} toggleNetworkModal={toggleNetworkModal} />
    </>
  )
}

export default Web3Network

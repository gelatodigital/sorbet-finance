import React from 'react'
import styled from 'styled-components'
import { useActiveWeb3React } from '../../hooks'
import { ButtonSecondary, ButtonOutlined } from '../Button'
import { ReactComponent as Close } from '../../assets/images/x.svg'
import { NETWORK_LABEL, ChainId } from '../../constants/networks'
import Modal from '../Modal'
import TokenLogo from '../TokenLogo'
import { NATIVE_TOKEN_TICKER } from '../../constants/networks'

const PARAMS = {
  [ChainId.MAINNET]: {
    chainId: '0x1',
    chainName: 'Ethereum',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.infura.io/v3'],
    blockExplorerUrls: ['https://etherscan.io'],
  },
  [ChainId.ROPSTEN]: {
    chainId: '0x3',
    chainName: 'Ropsten',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://ropsten.infura.io/v3'],
    blockExplorerUrls: ['https://ropsten.etherscan.io'],
  },
  [ChainId.MATIC]: {
    chainId: '0x89',
    chainName: 'Matic',
    nativeCurrency: {
      name: 'Matic',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrls: ['https://rpc-mainnet.maticvigil.com'], //['https://matic-mainnet.chainstacklabs.com/'],
    blockExplorerUrls: ['https://explorer-mainnet.maticvigil.com'],
  },
}

const CloseIcon = styled.div`
  position: absolute;
  right: 1rem;
  top: 14px;
  &:hover {
    cursor: pointer;
    opacity: 0.6;
  }
`

const CloseColor = styled(Close)`
  path {
    stroke: ${({ theme }) => theme.text4};
  }
`

const Wrapper = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap}
  margin: 0;
  padding: 0;
  width: 100%;
`

const Blurb = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 2rem;
  ${({ theme }) => theme.mediaWidth.upToMedium`
    margin: 1rem;
    font-size: 12px;
  `};
`

const ContentWrapper = styled.div`
  background-color: ${({ theme }) => theme.bg2};
  padding: 2rem;
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;

  ${({ theme }) => theme.mediaWidth.upToMedium`padding: 1rem`};
`

const UpperSection = styled.div`
  position: relative;

  h5 {
    margin: 0;
    margin-bottom: 0.5rem;
    font-size: 1rem;
    font-weight: 400;
  }

  h5:last-child {
    margin-bottom: 0px;
  }

  h4 {
    margin-top: 0;
    font-weight: 500;
  }
`

const Text = styled.p`
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
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

export default function NetworkModal({ toggleNetworkModal, isOpen }) {
  const { chainId, library, account } = useActiveWeb3React()

  if (!chainId) return null

  const getModalContent = () => {
    return (
      <UpperSection>
        <CloseIcon onClick={toggleNetworkModal}>
          <CloseColor />
        </CloseIcon>

        <ContentWrapper>
          {Object.values(ChainId).map((key, i) => {
            if (chainId === key) {
              return (
                <div key={i}>
                  {i === 0 ? <br></br> : <></>}
                  <ButtonSecondary>
                    <IconWrapper size={26}>
                      <TokenLogo address={NATIVE_TOKEN_TICKER[key]} />
                    </IconWrapper>
                    <Text>{NETWORK_LABEL[key]}</Text>
                  </ButtonSecondary>
                  <br></br>
                </div>
              )
            }
            return (
              <div key={i}>
                {i === 0 ? <br></br> : <></>}
                <ButtonOutlined
                  onClick={() => {
                    toggleNetworkModal()
                    const params = PARAMS[key]
                    library.send('wallet_addEthereumChain', [params, account])
                  }}
                >
                  <IconWrapper size={26}>
                    <TokenLogo address={NATIVE_TOKEN_TICKER[key]} />
                  </IconWrapper>
                  <Text>{NETWORK_LABEL[key]}</Text>
                </ButtonOutlined>
                <br></br>
              </div>
            )
          })}
          <br></br>
          <Text>To switch networks please switch manually via MetaMask.</Text>
        </ContentWrapper>
      </UpperSection>
    )
  }

  return (
    <Modal isOpen={isOpen} onDismiss={toggleNetworkModal} minHeight={null} maxHeight={90}>
      <Wrapper>{getModalContent()}</Wrapper>
    </Modal>
  )
}

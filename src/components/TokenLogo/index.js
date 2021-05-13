import React, { useState } from 'react'
import styled from 'styled-components'
import { isAddress } from '../../utils'
import { useAllTokenDetails } from '../../contexts/Tokens'
import { useWeb3React } from '@web3-react/core'
import { ReactComponent as EthereumLogo } from '../../assets/images/ethereum-logo.svg'
import { NATIVE_TOKEN_TICKER } from '../../constants/networks'

const TOKEN_ICON_API = (address) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${isAddress(
    address
  )}/logo.png`
const BAD_IMAGES = {}

const Image = styled.img`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  background-color: white;
  border-radius: 1rem;
`

const Emoji = styled.span`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
`

const StyledEthereumLogo = styled(EthereumLogo)`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
`

export default function TokenLogo({ address, size = '1rem', ...rest }) {
  const [error, setError] = useState(false)

  const { chainId } = useWeb3React()
  const allTokens = useAllTokenDetails()

  const logoURI = address ? allTokens[address]?.logoURI : undefined

  let path = ''
  if (address === 'ETH') {
    return <StyledEthereumLogo size={size} />
  } else if (address === 'MATIC') {
    path =
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0/logo.png'
  } else if (!error && !BAD_IMAGES[address]) {
    if (NATIVE_TOKEN_TICKER[chainId] === 'ETH') path = TOKEN_ICON_API(address.toLowerCase())
    else path = logoURI
  } else {
    return (
      <Emoji {...rest} size={size}>
        <span style={{ lineHeight: 0 }} role="img" aria-label="Thinking">
          🌕
        </span>
      </Emoji>
    )
  }

  return (
    <Image
      {...rest}
      alt={address}
      src={path}
      size={size}
      onError={() => {
        BAD_IMAGES[address] = true
        setError(true)
      }}
    />
  )
}

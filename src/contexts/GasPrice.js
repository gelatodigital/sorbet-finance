import { ethers } from 'ethers'
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as ls from 'local-storage'
import { useBlockNumber } from './Application'
import { ChainId } from '../constants/networks'

const GasContext = createContext()

function useGasContext() {
  return useContext(GasContext)
}

export const GAS_STATION = {
  [ChainId.MAINNET]: "https://www.gasnow.org/api/v3/gas/price?utm_source=sorbet-finance",
  [ChainId.ROPSTEN]: undefined,
  [ChainId.MATIC]: 'https://gasstation-mainnet.matic.network',
}


export const ADD_BUFFER = {
  [ChainId.MAINNET]: true,
  [ChainId.ROPSTEN]: false,
  [ChainId.MATIC]: false,
}

export const parseGasPrice = (data, chainId) => {
    const buffer = ADD_BUFFER[chainId] ? ethers.utils.parseUnits("5", "gwei") : ethers.utils.parseUnits("0", "gwei")
    const gasPriceWithBuffer = data.fast ? ethers.utils.parseUnits(data.fast.toString(), "gwei") : ethers.BigNumber.from(data.data.fast).add(buffer)
    return gasPriceWithBuffer
}


export default function Provider({ children }) {
  const [gasPrice, setGasPrice] = useState()

  const globalBlockNumber = useBlockNumber()

  const chainId = ls.get("chainId")

  useEffect(() => {
    GAS_STATION[chainId] ? fetch(GAS_STATION[chainId]).then((res) => {
      res.json().then(gasInfo => {
        try {
          setGasPrice(parseGasPrice(gasInfo, chainId))
        } catch {}

      })
    }):       setGasPrice(ethers.utils.parseUnits("5", "gwei"))
  }, [globalBlockNumber, chainId])

  return (
    <GasContext.Provider value={useMemo(() => [gasPrice, { setGasPrice }], [gasPrice, setGasPrice])}>
      {children}
    </GasContext.Provider>
  )
}

export function useGasPrice() {
  const [gasPrice] = useGasContext()
  return gasPrice
}

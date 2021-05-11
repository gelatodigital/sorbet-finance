import { getAllOpenOrders } from '@gelatonetwork/limit-orders-lib'
import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import * as ls from 'local-storage'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import Circle from '../../assets/images/circle.svg'
import { ETH_ADDRESS } from '../../constants'
import { useAllPendingCancelOrders, useAllPendingOrders } from '../../contexts/Transactions'
import { useMulticallContract, useUniswapExContract } from '../../hooks'
import { Spinner } from '../../theme'
import { isAddress } from '../../utils'
import { OrderCard } from '../OrderCard'
import { OrdersHistory } from '../OrdersHistory'

const SpinnerWrapper = styled(Spinner)`
  margin: 0 0.25rem 0 0.25rem;
`

// ///
// Local storage
// ///
const LS_ORDERS = 'orders_'

function lsKey(key, account, chainId) {
  return key + account.toString() + chainId
}

function getSavedOrders(account, chainId) {
  if (!account) return []

  console.log('Loading saved orders from storage location', account, lsKey(LS_ORDERS, account, chainId))
  const raw = ls.get(lsKey(LS_ORDERS, account, chainId))
  return raw == null ? [] : raw
}

async function fetchUserOrders(account, chainId) {
  try {
    const openOrders = await getAllOpenOrders(account, chainId)
    return {
      allOrders: [],
      openOrders,
    }
  } catch (e) {
    console.log("ERROR", e)
    console.warn('Error loading orders from TheGraph', e)
    return {
      allOrders: [],
      openOrders: []
    }
  }
}

function useGraphOrders(account, chainId) {
  const [state, setState] = useState({ openOrders: [], allOrders: [] })

  useEffect(() => {
    console.log(`Requesting load orders from the graph`)
    if (account && isAddress(account)) {
      fetchUserOrders(account, chainId).then(orders => {
        // console.log(`Fetched ${orders.allOrders.length} ${orders.openOrders.length} orders from the graph`)
        setState(orders)
      })
    }
  }, [account, chainId])

  return state
}

function isEthOrder(order) {
  return order.inputToken.toLowerCase() === ETH_ADDRESS.toLowerCase()
}

function keyOfOrder(order) {
  const moduleData = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [order.outputToken, order.minReturn])

  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'address', 'address', 'bytes'],
      [order.module, order.inputToken, order.owner, order.witness, moduleData]
    )
  )
}

function vaultForOrder(order, uniswapEXContract) {
  const VAULT_CODE_HASH = '0xfa3da1081bc86587310fce8f3a5309785fc567b9b20875900cb289302d6bfa97'
  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', uniswapEXContract.address, keyOfOrder(order), VAULT_CODE_HASH]
    )
  )

  return `0x${hash.slice(-40)}`
}

async function balancesOfOrders(orders, uniswapEXContract, multicallContract) {
  const result = await multicallContract.aggregate(
    orders.map(o => {
      if (!isEthOrder(o)) {
        return [
          o.inputToken,
          `0x70a08231${ethers.utils.defaultAbiCoder // balanceOf(address)
            .encode(['address'], [vaultForOrder(o, uniswapEXContract)])
            .replace('0x', '')}`
        ]
      } else {
        return [uniswapEXContract.address, `0xebd9c39c${keyOfOrder(o).replace('0x', '')}`] // ethDeposits(bytes32)
      }
    })
  )

  return result.returnData
}

function useSavedOrders(account, chainId, uniswapEXContract, multicallContract, deps = []) {
  const [state, setState] = useState({ allOrders: [], openOrders: [] })

  useEffect(() => {
    console.log(`Requesting load orders from storage`)
    if (isAddress(account)) {
      const allOrders = getSavedOrders(account, chainId)
      console.log(`Loaded ${allOrders.length} orders from local storage`)
      if (allOrders.length > 0) {
        balancesOfOrders(allOrders, uniswapEXContract, multicallContract).then(amounts => {
          allOrders.map((o, i) => (o.inputAmount = ethers.BigNumber.from(amounts[i]).toString()))
          setState({
            allOrders: allOrders,
            openOrders: allOrders.filter(o => o.inputAmount !== '0')
          })
        })
      }
    }
    // eslint-disable-next-line
  }, [...deps, account, chainId, uniswapEXContract])

  return state
}

export default function Orders() {
  const { t } = useTranslation()
  const { account, chainId } = useWeb3React()
  const uniswapEXContract = useUniswapExContract()
  const multicallContract = useMulticallContract()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(!account)
  }, [account])

  const pendingOrders = useAllPendingOrders()
  const pendingCancelOrders = useAllPendingCancelOrders()

  // Get locally saved orders and the graph orders
  const local = useSavedOrders(account, chainId, uniswapEXContract, multicallContract, [
    pendingOrders.length,
    pendingCancelOrders.length
  ])
  const graph = useGraphOrders(account, chainId)

  // Define orders to show as openOrders + pending orders
  useEffect(() => {
    // Aggregate graph and local orders, local orders have priority
    const allOrders = local.allOrders.concat(
      graph.allOrders.filter(o => !local.allOrders.find(c => c.secret === o.secret))
    )
    const openOrders = local.openOrders.concat(
      graph.openOrders.filter(o => !local.allOrders.find(c => c.secret === o.secret))
    )

    setOrders(openOrders.concat(allOrders.filter(o => pendingOrders.find(p => p.secret === o.secret))))

    // eslint-disable-next-line
  }, [
    local.allOrders.length,
    local.openOrders.length,
    graph.allOrders.length,
    graph.openOrders.length,
    pendingOrders.length
  ])

  return (
    <>
      {account && (
        <>
          <>
            <p className="orders-title">{`${t('Orders')} ${orders.length > 0 ? `(${orders.length})` : ''}`}</p>
            {loading && (
              <>
                <SpinnerWrapper src={Circle} alt="loader" /> Loading ...
                <br />
                <br />
              </>
            )}
            {orders.length === 0 && !loading && <p>{t('noOpenOrders')}</p>}
            {
              <div>
                {orders.map(order => (
                  <OrderCard key={order.witness} data={order} />
                ))}
              </div>
            }
          </>
          <OrdersHistory />
        </>
      )}
    </>
  )
}

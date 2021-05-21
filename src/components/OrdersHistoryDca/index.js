import { getAllPastOrders } from '@gelatonetwork/dca-sdk'
import { useWeb3React } from '@web3-react/core'
import React, { useEffect, useState } from 'react'
import { isAddress } from '../../utils'
import { PastOrderCardDca } from '../PastOrderCardDca'

export function OrdersHistoryDca() {
  const { account, chainId } = useWeb3React()
  const orders = usePastOrders(account, chainId)
  return orders.length > 0 ? (
    <>
      <p style={{ marginTop: '40px', fontSize: '24px' }}>History</p>
      {orders.map((order) => (
        <PastOrderCardDca key={order.id} data={order} />
      ))}
    </>
  ) : null
}

function usePastOrders(account, chainId) {
  const [state, setState] = useState([])

  const fetchOrdersAndSetState = () => {
    if (account && isAddress(account)) {
      fetchUserPastDcaOrders(account, chainId).then((orders) => {
        if (orders) console.log(`Fetched ${orders.length} past orders from the graph`)
        setState(orders)
      })
    }
  }

  useEffect(() => {
    fetchOrdersAndSetState()
  }, [account, chainId])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrdersAndSetState()
    }, 20000)
    return () => clearInterval(interval)
  }, [])

  return state
}

export async function fetchUserPastDcaOrders(account, chainId) {
  try {
    const trades = await getAllPastOrders(account, chainId)
    return trades
  } catch (e) {
    console.warn('Error loading orders from TheGraph', e)
    return []
  }
}

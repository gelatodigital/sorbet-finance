import { getAllPastOrders } from '@gelatonetwork/limit-orders-lib'
import { useWeb3React } from '@web3-react/core'
import React, { useEffect, useState } from 'react'
import { isAddress } from '../../utils'
import { PastOrderCard } from '../PastOrderCard'


export function OrdersHistory() {
  const { account, chainId } = useWeb3React()
  const orders = usePastOrders(account, chainId)
  return orders.length > 0 ? (
    <>
      <p style={{ marginTop: '40px', fontSize: '24px' }}>History</p>
      {orders.map(order => (
        <PastOrderCard key={order.id} data={order} />
      ))}
    </>
  ) : null
}

function usePastOrders(account, chainId) {
  const [state, setState] = useState([])

  useEffect(() => {
    if (account && isAddress(account)) {
      fetchUserPastOrders(account, chainId).then(orders => {
        setState(orders)
      })
    }
  }, [account, chainId])

  return state
}

async function fetchUserPastOrders(account, chainId) {
  try {
    const pastOrders = await getAllPastOrders(account, chainId)
    return pastOrders
  } catch (e) {
    console.warn('Error loading orders from TheGraph', e)
    return []
  }
}

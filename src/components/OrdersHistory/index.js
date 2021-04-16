import React, { useState, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'

import { PastOrderCard } from '../PastOrderCard'
import { isAddress } from '../../utils'
import { ORDER_GRAPH } from '../../constants'
import { getAllOrders } from '@gelatonetwork/limit-orders-lib'

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
    const noOpenOrders = [];
    (await getAllOrders(account, chainId)).forEach(element => {
      if (element.status === 'executed' || element.status === 'cancelled') noOpenOrders.push(element)
    })
    return noOpenOrders
  } catch (e) {
    console.warn('Error loading orders from TheGraph', e)
    return []
  }
}

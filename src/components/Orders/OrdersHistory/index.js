import { useWeb3React } from '@web3-react/core'
import React, { useEffect, useState } from 'react'
import { ORDER_GRAPH } from '../../constants'
import { isAddress } from '../../utils'
import { PastOrderCard } from '../PastOrderCard'


export function OrdersHistory() {
  const { account, chainId } = useWeb3React()
  const orders = usePastOrders(account, chainId)
  return orders.length > 0 ? (
    <>
      <p style={{ marginTop: '40px', fontSize: '24px' }}>History</p>
      {orders.map((order) => (
        <PastOrderCard key={order.id} data={order} />
      ))}
    </>
  ) : null
}

function usePastOrders(account, chainId) {
  const [state, setState] = useState([])

  useEffect(() => {
    if (account && isAddress(account)) {
      fetchUserPastOrders(account, chainId).then((orders) => {
        setState(orders)
      })
    }
  }, [account, chainId])

  useEffect(() => {
    const interval = setInterval(() => {
      if (account && isAddress(account)) {
        fetchUserPastOrders(account, chainId).then((orders) => {
          setState(orders)
        })
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  return state
}

async function fetchUserPastOrders(account, chainId) {
  const query = `
  query GetOrdersByOwner($owner: String) {
    orders(where:{owner:$owner,status_not:open}) {
      id
      inputToken
      outputToken
      inputAmount
      minReturn
      bought
      status
      cancelledTxHash
      executedTxHash
      updatedAt
    }
  }`
  try {
    const res = await fetch(ORDER_GRAPH[chainId], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { owner: account.toLowerCase() } }),
    })

    const { data } = await res.json()
    return data.orders
  } catch (e) {
    console.warn('Error loading orders from TheGraph', e)
    return []
  }
}

import { getAllOrders } from '@gelatonetwork/dca-sdk'
import { useWeb3React } from '@web3-react/core'
import * as ls from 'local-storage'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import Circle from '../../assets/images/circle.svg'
import { useAllPendingCancelOrders, useAllPendingOrders } from '../../contexts/Transactions'
import { Spinner } from '../../theme'
import { isAddress } from '../../utils'
import { OrderCardDca } from '../OrderCardDca'
import { OrdersHistoryDca } from '../OrdersHistoryDca'

const SpinnerWrapper = styled(Spinner)`
  margin: 0 0.25rem 0 0.25rem;
`

// ///
// Local storage
// ///
const LS_DCA_ORDERS = 'dca_orders_'

function lsKey(key, account, chainId) {
  return key + account.toString() + chainId
}

function getSavedOrders(account, chainId) {
  if (!account) return []

  console.log('Loading saved orders from storage location', account, lsKey(LS_DCA_ORDERS, account, chainId))
  const raw = ls.get(lsKey(LS_DCA_ORDERS, account, chainId))
  return raw == null ? [] : raw
}

async function fetchUserOrders(account, chainId) {
  try {
    const trades = await getAllOrders(account.toLowerCase(), chainId)
    return {
      allOrders: trades,
      openOrders: trades.filter((trade) => trade.status === 'awaitingExec'),
    }
  } catch (e) {
    console.warn('Error loading orders from TheGraph', e)
    return {
      allOrders: [],
      openOrders: [],
    }
  }
}

function useGraphOrders(account, chainId) {
  const [state, setState] = useState({ openOrders: [], allOrders: [] })

  const fetchOrdersAndSetState = () => {
    if (account && isAddress(account)) {
      fetchUserOrders(account, chainId)
        .then((orders) => {
          // console.log(`Fetched a total of ${orders.allOrders.length} orders. ${orders.openOrders.length} of those are OPEN orders from the graph`)
          setState(orders)
        })
        .catch((error) => {
          console.log(error)
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

function useSavedOrders(account, chainId, deps = []) {
  const [state, setState] = useState({ allOrders: [], openOrders: [] })

  useEffect(() => {
    if (isAddress(account)) {
      const allOrders = getSavedOrders(account, chainId)
      console.log(`Loaded ${allOrders.length} orders from local storage`)
      if (allOrders.length > 0) {
        // balancesOfOrders(allOrders, uniswapEXContract, multicallContract).then(amounts => {
        //   allOrders.map((o, i) => (o.amount = ethers.BigNumber.from(amounts[i]).toString()))
        setState({
          allOrders: allOrders,
          openOrders: allOrders.filter((trade) => trade.status === 'awaitingExec'),
        })
        // })
      }
    }
    // eslint-disable-next-line
  }, [...deps, account, chainId])

  return state
}

export default function OrdersDca() {
  const { t } = useTranslation()
  const { account, chainId } = useWeb3React()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(!account)
  }, [account])

  const pendingOrders = useAllPendingOrders()
  const pendingCancelOrders = useAllPendingCancelOrders()

  // Get locally saved orders and the graph orders
  const local = useSavedOrders(account, chainId, [pendingOrders.length, pendingCancelOrders.length])
  const graph = useGraphOrders(account, chainId)

  // Define orders to show as openOrders + pending orders
  useEffect(() => {
    const openOrders = graph.openOrders.concat(
      local.openOrders.filter((o) => !graph.allOrders.find((c) => c.witness === o.witness))
    )
    setOrders(openOrders)

    // eslint-disable-next-line
  }, [
    local.allOrders.length,
    local.openOrders.length,
    graph.allOrders.length,
    graph.openOrders.length,
    pendingOrders.length,
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
                {orders.map((order) => (
                  <OrderCardDca key={order.witness} data={order} />
                ))}
              </div>
            }
          </>
          <OrdersHistoryDca />
        </>
      )}
    </>
  )
}

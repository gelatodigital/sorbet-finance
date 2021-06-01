import React from 'react'
import ExchangePage from '../../components/ExchangePage'
import Orders from '../../components/Orders'

export default function Swap({ initialCurrency }) {
  return (
    <>
      <ExchangePage initialCurrency={initialCurrency} />
      <Orders />
    </>
  )
}

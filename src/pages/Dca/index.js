import React from 'react'
import OrdersDca from '../../components/OrdersDca'
import TimeExchangePage from '../../components/TimeExchangePage'

export default function Dca({ initialCurrency }) {
  return (
    <>
      <TimeExchangePage initialCurrency={initialCurrency} />
      <OrdersDca />
    </>
  )
}

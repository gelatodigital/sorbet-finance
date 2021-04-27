import React from 'react'
import ExchangePage from '../../components/ExchangePage'
import Orders from '../../components/Orders'
import SurpriseModal from "../../components/Surprise/SurpriseModal"

export default function Swap({ initialCurrency }) {
  return <>
    <SurpriseModal/>
    <ExchangePage initialCurrency={initialCurrency} />
    <Orders />
  </>
}

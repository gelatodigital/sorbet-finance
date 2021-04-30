import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import Modal from '../Modal'
import { getAllExecutedOrders, getAllOrders } from '@gelatonetwork/limit-orders-lib'
import { useWeb3React } from '@web3-react/core'
import * as ls from 'local-storage'
import { Button } from '../../theme'
import GelatoMainLogo from "../../assets/svg/GelatoMainLogo.svg"
import Confetti from "react-confetti"

const Flex = styled.div`
  display: block;
  align-items: center;
  justify-content: center;
  padding: 2rem;

  Button {
      max-height: 50%;
      max-width: 80%;
      font-size: large;
      font-weight: bolder;
  }

  h3 {
      margin-top: 0;
      margin-bottom: 0;
      padding-bottom: 1rem;
  }

  h5 {
    margin-top: 0;
    margin-bottom: 0;
    padding-bottom: 1rem;
    color: #848484
  }

  p {
    margin-top: 2px;
    margin-bottom: 0;
    font-size: x-small;
    color: #848484
  }
`
const Container = styled.div`
    min-width: 100%;
    display: inherit;
    align-items: center;
    justify-content: center;
    text-align: center;
`

export default function SupriseModal() {
  const { account, chainId, active } = useWeb3React()
  const [isOpen, setIsOpen] = useState('')

  const url = process.env.REACT_APP_GIFT

  useEffect(
      () => {
        if(!isOpen) {
            getAllExecutedOrdersAsync()
        }
      }
  ,  [active, account])

  // ///
  // Local Storage
  // ///

  const LS_GIFT = 'gift_'

  async function getAllExecutedOrdersAsync() {
    const allExecOrder = await getAllExecutedOrders(account, chainId)
    setIsOpen(allExecOrder.length > 0 && !ls.get(lsKey(LS_GIFT, account, chainId)))
  }

  function lsKey(key, account, chainId) {
    return key + account.toString() + chainId
  }

  async function onGiftTaken() {
    const key = lsKey(LS_GIFT, account, chainId)
    ls.set(key, true)
  }

  async function onDismiss() {
    setIsOpen(false)
  }

  return <Modal isOpen={isOpen} onDismiss={onDismiss}>
            <Confetti>
            </Confetti>
                <Container>
                    <Flex>
                        <img width={"40%"} src={GelatoMainLogo} alt={''}></img>
                        <h3><span>{'🍦'}</span>Congratulations!!<span>{'🍦'}</span></h3>
                        <h5>You just successfully executed at least one limit order!</h5>
                        <h5>And what's cooler, you just earned yourself the opportunity to reserve a whitelist spot for the (still secret) Gelato token sale. Please keep this info to yourself 🤫</h5>
                        <a href={url}><Button onClick={() => {onGiftTaken()}}>Claim your spot now!</Button></a>
                        <p>(65 out of 100 spots have reserved)</p>
                    </Flex>
                </Container>
        </Modal>
}

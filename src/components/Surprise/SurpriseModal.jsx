import { getAllExecutedOrders } from '@gelatonetwork/limit-orders-lib'
import { useWeb3React } from '@web3-react/core'
import * as ls from 'local-storage'
import React, { useEffect, useState } from 'react'
import Confetti from 'react-confetti'
import styled from 'styled-components'
import GelatoMainLogo from '../../assets/svg/GelatoMainLogo.svg'
import { Button } from '../../theme'
import { deviceDown, deviceUp } from '../../theme/components'
import Modal from '../Modal'
import { fetchUserPastDcaOrders } from '../OrdersHistoryDca'

const CustomButton = styled(Button)`
  @media ${deviceDown.laptop} {
    font-size: 1rem;
    padding: 1rem 2rem 1rem 2rem;
    border-radius: 3rem;
  }

  @media ${deviceUp.laptop} {
    padding: 1rem 1rem 1rem 1rem !important;
    font-size: small !important;
    border-radius: 3rem;
  }
`

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

  h2 {
    margin-top: 0;
    margin-bottom: 0;
    padding-bottom: 1rem;
  }

  h5 {
    margin-top: 0;
    margin-bottom: 0;
    padding-bottom: 1rem;
    color: #848484;
  }

  p {
    margin-top: 2px;
    margin-bottom: 8px;
    font-size: x-small;
    color: #848484;
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

  useEffect(() => {
    async function getAllExecutedOrdersAsync() {
      if (chainId !== 1) return
      if (ls.get(lsKey(LS_GIFT, account, chainId))) return

      const allExecOrder = await getAllExecutedOrders(account, chainId)
      if (allExecOrder.length > 0) {
        setIsOpen(true)
        return
      }
      const allDcaPastOrders = await fetchUserPastDcaOrders()
      if (allDcaPastOrders.length > 0) {
        setIsOpen(true)
        return
      }
    }

    if (!isOpen) {
      getAllExecutedOrdersAsync()
    }
  }, [active, account, chainId])

  // ///
  // Local Storage
  // ///

  const LS_GIFT = 'gift_'

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

  return (
    <Modal isOpen={isOpen} onDismiss={onDismiss}>
      <Confetti></Confetti>
      <Container>
        <Flex>
          <img width={'40%'} src={GelatoMainLogo} alt={''}></img>
          <h2>
            <span>{'🍦'}</span>Congratulations<span>{'🍦'}</span>
          </h2>
          <h5>You successfully executed a limit order on Sorbet.</h5>
          <h5>
            This means you just earned yourself the opportunity to reserve a whitelist spot for the (still secret)
            Gelato Token Sale.
          </h5>
          <p>
            Please keep this info to yourself<span>{'🤫'}</span>
          </p>
          <a href={url} rel="noopener noreferrer" target="_blank">
            <CustomButton
              onClick={() => {
                onGiftTaken()
              }}
            >
              Claim your spot now!
            </CustomButton>
          </a>
        </Flex>
      </Container>
    </Modal>
  )
}

import { darken, transparentize } from 'polished'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, withRouter } from 'react-router-dom'
import { useActiveWeb3React } from '../../hooks'
import styled from 'styled-components'
import { useBodyKeyDown } from '../../hooks'

const tabOrder = [
  {
    path: '/limit-order',
    textKey: 'Limit Order',
    regex: /\/limit-order/,
  },
  {
    path: '/dca',
    textKey: 'DCA',
    regex: /\/dca/,
  },
  // {
  //   path: '/add-liquidity',
  //   textKey: 'pool',
  //   regex: /\/add-liquidity|\/remove-liquidity|\/create-exchange.*/
  // }
]

// const BetaMessage = styled.div`
//   ${({ theme }) => theme.flexRowNoWrap}
//   cursor: pointer;
//   flex: 1 0 auto;
//   align-items: center;
//   position: relative;
//   padding: 0.5rem 1rem;
//   padding-right: 2rem;
//   margin-bottom: 1rem;
//   border: 1px solid ${({ theme }) => transparentize(0.6, theme.wisteriaPurple)};
//   background-color: ${({ theme }) => transparentize(0.9, theme.wisteriaPurple)};
//   border-radius: 1rem;
//   font-size: 0.75rem;
//   line-height: 1rem;
//   text-align: left;
//   overflow: hidden;
//   text-overflow: ellipsis;
//   white-space: nowrap;
//   color: ${({ theme }) => theme.wisteriaPurple};
//   &:after {
//     content: '✕';
//     top: 0.5rem;
//     right: 1rem;
//     position: absolute;
//     color: ${({ theme }) => theme.wisteriaPurple};
//   }
// `

// const CloseIcon = styled.div`
//   width: 10px !important;
//   top: 0.5rem;
//   right: 1rem;
//   position: absolute;
//   color: ${({ theme }) => theme.wisteriaPurple};
//   :hover {
//     cursor: pointer;
//   }
// `

// const WarningHeader = styled.div`
//   margin-bottom: 10px;
//   font-weight: 500;
//   color: ${({ theme }) => theme.uniswapPink};
// `

// const WarningFooter = styled.div`
//   margin-top: 10px;
//   font-size: 10px;
//   text-decoration: italic;
//   color: ${({ theme }) => theme.greyText};
// `

const Tabs = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  height: 2.5rem;
  background-color: ${({ theme }) => theme.concreteGray};
  border-radius: 3rem;
  /* border: 1px solid ${({ theme }) => theme.mercuryGray}; */
  margin-bottom: 1rem;
`

const activeClassName = 'ACTIVE'

const StyledNavLink = styled(NavLink).attrs({
  activeClassName,
})`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  justify-content: center;
  height: 2.5rem;
  border: 1px solid ${({ theme }) => transparentize(1, theme.doveGray)};
  flex: 1 0 auto;
  border-radius: 3rem;
  outline: none;
  cursor: pointer;
  text-decoration: none;
  color: ${({ theme }) => theme.doveGray};
  font-size: 1rem;
  box-sizing: border-box;
  &.${activeClassName} {
    background-color: ${({ theme }) => theme.inputBackground};
    border-radius: 3rem;
    border: 1px solid ${({ theme }) => theme.uniswapPink};
    box-shadow: 0 4px 8px 0 ${({ theme }) => transparentize(0.95, theme.shadowColor)};
    box-sizing: border-box;
    font-weight: 500;
    color: ${({ theme }) => theme.uniswapPink};
    :hover {
      /* border: 1px solid ${({ theme }) => darken(0.1, theme.doveGray)}; */
      background-color: ${({ theme }) => darken(0.01, theme.inputBackground)};
    }
  }
  :hover,
  :focus {
    color: ${({ theme }) => darken(0.1, theme.uniswapPink)};
  }
`

function NavigationTabs({ location: { pathname }, history }) {
  const { chainId } = useActiveWeb3React()

  const { t } = useTranslation()

  // const [showBetaMessage, dismissBetaMessage] = useBetaMessageManager()

  // const onLiquidityPage = pathname === '/pool' || pathname === '/add-liquidity' || pathname === '/remove-liquidity'

  const navigate = useCallback(
    (direction) => {
      const tabIndex = tabOrder.findIndex(({ regex }) => pathname.match(regex))
      history.push(tabOrder[(tabIndex + tabOrder.length + direction) % tabOrder.length].path)
    },
    [pathname, history]
  )
  const navigateRight = useCallback(() => {
    navigate(1)
  }, [navigate])
  const navigateLeft = useCallback(() => {
    navigate(-1)
  }, [navigate])

  useBodyKeyDown('ArrowRight', navigateRight)
  useBodyKeyDown('ArrowLeft', navigateLeft)

  let tabOrderToShow = tabOrder
  if (chainId !== 1 && chainId !== 3) {
    tabOrderToShow = tabOrder.filter((tab) => tab.textKey !== 'DCA')
  }

  return (
    <>
      <Tabs>
        {tabOrderToShow.map(({ path, textKey, regex }) => (
          <StyledNavLink key={path} to={path} isActive={(_, { pathname }) => pathname.match(regex)}>
            {t(textKey)}
          </StyledNavLink>
        ))}
      </Tabs>
      {/* {showBetaMessage && (
        <BetaMessage onClick={dismissBetaMessage}>
          <span role="img" aria-label="warning">
            💀
          </span>{' '}
          {t('betaWarning')}
        </BetaMessage>
      )} */}
    </>
  )
}

export default withRouter(NavigationTabs)

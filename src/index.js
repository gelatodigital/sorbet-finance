import { Web3Provider } from '@ethersproject/providers'
import { createWeb3ReactRoot, Web3ReactProvider } from '@web3-react/core'
import React from 'react'
import ReactDOM from 'react-dom'
import ReactGA from 'react-ga'
import { Provider } from 'react-redux'
import { NetworkContextName } from './constants'
import AllBalancesContextProvider from './contexts/AllBalances'
import AllowancesContextProvider from './contexts/Allowances'
import ApplicationContextProvider, { Updater as ApplicationContextUpdater } from './contexts/Application'
import BalancesContextProvider from './contexts/Balances'
import GasPricesContextProvider from './contexts/GasPrice'
import LocalStorageContextProvider, { Updater as LocalStorageContextUpdater } from './contexts/LocalStorage'
import TokensContextProvider from './contexts/Tokens'
import TokensContextDcaProvider from './contexts/TokensDca'
import TransactionContextProvider, { Updater as TransactionContextUpdater } from './contexts/Transactions'
import './i18n'
import App from './pages/App'
import store from './state'
import MulticallUpdater from './state/multicall/updater'
import ThemeProvider, { GlobalStyle } from './theme'

const Web3ProviderNetwork = createWeb3ReactRoot(NetworkContextName)

if (process.env.NODE_ENV === 'production') {
  ReactGA.initialize('UA-194248530-2')
} else {
  ReactGA.initialize('test', { testMode: true })
}
ReactGA.pageview(window.location.pathname + window.location.search)

function getLibrary(provider) {
  const library = new Web3Provider(provider)
  library.pollingInterval = 15000
  return library
}

function ContextProviders({ children }) {
  return (
    <LocalStorageContextProvider>
      <ApplicationContextProvider>
        <TransactionContextProvider>
          <TokensContextProvider>
            <TokensContextDcaProvider>
              <BalancesContextProvider>
                <AllBalancesContextProvider>
                  <AllowancesContextProvider>
                    <GasPricesContextProvider>{children}</GasPricesContextProvider>
                  </AllowancesContextProvider>
                </AllBalancesContextProvider>
              </BalancesContextProvider>
            </TokensContextDcaProvider>
          </TokensContextProvider>
        </TransactionContextProvider>
      </ApplicationContextProvider>
    </LocalStorageContextProvider>
  )
}

function Updaters() {
  return (
    <>
      <LocalStorageContextUpdater />
      <ApplicationContextUpdater />
      <TransactionContextUpdater />
      <MulticallUpdater />
    </>
  )
}

ReactDOM.render(
  <Web3ReactProvider getLibrary={getLibrary}>
    <Web3ProviderNetwork getLibrary={getLibrary}>
      <ContextProviders>
        <Provider store={store}>
          <Updaters />
          <ThemeProvider>
            <>
              <GlobalStyle />
              <App />
            </>
          </ThemeProvider>
        </Provider>
      </ContextProviders>
    </Web3ProviderNetwork>
  </Web3ReactProvider>,
  document.getElementById('root')
)

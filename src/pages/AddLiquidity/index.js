import { useWeb3React } from '@web3-react/core'
import { ethers } from 'ethers'
import * as ls from 'local-storage'
import React, { useEffect, useReducer, useState } from 'react'
//import ReactGA from 'react-ga'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { useFetchAllBalances } from '../../contexts/AllBalances'
import { useAddressBalance } from '../../contexts/Balances'
//import { useGasPrice } from '../../contexts/GasPrice'
import { useTokenDetails } from '../../contexts/Tokens'
import { WETH, DAI } from '../../contexts/TokensDca'
import { BetaMessage } from '../../components/TimeExchangePage'
import { usePendingApproval, useTransactionAdder } from '../../contexts/Transactions'
import { Button, Link } from '../../theme'
import { useGelatoMetapoolContract, usePoolV3Contract, useTokenContract } from '../../hooks'
//import { getExchangeRate } from '../../utils/rate'
import CurrencyInputPanel from '../../components/CurrencyInputPanel'
import { ReactComponent as Plus } from '../../assets/images/plus-blue.svg'
import OversizedPanel from '../../components/OversizedPanel'
import { BigNumber } from "bignumber.js"
import ModeSelector from './ModeSelector'
import { getCounterfactualFees } from './feeMath.js'
import { useGasPrice } from '../../contexts/GasPrice'

/* eslint-disable-next-line */
BigNumber.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

// returns the sqrt price as a 64x96
function encodePriceSqrt(reserve1, reserve0) {
  return new BigNumber(reserve1)
    .div(reserve0)
    .sqrt()
    .multipliedBy(new BigNumber(2).pow(96))
    .integerValue(3)
    .toString();
}

const WETH_OP = 0
const DAI_OP = 1

const BlueSpan = styled.span`
  color: ${({ theme }) => theme.royalBlue};
`

const LastSummaryText = styled.div`
  margin-top: 1rem;
`

const DownArrowBackground = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  justify-content: center;
  align-items: center;
`
const SummaryPanel = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap}
  padding: 1rem 0;
`

const CenteredHeader = styled.div`
  text-align: center;
  font-family: Inter, sans-serif;
  font-weight: 600;
`

const ExchangeRateWrapper = styled.div`
  ${({ theme }) => theme.flexRowNoWrap};
  align-items: center;
  color: ${({ theme }) => theme.doveGray};
  font-size: 0.75rem;
  padding: 0.5rem 1rem;
`

const ExchangeRate = styled.span`
  flex: 1 1 auto;
  width: 0;
  color: ${({ theme }) => theme.doveGray};
`

const Flex = styled.div`
  display: flex;
  justify-content: center;
  padding: 0.5rem;
  button {
    max-width: 20rem;
  }
`

const WrappedPlus = ({ isError, highSlippageWarning, ...rest }) => <Plus {...rest} />
const ColoredWrappedPlus = styled(WrappedPlus)`
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
  padding: 0.875rem;
  path {
    stroke: ${({ active, theme }) => (active ? theme.royalBlue : theme.chaliceGray)};
  }
`

function initialAddLiquidityState(state) {
  return {
    wethValue: '',
    daiValue: '',
    lastEditedField: WETH_OP,
  }
}
  
function addLiquidityStateReducer(state, action) {
  switch (action.type) {
    case 'UPDATE_VALUE': {
      const { wethValue, daiValue } = state
      const { field, value } = action.payload
      return {
        ...state,
        wethValue: field === WETH_OP ? value : wethValue,
        daiValue: field === DAI_OP ? value : daiValue,
        lastEditedField: field
      }
    }
    default: {
      return initialAddLiquidityState()
    }
  }
}

const getPoolCurrentInfo = async (poolV3, gelatoPool, wethContract, daiContract) => {
  const {sqrtPriceX96, tick} = await poolV3.slot0()
  const price = 1/(1.0001**Number(tick))
  const lowerTick = await gelatoPool.currentLowerTick()
  const upperPrice = 1/(1.0001**Number(lowerTick))
  const sqrtUpperPriceX96 = encodePriceSqrt("1", upperPrice.toString())
  const upperTick = await gelatoPool.currentUpperTick()
  const lowerPrice = 1/(1.0001**Number(upperTick))
  const sqrtLowerPriceX96 = encodePriceSqrt("1", lowerPrice.toString())
  const totalSupply = await gelatoPool.totalSupply()
  const {liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1} = await poolV3.positions(await gelatoPool.getPositionID())
  const {
    feeGrowthOutside0X128: feeGrowthOutsideL0,
    feeGrowthOutside1X128: feeGrowthOutsideL1,
  } = await poolV3.ticks(lowerTick);
  const {
    feeGrowthOutside0X128: feeGrowthOutsideU0,
    feeGrowthOutside1X128: feeGrowthOutsideU1,
  } = await poolV3.ticks(upperTick);
  const feeGlobal0 = await poolV3.feeGrowthGlobal0X128();
  const feeGlobal1 = await poolV3.feeGrowthGlobal1X128();
  const {amount0, amount1} = await gelatoPool.getAmountsForLiquidity(sqrtPriceX96, sqrtLowerPriceX96, sqrtUpperPriceX96, liquidity)
  const totalDollarValue = Number(ethers.utils.formatEther(amount0)) + price*Number(ethers.utils.formatEther(amount1))
  const maxTokens = await gelatoPool.supplyCap();
  const fee0 = getCounterfactualFees(
    feeGlobal0,
    feeGrowthOutsideL0,
    feeGrowthOutsideU0,
    feeGrowthInside0LastX128,
    Number(tick),
    liquidity,
    Number(lowerTick),
    Number(upperTick)
  );

  const fee1 = getCounterfactualFees(
    feeGlobal1,
    feeGrowthOutsideL1,
    feeGrowthOutsideU1,
    feeGrowthInside1LastX128,
    Number(tick),
    liquidity,
    Number(lowerTick),
    Number(upperTick)
  );
  const feeTotalDollarValue = Number(ethers.utils.formatEther(fee0)) + Number(ethers.utils.formatEther(tokensOwed0)) + price*(Number(ethers.utils.formatEther(fee1)) + Number(ethers.utils.formatEther(tokensOwed1)));
  const timestamp = await gelatoPool.lastRebalanceTimestamp();
  const timeDiff = Number(new Date().getTime() / 1000) - timestamp;
  const feePerYear = feeTotalDollarValue * 31557600  / timeDiff;
  const apyLong = feePerYear/totalDollarValue;
  const feeTotalValue2 = Number(ethers.utils.formatEther(fee0)) + price*Number(ethers.utils.formatEther(fee1));
  const timestamp2 = await gelatoPool.lastMintOrBurnTimestamp();
  const timeDiff2 = Number(new Date().getTime() / 1000) - timestamp2;
  const feePerYear2 = feeTotalValue2 * 31557600  / timeDiff2;
  const apyShort = feePerYear2/totalDollarValue;
  let apy = 0;
  if (apyShort > apyLong) {
    apy = apyShort;
  } else {
    apy = apyLong;
  }
  const leftover0 = await daiContract.balanceOf(gelatoPool.address);
  const leftover1 = await wethContract.balanceOf(gelatoPool.address);
  return {
    price: price,
    sqrtPrice: sqrtPriceX96,
    upperPrice: upperPrice,
    lowerPrice: lowerPrice,
    amount0: amount0,
    amount1: amount1,
    liquidity: liquidity,
    totalSupply: totalSupply,
    totalDollarValue: totalDollarValue,
    supplyCap: maxTokens,
    fee0: fee0.add(tokensOwed0),
    fee1: fee1.add(tokensOwed1),
    feesDollarValue: feeTotalDollarValue,
    apy: apy,
    leftover0: leftover0,
    leftover1: leftover1
  }
};

const getAllowance = async (token, account, spenderAddress) => {
  return await token.allowance(account, spenderAddress)
}

export default function AddLiquidity() {
  const { t } = useTranslation()
  const { account, library, active, chainId } = useWeb3React()

  // core swap state
  const [addLiquidityState, dispatchAddLiquidityState] = useReducer(addLiquidityStateReducer, null, initialAddLiquidityState)

  const wethAddress = WETH[chainId]
  const daiAddress = DAI[chainId]

  const { wethValue, daiValue, lastEditedField } = addLiquidityState

  const [showBetaMessage, setShowBetaMessage] = useState(true)
  const [isWethApproved, setIsWethApproved] = useState(false)
  const [isDaiApproved, setIsDaiApproved] = useState(false)
  const [marketRate, setMarketRate] = useState(null)
  const [sqrtPrice, setSqrtPrice] = useState(null)
  const [lowerBoundRate, setLowerBoundRate] = useState(null)
  const [upperBoundRate, setUpperBoundRate] = useState(null)
  const [metapoolBalanceWeth, setMetapoolBalanceWeth] = useState(null)
  const [metapoolBalanceDai, setMetapoolBalanceDai] = useState(null)
  const [wethValueFormatted, setWethValueFormatted] = useState(null)
  const [daiValueFormatted, setDaiValueFormatted] = useState(null)
  const [wethValueInput, setWethValueInput] = useState(null)
  const [daiValueInput, setDaiValueInput] = useState(null)
  const [estimatedAmountWeth, setEstimatedAmountWeth] = useState(null)
  const [estimatedAmountDai, setEstimatedAmountDai] = useState(null)
  const [totalDollarValue, setTotalDollarValue] = useState(null)
  const [userEstimatedMint, setUserEstimatedMint] = useState(null)
  const [metapoolSupply, setMetapoolSupply] = useState(null)
  const [poolShare, setPoolShare] = useState(null)
  const [unclaimedFeeDai, setUnclaimedFeeDai] = useState(null)
  const [unclaimedFeeWeth, setUnclaimedFeeWeth] = useState(null)
  const [unclaimedFeesDollarValue, setUnclaimedFeesDollarValue] = useState(null)
  const [apy, setApy] = useState(null)

  const [isAddLiquidityPending, setIsAddLiquidityPending] = useState(null)
  const [isApproveWethPending, setIsApproveWethPending] = useState(null)
  const [isApproveDaiPending, setIsApproveDaiPending] = useState(null)

  const [supplyCap, setSupplyCap] = useState(null)
  const [supplyError, setSupplyError] = useState(null)

  const addTransaction = useTransactionAdder()
  const gasPrice = useGasPrice()

  const [inputErrorDai, setInputErrorDai] = useState()
  const [inputErrorWeth, setInputErrorWeth] = useState()

  // get symbols
  const { symbol: wethSymbol } = useTokenDetails(wethAddress)
  const { symbol: daiSymbol } = useTokenDetails(daiAddress)

  // get balances for each of the currency types
  const wethBalance = useAddressBalance(account, wethAddress)
  const daiBalance = useAddressBalance(account, daiAddress)
  const wethBalanceFormatted = !!(wethBalance) ? ethers.utils.formatEther(wethBalance) : ''
  const daiBalanceFormatted = !!(daiBalance) ? ethers.utils.formatEther(daiBalance) : ''

  const poolV3 = usePoolV3Contract()
  const gelatoPool = useGelatoMetapoolContract()
  const wethContract = useTokenContract(wethAddress)
  const daiContract = useTokenContract(daiAddress)

  async function onAddLiquidity() {
    getPoolCurrentInfo(poolV3, gelatoPool, wethContract, daiContract).then((result) => {
      setMarketRate(result.price)
      setUpperBoundRate(result.upperPrice)
      setLowerBoundRate(result.lowerPrice)
      setSqrtPrice(result.sqrtPrice)
      setMetapoolBalanceWeth(result.amount1)
      setMetapoolBalanceDai(result.amount0)
      setMetapoolSupply(result.totalSupply)
      setTotalDollarValue(result.totalDollarValue)
      setSupplyCap(result.supplyCap)
      setUnclaimedFeeDai(result.fee0)
      setUnclaimedFeeWeth(result.fee1)
      setUnclaimedFeesDollarValue(result.feesDollarValue)
      setApy(result.apy)
      console.log("values:", daiValueInput, wethValueInput)
      const parsedWeth = ethers.utils.parseUnits(wethValueInput, 18);
      const parsedDai = ethers.utils.parseUnits(daiValueInput, 18);
      gelatoPool.mint(parsedDai, parsedWeth, {gasPrice: gasPrice}).then((tx) => {
        setIsAddLiquidityPending(true)
        tx.wait().then(() => {
          console.log("complete!")
          setIsAddLiquidityPending(false)
          setDaiValueFormatted('')
          setWethValueFormatted('')
          setDaiValueInput('')
          setWethValueInput('')
          window.location.href = '/remove-liquidity'
        })
      }).catch((error) => {
        console.log("error adding liquidity!", error)
        setIsAddLiquidityPending(false)
      })
    })
  }

  // declare/get parsed and formatted versions of input/output values
  //const [independentValueParsed, setIndependentValueParsed] = useState()
  //const inputValueParsed = independentField === WETH_OP ? independentValueParsed : inputValue
  useEffect(() => {
    setInputErrorDai(null)
    setInputErrorWeth(null)
    setSupplyError(null)
    setIsDaiApproved(false)
    setIsWethApproved(false)
    setPoolShare('')
    setUserEstimatedMint('')
    if (lowerBoundRate && upperBoundRate && metapoolBalanceDai && metapoolBalanceWeth) {
      if (lastEditedField === WETH_OP) {
        setWethValueFormatted(wethValue)
        setWethValueInput(wethValue)
        if (wethValue) {
          getPoolCurrentInfo(poolV3, gelatoPool, wethContract, daiContract).then((result) => {
            setMarketRate(result.price)
            setUpperBoundRate(result.upperPrice)
            setLowerBoundRate(result.lowerPrice)
            setSqrtPrice(result.sqrtPrice)
            setMetapoolBalanceWeth(result.amount1)
            setMetapoolBalanceDai(result.amount0)
            setMetapoolSupply(result.totalSupply)
            setTotalDollarValue(result.totalDollarValue)
            setSupplyCap(result.supplyCap)
            setUnclaimedFeeDai(result.fee0)
            setUnclaimedFeeWeth(result.fee1)
            setUnclaimedFeesDollarValue(result.feesDollarValue)
            setApy(result.apy)
            let supply = result.totalSupply
            let currentLiquidity = result.liquidity
            let supplyCapped = result.supplyCap
            let parsedWeth = ethers.utils.parseUnits(wethValue, 18);
            let sqrtPriceLower = encodePriceSqrt("1", result.lowerPrice.toString());
            let sqrtPriceUpper = encodePriceSqrt("1", result.upperPrice.toString());
            gelatoPool.getNewLiquidityFromAmounts(daiBalance, parsedWeth).then((r2) => {
              const estimatedMint = Number(ethers.utils.formatEther(r2))*Number(ethers.utils.formatEther(supply))/Number(ethers.utils.formatEther(currentLiquidity));
              setUserEstimatedMint(ethers.utils.parseUnits(estimatedMint.toString(), 18));
              const percentage = (estimatedMint*100)/(estimatedMint+Number(ethers.utils.formatEther(supply)));
              setPoolShare(percentage);
              if (estimatedMint + Number(ethers.utils.formatEther(supply)) > Number(ethers.utils.formatEther(supplyCapped))) {
                setSupplyError('Cannot mint above supply cap!')
                return
              }
              gelatoPool.getAmountsForLiquidity(result.sqrtPrice, sqrtPriceLower.toString(), sqrtPriceUpper.toString(), r2).then((r3) => {
                const estimatedAmountDai = Number(ethers.utils.formatEther(r3.amount0))*.99;
                const estimatedAmountWeth = Number(ethers.utils.formatEther(r3.amount1))*.99;
                setDaiValueFormatted(estimatedAmountDai.toString())
                setEstimatedAmountWeth(estimatedAmountWeth)
                setEstimatedAmountDai(estimatedAmountDai)
                setDaiValueInput(estimatedAmountDai.toString());
                getAllowance(wethContract, account, gelatoPool.address).then((allowance) => {
                  if (Number(ethers.utils.formatEther(allowance)) >= Number(wethValue)) {
                    setIsWethApproved(true);
                  } else {
                    setIsWethApproved(false)
                  }
                })
                getAllowance(daiContract, account, gelatoPool.address).then((allowanceDai) => {
                  if (Number(ethers.utils.formatEther(allowanceDai)) >= estimatedAmountDai) {
                    setIsDaiApproved(true);
                  } else {
                    setIsDaiApproved(false)
                  }
                })
                if (Number(wethValue) > Number(wethBalanceFormatted)) {
                  setInputErrorWeth('Insufficient Balance!')
                  setSupplyError('Insufficient Balance!')
                  return
                }
                if (estimatedAmountDai > Number(daiBalanceFormatted)) {
                  setInputErrorDai('Insufficient Balance!')
                  setSupplyError('Insufficient Balance!')
                  return
                }
              });
            });
          });
        }
      } else {
        setDaiValueFormatted('')
        setDaiValueInput('')
        setSupplyError('Input WETH amount only');
      }
    }
  }, [wethValue, daiValue])

  //let outputValueParsed;
  const allBalances = useFetchAllBalances()

  const isActive = active && account

  const isValid = !inputErrorDai && !inputErrorWeth && isWethApproved && isDaiApproved && !supplyError && (Number(wethValue) > 0 || Number(daiValue) > 0)

  function formatBalance(value) {
    return `(${t('balance', { balanceInput: value })})`
  }

  const onApproveWeth = async () => {
    console.log("Approving Dai")
    wethContract.approve(gelatoPool.address, ethers.constants.MaxUint256, {gasPrice: gasPrice}).then((tx) => {
      setIsApproveWethPending(true)
      tx.wait().then(() => {
        setIsWethApproved(true)
        setIsApproveWethPending(false)
      })
    }).catch((error) => {
      console.log('error approving weth!', error)
      setIsApproveWethPending(false)
    })
  }

  const onApproveDai = async () => {
    console.log("Approving Dai")
    daiContract.approve(gelatoPool.address, ethers.constants.MaxUint256, {gasPrice: gasPrice}).then((tx) => {
      setIsApproveDaiPending(true)
      tx.wait().then(() => {
        setIsDaiApproved(true)
        setIsApproveDaiPending(false)
      })
    }).catch((error) => {
      console.log('error approving dai!', error)
      setIsApproveDaiPending(false)
    })
  }

  useEffect(() => {
    if (poolV3 && gelatoPool) {
      getPoolCurrentInfo(poolV3, gelatoPool, wethContract, daiContract).then((result) => {
        setMarketRate(result.price)
        setUpperBoundRate(result.upperPrice)
        setLowerBoundRate(result.lowerPrice)
        setSqrtPrice(result.sqrtPrice)
        setMetapoolBalanceWeth(result.amount1)
        setMetapoolBalanceDai(result.amount0)
        setMetapoolSupply(result.totalSupply)
        setTotalDollarValue(result.totalDollarValue)
        setSupplyCap(result.supplyCap)
        setUnclaimedFeeDai(result.fee0)
        setUnclaimedFeeWeth(result.fee1)
        setUnclaimedFeesDollarValue(result.feesDollarValue)
        setApy(result.apy)
      })
      if (!daiValueFormatted) {
        setIsDaiApproved(true);
      }
      if (!wethValueFormatted) {
        setIsWethApproved(true);
      }
    }
  }, [poolV3, gelatoPool]);

  return <>
      { (gelatoPool && metapoolSupply) ?
        <>
          {showBetaMessage && (
            <BetaMessage onClick={ () => setShowBetaMessage(false)}>
              <span role="img" aria-label="warning">
              🚨
              </span>{' '}
              <Link id="link"  className="how-it-works">
                    {`Experimental - Use at own risk`}
              </Link>
            </BetaMessage>
          )}
          <OversizedPanel hideBottom>
            <SummaryPanel>
              <CenteredHeader>
                Gelato's Uniswap V3 WETH/DAI Automated LP
                <br></br>
                <ExchangeRateWrapper><ExchangeRate>
                  An ERC20 aggregating V3 LPs to passively earn competitive yeild
                  <br></br>
                  <a href="https://gelato-1.gitbook.io/sorbet-finance/">Learn More</a>
                </ExchangeRate></ExchangeRateWrapper>
              </CenteredHeader>
            </SummaryPanel>
          </OversizedPanel>
          <br></br>
          <ModeSelector />
          <CurrencyInputPanel
            title={t('deposit')}
            allBalances={allBalances}
            extraText={wethBalanceFormatted && formatBalance(Number(wethBalanceFormatted).toFixed(5))}
            extraTextClickHander={() => {
              if (wethBalance) {
                if (wethBalance.gt(ethers.constants.Zero)) {
                  dispatchAddLiquidityState({
                    type: 'UPDATE_VALUE',
                    payload: { value: ethers.utils.formatEther(wethBalance), field: WETH_OP }
                  })
                }
              }
            }}
            onValueChange={wethValue => {
              dispatchAddLiquidityState({ type: 'UPDATE_VALUE', payload: { value: wethValue, field: WETH_OP } })
            }}
            selectedTokens={[wethAddress, daiAddress]}
            selectedTokenAddress={wethAddress}
            value={wethValueFormatted}
            errorMessage={inputErrorWeth ? inputErrorWeth : ''}
            disableTokenSelect
            disableUnlock
          />
          <OversizedPanel>
            <DownArrowBackground>
              <ColoredWrappedPlus active={isActive} alt="plus" />
            </DownArrowBackground>
          </OversizedPanel>
          <CurrencyInputPanel
            title={t('deposit')}
            allBalances={allBalances}
            extraText={daiBalanceFormatted && formatBalance(Number(daiBalanceFormatted).toFixed(5))}
            extraTextClickHander={() => {
              if (daiBalance) {
                if (daiBalance.gt(ethers.constants.Zero)) {
                  dispatchAddLiquidityState({
                    type: 'UPDATE_VALUE',
                    payload: { value: ethers.utils.formatEther(daiBalance), field: DAI_OP }
                  })
                }
              }
            }}
            onValueChange={daiValue => {
              dispatchAddLiquidityState({ type: 'UPDATE_VALUE', payload: { value: daiValue, field: DAI_OP } })
            }}
            selectedTokens={[wethAddress, daiAddress]}
            selectedTokenAddress={daiAddress}
            value={daiValueFormatted}
            errorMessage={inputErrorDai ? inputErrorDai : ''}
            disableTokenSelect
            disableUnlock
          />
          <OversizedPanel hideBottom>
            <SummaryPanel>
              <CenteredHeader>You Owe: {(estimatedAmountDai && estimatedAmountWeth) ? `${estimatedAmountWeth.toFixed(3)} WETH + ${estimatedAmountDai.toFixed(3)} DAI` : '-'}</CenteredHeader>
            </SummaryPanel>
            <SummaryPanel>
              <ExchangeRateWrapper>
                <ExchangeRate>{t('exchangeRate')}</ExchangeRate>
                {<span>{marketRate  ? `1 ${wethSymbol} = ${marketRate.toFixed(3)} ${daiSymbol}` : ' - '}</span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Position Range'}</ExchangeRate>
                {<span>
                  {lowerBoundRate && upperBoundRate
                    ? `${lowerBoundRate.toFixed(3)} ${daiSymbol} <---> ${upperBoundRate.toFixed(3)} ${daiSymbol}`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Position Capital'}</ExchangeRate>
                {<span>
                  {(metapoolBalanceWeth && metapoolBalanceDai && totalDollarValue)
                    ? `${Number(ethers.utils.formatEther(metapoolBalanceWeth)).toFixed(3)} ${wethSymbol} + ${Number(ethers.utils.formatEther(metapoolBalanceDai)).toFixed(3)} ${daiSymbol} (~ $${totalDollarValue.toFixed(2)})`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Position Unclaimed Fees'}</ExchangeRate>
                {<span>
                  {(unclaimedFeeWeth && unclaimedFeeDai && unclaimedFeesDollarValue)
                    ? `${Number(ethers.utils.formatEther(unclaimedFeeWeth)).toFixed(3)} ${wethSymbol} + ${Number(ethers.utils.formatEther(unclaimedFeeDai)).toFixed(3)} ${daiSymbol} (~ $${unclaimedFeesDollarValue.toFixed(2)})`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Current APY'}</ExchangeRate>
                {<span>
                  {(apy)
                    ? `~ ${apy.toFixed(2)}%`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Token Supply'}</ExchangeRate>
                {<span>
                  {metapoolSupply
                    ? `${Number(ethers.utils.formatEther(metapoolSupply)).toFixed(5)} gUNI`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>
                  {'Tokens to Mint'} ({poolShare ? poolShare.toFixed(5) : '-'}%)
                </ExchangeRate>
                <span>{userEstimatedMint ? Number(ethers.utils.formatEther(userEstimatedMint)).toFixed(5)+' gUNI' : '-'}</span>
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>
                  {'Token Supply After'}
                </ExchangeRate>
                <span>{(userEstimatedMint && metapoolSupply) ? (Number(ethers.utils.formatEther(userEstimatedMint))+Number(ethers.utils.formatEther(metapoolSupply))).toFixed(5)+' gUNI' : '-'}</span>
              </ExchangeRateWrapper>
              <ExchangeRateWrapper>
                <ExchangeRate>{'Token Supply Cap'}</ExchangeRate>
                {<span>
                  {supplyCap
                    ? `${Number(ethers.utils.formatEther(supplyCap)).toFixed(0)} gUNI`
                  : ' - '}
                  </span>}
              </ExchangeRateWrapper>
            </SummaryPanel>
          </OversizedPanel>
          {supplyError && (
            <p style={{color: 'red'}}>{supplyError}</p>
          )
          }
          {!isWethApproved && (
            <Flex>
              <Button disabled={isApproveWethPending || supplyError != null} onClick={onApproveWeth}>
              {isApproveWethPending ? `Pending...` : `Approve ${wethSymbol}`}
              </Button>
            </Flex>
          )}
          {!isDaiApproved && (
            <Flex>
              <Button disabled={isApproveDaiPending || supplyError != null} onClick={onApproveDai}>
                {isApproveDaiPending ? `Pending...` : `Approve ${daiSymbol}`}
              </Button>
            </Flex>
          )}
          <Flex>
            <Button disabled={!isValid || isAddLiquidityPending } onClick={onAddLiquidity}>
              {!isAddLiquidityPending ? t('addLiquidity') : "Pending..."}
            </Button>
          </Flex>
        </>
      :
        <>
          {(!gelatoPool) ?
            <OversizedPanel hideBottom>
              <SummaryPanel>Network not Supported</SummaryPanel>
            </OversizedPanel> 
          :
            <OversizedPanel hideBottom>
              <SummaryPanel>loading...</SummaryPanel>
            </OversizedPanel>
          }
        </>
      }
  </>
}
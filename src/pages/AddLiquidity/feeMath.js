import { BigNumber } from "@ethersproject/bignumber";

function subIn256(x, y) {
  const difference = x.sub(y);
  return difference.lt(0)
    ? BigNumber.from(2).pow(256).add(difference)
    : difference;
}

export function getCounterfactualFees(
  feeGrowthGlobal,
  feeGrowthOutsideLower,
  feeGrowthOutsideUpper,
  feeGrowthInsideLast,
  tickCurrent,
  liquidity,
  tickLower,
  tickUpper
) {
  let feeGrowthBelow;
  if (tickCurrent >= tickLower) {
    feeGrowthBelow = feeGrowthOutsideLower;
  } else {
    feeGrowthBelow = subIn256(feeGrowthGlobal, feeGrowthOutsideLower);
  }

  let feeGrowthAbove;
  if (tickCurrent < tickUpper) {
    feeGrowthAbove = feeGrowthOutsideUpper;
  } else {
    feeGrowthAbove = subIn256(feeGrowthGlobal, feeGrowthOutsideUpper);
  }

  const feeGrowthInside = subIn256(
    subIn256(feeGrowthGlobal, feeGrowthBelow),
    feeGrowthAbove
  );

  return subIn256(feeGrowthInside, feeGrowthInsideLast)
    .mul(liquidity)
    .div(BigNumber.from(2).pow(128));
}
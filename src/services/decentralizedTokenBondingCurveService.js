// src/services/decentralizedTokenBondingCurveService.js

import { logger } from '../utils/Logger.js';

export class DecentralizedTokenBondingCurveService {
  constructor(slope = 0.001, exponent = 1.5, reserveRatio = 0.2) {
    this.slope = slope;           // Price scaling factor 'm'
    this.exponent = exponent;     // Price power curve exponent 'k'
    this.reserveRatio = reserveRatio; // Fraction of collateral held in pool reserve
    this.tokens = new Map();      // tokenSymbol -> tokenMarket
  }

  /**
   * Deploys a new creator token with an automated bonding curve.
   */
  launchCreatorToken({
    creatorId,
    tokenName,
    tokenSymbol,
    initialReserve = 1000, // Initial creator collateral in coins
    creatorAllocation = 1000, // Pre-minted creator tokens
  }) {
    if (!creatorId || !tokenName || !tokenSymbol) {
      throw new Error('creatorId, tokenName, and tokenSymbol are required');
    }

    const symbol = tokenSymbol.toUpperCase();
    if (this.tokens.has(symbol)) {
      throw new Error(`Token symbol ${symbol} already launched`);
    }

    const tokenMarket = {
      creatorId,
      tokenName,
      symbol,
      totalSupply: creatorAllocation,
      reserveBalance: Number(initialReserve),
      createdAt: Date.now(),
      holders: new Map([[creatorId, creatorAllocation]]),
      tradingHistory: [],
    };

    this.tokens.set(symbol, tokenMarket);
    logger.info(`[BondingCurve] Launched Creator Token $${symbol} (${tokenName}) with initial supply ${creatorAllocation}`);
    return this._formatMarket(tokenMarket);
  }

  /**
   * Calculates instantaneous spot price for 1 token at current supply.
   * Price = slope * (Supply)^exponent
   */
  getSpotPrice(symbol) {
    const market = this._getMarket(symbol);
    return this._calculatePriceAtSupply(market.totalSupply);
  }

  _calculatePriceAtSupply(supply) {
    return Number((this.slope * Math.pow(Math.max(1, supply), this.exponent)).toFixed(4));
  }

  /**
   * Calculates cost to mint a specific quantity of tokens by integrating price curve.
   * Integral: Cost = (slope / (k + 1)) * ((S + dS)^(k + 1) - S^(k + 1))
   */
  calculateBuyCost(symbol, amountToMint) {
    const market = this._getMarket(symbol);
    const S = market.totalSupply;
    const dS = Number(amountToMint);
    if (dS <= 0) throw new Error('amountToMint must be positive');

    const k = this.exponent;
    const integralOld = Math.pow(S, k + 1);
    const integralNew = Math.pow(S + dS, k + 1);
    const rawCost = (this.slope / (k + 1)) * (integralNew - integralOld);

    const cost = Math.max(1, Math.ceil(rawCost));
    const avgPrice = Number((cost / dS).toFixed(4));

    return {
      symbol,
      amountToMint: dS,
      totalCostCoins: cost,
      averagePrice: avgPrice,
      estimatedSpotPriceAfter: this._calculatePriceAtSupply(S + dS),
    };
  }

  /**
   * Executes token buy along the bonding curve.
   */
  buyTokens({ symbol, buyerId, maxCollateralCoins, minTokensExpected = 1 }) {
    const market = this._getMarket(symbol);
    // Find how many tokens maxCollateralCoins can purchase
    let low = 1;
    let high = 1000000;
    let tokensToMint = 1;

    // Binary search for exact mintable units
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const quote = this.calculateBuyCost(symbol, mid);
      if (quote.totalCostCoins <= maxCollateralCoins) {
        tokensToMint = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (tokensToMint < minTokensExpected) {
      throw new Error(`SlippageExceeded: Expected min ${minTokensExpected} tokens, got ${tokensToMint}`);
    }

    const { totalCostCoins } = this.calculateBuyCost(symbol, tokensToMint);

    market.totalSupply += tokensToMint;
    market.reserveBalance += totalCostCoins;

    const currentHoldings = market.holders.get(buyerId) || 0;
    market.holders.set(buyerId, currentHoldings + tokensToMint);

    const tx = {
      type: 'BUY',
      buyerId,
      tokensMinted: tokensToMint,
      costPaid: totalCostCoins,
      timestamp: Date.now(),
    };
    market.tradingHistory.push(tx);

    logger.info(`[BondingCurve] User ${buyerId} bought ${tokensToMint} $${symbol} for ${totalCostCoins} coins`);
    return {
      tx,
      market: this._formatMarket(market),
    };
  }

  /**
   * Sells tokens back into the bonding curve reserve.
   */
  sellTokens({ symbol, sellerId, tokensToBurn, minPayoutExpected = 0 }) {
    const market = this._getMarket(symbol);
    const holding = market.holders.get(sellerId) || 0;
    if (holding < tokensToBurn) {
      throw new Error(`Insufficient tokens: Holds ${holding}, requested ${tokensToBurn}`);
    }

    const S = market.totalSupply;
    const dS = tokensToBurn;
    const k = this.exponent;
    const integralNew = Math.pow(Math.max(1, S - dS), k + 1);
    const integralOld = Math.pow(S, k + 1);
    const rawRefund = (this.slope / (k + 1)) * (integralOld - integralNew);
    const refund = Math.floor(rawRefund);

    if (refund < minPayoutExpected) {
      throw new Error(`SlippageExceeded: Payout ${refund} is below min ${minPayoutExpected}`);
    }

    market.totalSupply -= tokensToBurn;
    market.reserveBalance = Math.max(0, market.reserveBalance - refund);
    market.holders.set(sellerId, holding - tokensToBurn);

    const tx = {
      type: 'SELL',
      sellerId,
      tokensBurned: tokensToBurn,
      payoutCoins: refund,
      timestamp: Date.now(),
    };
    market.tradingHistory.push(tx);

    logger.info(`[BondingCurve] User ${sellerId} sold ${tokensToBurn} $${symbol} for ${refund} coins`);
    return {
      tx,
      market: this._formatMarket(market),
    };
  }

  _getMarket(symbol) {
    const market = this.tokens.get(symbol.toUpperCase());
    if (!market) throw new Error(`Token $${symbol} not found`);
    return market;
  }

  _formatMarket(market) {
    const currentPrice = this.getSpotPrice(market.symbol);
    return {
      creatorId: market.creatorId,
      tokenName: market.tokenName,
      symbol: market.symbol,
      totalSupply: market.totalSupply,
      reserveBalance: market.reserveBalance,
      spotPrice: currentPrice,
      marketCap: Number((market.totalSupply * currentPrice).toFixed(2)),
      holdersCount: market.holders.size,
    };
  }
}

export const decentralizedTokenBondingCurveService = new DecentralizedTokenBondingCurveService();
export default decentralizedTokenBondingCurveService;

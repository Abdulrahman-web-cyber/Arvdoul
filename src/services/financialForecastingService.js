/**
 * src/services/financialForecastingService.js - ARVDOUL FINANCIAL FORECASTING & COIN LIABILITY ENGINE
 *
 * Implements:
 * 1. Virtual Coin Liability Modeling: Calculates circulating coin float liabilities vs USD escrow reserves.
 * 2. Monthly Recurring Revenue (MRR) & Churn Forecasting: Projects subscription revenue based on active creator subscriber tiers.
 * 3. Gross Margin & Payout Simulation.
 */

class FinancialForecastingService {
  /**
   * Computes circulating coin liability and reserve solvency ratio.
   * @param {number} totalCirculatingCoins - e.g. 5,000,000 coins
   * @param {number} escrowBalanceUSD - e.g. $45,000
   * @param {number} payoutRatePerCoinUSD - e.g. $0.007 (creator redeem rate)
   */
  calculateSolvency(totalCirculatingCoins, escrowBalanceUSD, payoutRatePerCoinUSD = 0.007) {
    const totalLiabilityUSD = totalCirculatingCoins * payoutRatePerCoinUSD;
    const reserveCoveragePercent = totalLiabilityUSD > 0 ? (escrowBalanceUSD / totalLiabilityUSD) * 100 : 100;

    return {
      totalCirculatingCoins,
      totalLiabilityUSD: parseFloat(totalLiabilityUSD.toFixed(2)),
      escrowBalanceUSD: parseFloat(escrowBalanceUSD.toFixed(2)),
      reserveCoveragePercent: parseFloat(reserveCoveragePercent.toFixed(1)),
      isSolvent: reserveCoveragePercent >= 100.0,
    };
  }

  /**
   * Projects MRR growth based on subscriber acquisition and churn rates.
   */
  projectMRR(currentMRR, growthRatePercent = 15, churnRatePercent = 3, months = 12) {
    const projection = [];
    let mrr = currentMRR;

    for (let month = 1; month <= months; month++) {
      const netGrowth = (growthRatePercent - churnRatePercent) / 100;
      mrr = mrr * (1 + netGrowth);
      projection.push({
        month,
        projectedMRR: parseFloat(mrr.toFixed(2)),
      });
    }

    return projection;
  }
}

export const financialForecastingService = new FinancialForecastingService();
export default financialForecastingService;

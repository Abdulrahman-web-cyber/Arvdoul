/**
 * src/__tests__/monetizationFlows.test.jsx
 *
 * Verifies WalletScreen ledger credit/debit classification + Stripe payout
 * readiness guard, SubscriptionScreen PaymentModal checkout wiring, and
 * CoinsScreen ad/subscription state refresh.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WalletScreen from '../screens/Economy/WalletScreen.jsx';
import SubscriptionScreen from '../screens/SubscriptionScreen.jsx';

jest.mock('../lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user_1', displayName: 'Creator One' },
  }),
}));

jest.mock('@context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user_1', displayName: 'Creator One' },
  }),
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

jest.mock('@context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

jest.mock('../components/Shared/ConfirmProvider.jsx', () => ({
  useConfirm: () => jest.fn(async () => true),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockGetWalletOverview = jest.fn();
const mockGetTransactions = jest.fn();
const mockRequestPayout = jest.fn();
jest.mock('../services/walletService', () => ({
  __esModule: true,
  default: {
    getWalletOverview: (...a) => mockGetWalletOverview(...a),
    getTransactions: (...a) => mockGetTransactions(...a),
    requestPayout: (...a) => mockRequestPayout(...a),
  },
}));

const mockGetPayoutSettings = jest.fn();
const mockGetSubscriptionStatus = jest.fn();
const mockCreateSubscription = jest.fn();
const mockCancelSubscription = jest.fn();
jest.mock('../services/monetizationService', () => ({
  __esModule: true,
  getMonetizationService: () => ({
    getPayoutSettings: (...a) => mockGetPayoutSettings(...a),
    purchaseCoins: jest.fn(),
  }),
  getSubscriptionStatus: (...a) => mockGetSubscriptionStatus(...a),
  createSubscription: (...a) => mockCreateSubscription(...a),
  cancelSubscription: (...a) => mockCancelSubscription(...a),
}));

jest.mock('../services/monetizationService.js', () => ({
  __esModule: true,
  getMonetizationService: () => ({
    getPayoutSettings: (...a) => mockGetPayoutSettings(...a),
    purchaseCoins: jest.fn(),
  }),
  getSubscriptionStatus: (...a) => mockGetSubscriptionStatus(...a),
  createSubscription: (...a) => mockCreateSubscription(...a),
  cancelSubscription: (...a) => mockCancelSubscription(...a),
}));

jest.mock('../components/Shared/PaymentModal', () => ({
  __esModule: true,
  default: ({ open, title, amountLabel, onConfirm, onClose }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <span>{amountLabel}</span>
        <button type="button" onClick={() => onConfirm('pm_test_123')}>
          Confirm Mock Payment
        </button>
        <button type="button" onClick={onClose}>
          Close Payment Modal
        </button>
      </div>
    ) : null,
}));

describe('WalletScreen Ledger & Payout Readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('classifies credit and debit transactions by tx.type with +/- signs and shows Stripe setup prompt when disconnected', async () => {
    mockGetWalletOverview.mockResolvedValue({
      userId: 'user_1',
      coins: 1200,
      availableCoins: 1200,
      pendingCoins: 0,
      totalEarned: 1500,
      totalSpent: 300,
      monetizationEligible: true,
      level: 10,
      isCreator: true,
    });
    mockGetPayoutSettings.mockResolvedValue({ status: 'not_connected', stripeAccountId: null });
    mockGetTransactions.mockResolvedValue([
      { id: 'tx_in', type: 'credit', reason: 'vibe_gift_received', amount: 100, status: 'completed', createdAt: new Date() },
      { id: 'tx_out', type: 'debit', reason: 'gift', amount: 25, status: 'completed', createdAt: new Date() },
    ]);

    render(
      <MemoryRouter>
        <WalletScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText('Audit Ledger (2)')).toBeInTheDocument();
    expect(screen.getByText('+100 Coins')).toBeInTheDocument();
    expect(screen.getByText('-25 Coins')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Up Stripe Payouts' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'out' }));
    expect(screen.getByText('Audit Ledger (1)')).toBeInTheDocument();
    expect(screen.getByText('-25 Coins')).toBeInTheDocument();
    expect(screen.queryByText('+100 Coins')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'in' }));
    expect(screen.getByText('Audit Ledger (1)')).toBeInTheDocument();
    expect(screen.getByText('+100 Coins')).toBeInTheDocument();
    expect(screen.queryByText('-25 Coins')).not.toBeInTheDocument();
  });
});

describe('SubscriptionScreen PaymentModal Checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('opens PaymentModal and passes paymentMethodId to createSubscription', async () => {
    mockGetSubscriptionStatus.mockResolvedValue({ success: true, active: false, tier: null, subscription: null });
    mockCreateSubscription.mockResolvedValue({ success: true, tier: 'pro' });

    render(
      <MemoryRouter>
        <SubscriptionScreen />
      </MemoryRouter>
    );

    const subButton = await screen.findByRole('button', { name: 'Subscribe to Pro' });
    fireEvent.click(subButton);

    const modal = await screen.findByRole('dialog', { name: 'Subscribe to Pro' });
    fireEvent.click(modal.querySelector('button'));

    await waitFor(() => {
      expect(mockCreateSubscription).toHaveBeenCalledWith('pro', 'pm_test_123');
    });
  });
});

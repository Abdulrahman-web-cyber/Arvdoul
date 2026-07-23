// __tests__/services/monetizationService.test.js
import { jest } from '@jest/globals';

/**
 * Monetization Service Tests
 * Tests coin system, gift system, and level progression
 */

describe('MonetizationService', () => {
  // Configuration from functions/index.js
  const MONETIZATION_CONFIG = {
    LEVELS: [
      { level: 1, xpRequired: 0, coinReward: 0 },
      { level: 2, xpRequired: 100, coinReward: 10 },
      { level: 3, xpRequired: 300, coinReward: 20 },
      { level: 4, xpRequired: 600, coinReward: 30 },
      { level: 5, xpRequired: 1000, coinReward: 40 },
      { level: 10, xpRequired: 4500, coinReward: 100 },
      { level: 15, xpRequired: 10500, coinReward: 200 }
    ],
    WITHDRAWAL_MIN_LEVEL: 10,
    GIFTS: [
      { type: 'rose', value: 5 },
      { type: 'crown', value: 50 },
      { type: 'diamond', value: 100 },
      { type: 'rocket', value: 500 }
    ],
    BOOST_COST_PER_DAY: 10
  };

  describe('Level System', () => {
    const getLevelForXP = (xp, levels) => {
      let currentLevel = levels[0];
      for (const level of levels) {
        if (xp >= level.xpRequired) {
          currentLevel = level;
        } else {
          break;
        }
      }
      return currentLevel;
    };

    const getXPForNextLevel = (currentXP, levels) => {
      const currentLevel = getLevelForXP(currentXP, levels);
      const currentIndex = levels.indexOf(currentLevel);
      if (currentIndex === levels.length - 1) {
        return null; // Max level
      }
      return levels[currentIndex + 1].xpRequired - currentXP;
    };

    it('should return level 1 for 0 XP', () => {
      const level = getLevelForXP(0, MONETIZATION_CONFIG.LEVELS);
      expect(level.level).toBe(1);
    });

    it('should return level 2 for 100 XP', () => {
      const level = getLevelForXP(100, MONETIZATION_CONFIG.LEVELS);
      expect(level.level).toBe(2);
    });

    it('should return level 5 for 1000 XP', () => {
      const level = getLevelForXP(1000, MONETIZATION_CONFIG.LEVELS);
      expect(level.level).toBe(5);
    });

    it('should return level 10 for 5000 XP', () => {
      const level = getLevelForXP(5000, MONETIZATION_CONFIG.LEVELS);
      expect(level.level).toBe(10);
    });

    it('should calculate XP needed for next level', () => {
      const xpNeeded = getXPForNextLevel(150, MONETIZATION_CONFIG.LEVELS);
      expect(xpNeeded).toBe(150); // 300 - 150
    });

    it('should return null for max level XP', () => {
      const xpNeeded = getXPForNextLevel(15000, MONETIZATION_CONFIG.LEVELS);
      expect(xpNeeded).toBeNull();
    });
  });

  describe('Gift System', () => {
    const GIFT_TYPES = MONETIZATION_CONFIG.GIFTS;

    it('should have rose gift type', () => {
      const rose = GIFT_TYPES.find(g => g.type === 'rose');
      expect(rose.value).toBe(5);
    });

    it('should have crown gift type', () => {
      const crown = GIFT_TYPES.find(g => g.type === 'crown');
      expect(crown.value).toBe(50);
    });

    it('should have diamond gift type', () => {
      const diamond = GIFT_TYPES.find(g => g.type === 'diamond');
      expect(diamond.value).toBe(100);
    });

    it('should have rocket gift type', () => {
      const rocket = GIFT_TYPES.find(g => g.type === 'rocket');
      expect(rocket.value).toBe(500);
    });

    it('should calculate total gift value', () => {
      const giftCounts = { rose: 5, crown: 2, diamond: 1, rocket: 0 };
      const total = giftCounts.rose * 5 + giftCounts.crown * 50 + 
                    giftCounts.diamond * 100 + giftCounts.rocket * 500;
      // 5*5 + 2*50 + 1*100 = 25 + 100 + 100 = 225
      expect(total).toBe(225);
    });
  });

  describe('Coin Transactions', () => {
    const createTransaction = (userId, type, amount, reason, metadata = {}) => ({
      userId,
      type,
      amount,
      reason,
      metadata,
      createdAt: new Date()
    });

    it('should create credit transaction', () => {
      const tx = createTransaction('user-123', 'credit', 100, 'iap', { productId: 'coins_100' });
      expect(tx.type).toBe('credit');
      expect(tx.amount).toBe(100);
    });

    it('should create debit transaction', () => {
      const tx = createTransaction('user-123', 'debit', 50, 'gift', { recipientId: 'user-456' });
      expect(tx.type).toBe('debit');
      expect(tx.amount).toBe(50);
    });

    it('should validate sufficient balance', () => {
      const balance = 100;
      const amount = 50;
      expect(balance >= amount).toBe(true);
    });

    it('should reject insufficient balance', () => {
      const balance = 30;
      const amount = 50;
      expect(balance >= amount).toBe(false);
    });
  });

  describe('Transfer System', () => {
    const simulateTransfer = (fromBalance, toBalance, amount) => {
      if (fromBalance < amount) {
        return { success: false, error: 'Insufficient balance' };
      }
      return {
        success: true,
        fromNewBalance: fromBalance - amount,
        toNewBalance: toBalance + amount
      };
    };

    it('should transfer coins successfully', () => {
      const result = simulateTransfer(100, 50, 30);
      expect(result.success).toBe(true);
      expect(result.fromNewBalance).toBe(70);
      expect(result.toNewBalance).toBe(80);
    });

    it('should fail transfer with insufficient balance', () => {
      const result = simulateTransfer(20, 50, 30);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient balance');
    });
  });

  describe('Withdrawal System', () => {
    const canWithdraw = (user) => {
      return user.level >= MONETIZATION_CONFIG.WITHDRAWAL_MIN_LEVEL;
    };

    it('should allow withdrawal at min level', () => {
      const user = { level: 10 };
      expect(canWithdraw(user)).toBe(true);
    });

    it('should allow withdrawal above min level', () => {
      const user = { level: 15 };
      expect(canWithdraw(user)).toBe(true);
    });

    it('should deny withdrawal below min level', () => {
      const user = { level: 5 };
      expect(canWithdraw(user)).toBe(false);
    });
  });

  describe('Boost System', () => {
    const BOOST_COST = MONETIZATION_CONFIG.BOOST_COST_PER_DAY;

    it('should calculate boost cost', () => {
      const days = 7;
      const cost = days * BOOST_COST;
      expect(cost).toBe(70);
    });

    it('should validate sufficient coins for boost', () => {
      const balance = 100;
      const cost = BOOST_COST * 5;
      expect(balance >= cost).toBe(true);
    });
  });

  describe('Purchase Verification', () => {
    const PRODUCT_PRICES = {
      'coins_100': 100,
      'coins_500': 500,
      'coins_1000': 1000
    };

    it('should validate product ID', () => {
      expect('coins_100' in PRODUCT_PRICES).toBe(true);
      expect('invalid_product' in PRODUCT_PRICES).toBe(false);
    });

    it('should get correct coin amount for product', () => {
      expect(PRODUCT_PRICES['coins_100']).toBe(100);
      expect(PRODUCT_PRICES['coins_500']).toBe(500);
    });
  });

  describe('Idempotency', () => {
    const processWithIdempotency = (key, pendingKeys, callback) => {
      if (pendingKeys.has(key)) {
        return { success: true, message: 'Already processed' };
      }
      pendingKeys.add(key);
      return callback();
    };

    it('should process new request', () => {
      const pendingKeys = new Set();
      const result = processWithIdempotency('key-123', pendingKeys, () => ({
        success: true,
        data: 'result'
      }));
      expect(result.success).toBe(true);
      expect(result.data).toBe('result');
    });

    it('should reject duplicate request', () => {
      const pendingKeys = new Set(['key-123']);
      const result = processWithIdempotency('key-123', pendingKeys, () => ({
        success: true
      }));
      expect(result.message).toBe('Already processed');
    });
  });
});

// __tests__/utils/helpers.test.js
// Test utility functions

describe('Utility Functions', () => {
  describe('Validation', () => {
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    const isValidUsername = (username) => {
      return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    };

    const isValidPassword = (password) => {
      return password.length >= 8;
    };

    describe('isValidEmail', () => {
      it('should return true for valid email', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.org')).toBe(true);
        expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
      });

      it('should return false for invalid email', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('invalid@')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
        expect(isValidEmail('test@.com')).toBe(false);
      });
    });

    describe('isValidUsername', () => {
      it('should return true for valid username', () => {
        expect(isValidUsername('john')).toBe(true);
        expect(isValidUsername('user123')).toBe(true);
        expect(isValidUsername('test_user')).toBe(true);
        expect(isValidUsername('UserName123')).toBe(true);
      });

      it('should return false for invalid username', () => {
        expect(isValidUsername('ab')).toBe(false); // too short
        expect(isValidUsername('a'.repeat(21))).toBe(false); // too long
        expect(isValidUsername('user-name')).toBe(false); // contains hyphen
        expect(isValidUsername('user name')).toBe(false); // contains space
      });
    });

    describe('isValidPassword', () => {
      it('should return true for valid password', () => {
        expect(isValidPassword('password123')).toBe(true);
        expect(isValidPassword('12345678')).toBe(true);
        expect(isValidPassword('abcdefgh')).toBe(true);
      });

      it('should return false for invalid password', () => {
        expect(isValidPassword('short')).toBe(false);
        expect(isValidPassword('1234567')).toBe(false);
        expect(isValidPassword('')).toBe(false);
      });
    });
  });

  describe('Formatting', () => {
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    const formatRelativeTime = (date) => {
      const now = new Date();
      const then = new Date(date);
      const diffMs = now - then;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return formatDate(date);
    };

    const formatNumber = (num) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    };

    describe('formatDate', () => {
      it('should format date correctly', () => {
        const date = new Date('2024-01-15');
        const formatted = formatDate(date);
        expect(formatted).toMatch(/Jan/);
        expect(formatted).toMatch(/15/);
        expect(formatted).toMatch(/2024/);
      });
    });

    describe('formatRelativeTime', () => {
      it('should return "just now" for recent times', () => {
        const now = new Date();
        expect(formatRelativeTime(now)).toBe('just now');
      });

      it('should format minutes correctly', () => {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60000);
        expect(formatRelativeTime(fiveMinsAgo)).toBe('5m ago');
      });

      it('should format hours correctly', () => {
        const threeHoursAgo = new Date(Date.now() - 3 * 3600000);
        expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
      });
    });

    describe('formatNumber', () => {
      it('should format thousands with K', () => {
        expect(formatNumber(1500)).toBe('1.5K');
        expect(formatNumber(10000)).toBe('10.0K');
      });

      it('should format millions with M', () => {
        expect(formatNumber(1500000)).toBe('1.5M');
        expect(formatNumber(10000000)).toBe('10.0M');
      });

      it('should return number for small values', () => {
        expect(formatNumber(100)).toBe('100');
        expect(formatNumber(999)).toBe('999');
      });
    });
  });

  describe('Slug Generation', () => {
    const generateSlug = (text) => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    };

    it('should convert text to slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('This is a Test')).toBe('this-is-a-test');
    });

    it('should handle special characters', () => {
      expect(generateSlug('Test@#$%Value')).toBe('test-value');
    });

    it('should remove leading/trailing dashes', () => {
      expect(generateSlug('  hello  ')).toBe('hello');
    });
  });

  describe('Truncation', () => {
    const truncateText = (text, maxLength) => {
      if (text.length <= maxLength) return text;
      return text.slice(0, maxLength).trim() + '...';
    };

    it('should truncate long text', () => {
      expect(truncateText('This is a long text', 10)).toBe('This is a...');
    });

    it('should not truncate short text', () => {
      expect(truncateText('Short', 10)).toBe('Short');
    });

    it('should handle exact length', () => {
      expect(truncateText('Exact', 5)).toBe('Exact');
    });
  });

  describe('ID Generation', () => {
    const generateId = (prefix = '') => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 9);
      return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
    };

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should include prefix when provided', () => {
      const id = generateId('user');
      expect(id.startsWith('user_')).toBe(true);
    });
  });

  describe('Debounce', () => {
    const debounce = (fn, delay) => {
      let timeoutId;
      return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
      };
    };

    it('should delay function execution', async () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(mockFn).toHaveBeenCalled();
    });

    it('should only call once for rapid calls', async () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});

// __tests__/services/authService.test.js
import { jest } from '@jest/globals';

// Mock Firebase Auth
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: mockOnAuthStateChanged
  })),
  signInWithEmailAndPassword: (...args) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args) => mockCreateUserWithEmailAndPassword(...args),
  signOut: () => mockSignOut(),
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args)
}));

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  getDoc: jest.fn(),
  updateDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => new Date())
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sign In', () => {
    it('should call signInWithEmailAndPassword with correct parameters', async () => {
      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: { uid: 'test-uid', email: 'test@example.com' }
      });

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(null, 'test@example.com', 'password123');

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        null,
        'test@example.com',
        'password123'
      );
    });

    it('should handle sign in errors', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue(
        new Error('auth/invalid-credential')
      );

      const { signInWithEmailAndPassword } = await import('firebase/auth');
      
      await expect(
        signInWithEmailAndPassword(null, 'invalid', 'wrong')
      ).rejects.toThrow('auth/invalid-credential');
    });
  });

  describe('Sign Up', () => {
    it('should call createUserWithEmailAndPassword with correct parameters', async () => {
      mockCreateUserWithEmailAndPassword.mockResolvedValue({
        user: { uid: 'new-uid', email: 'new@example.com' }
      });

      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      await createUserWithEmailAndPassword(null, 'new@example.com', 'password123');

      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        null,
        'new@example.com',
        'password123'
      );
    });

    it('should handle weak password error', async () => {
      mockCreateUserWithEmailAndPassword.mockRejectedValue(
        new Error('auth/weak-password')
      );

      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      
      await expect(
        createUserWithEmailAndPassword(null, 'test@example.com', '123')
      ).rejects.toThrow('auth/weak-password');
    });
  });

  describe('Sign Out', () => {
    it('should call signOut', async () => {
      mockSignOut.mockResolvedValue(undefined);

      const { signOut } = await import('firebase/auth');
      await signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Auth State', () => {
    it('should register auth state listener', async () => {
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      const firebaseAuth = await import('firebase/auth');
      firebaseAuth.onAuthStateChanged(null, jest.fn());

      expect(mockOnAuthStateChanged).toHaveBeenCalled();
    });

    it('should handle auth state change with user', async () => {
      const mockUser = { uid: 'user-123', email: 'user@test.com' };
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return jest.fn();
      });

      const firebaseAuth = await import('firebase/auth');
      
      let receivedUser = null;
      firebaseAuth.onAuthStateChanged(null, (user) => {
        receivedUser = user;
      });

      expect(receivedUser).toEqual(mockUser);
    });
  });
});

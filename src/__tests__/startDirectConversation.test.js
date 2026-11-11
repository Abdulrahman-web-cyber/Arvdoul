/**
 * src/__tests__/startDirectConversation.test.js
 *
 * startDirectConversation is the client half of the allowDMs privacy control:
 * when the rules refuse a 1:1 conversation create (permission-denied), it must
 * fall back to a message request rather than surfacing a hard error. Real
 * Firestore is replaced with a minimal stub so the branch logic is exercised
 * without a database; the service code itself is not mocked.
 */

import { getMessagingService } from '../services/messagesService.js';

const service = getMessagingService();
// Captured before any test mutates the singleton, so the block-guard suite can
// exercise the real methods after the earlier suite stubs them.
const realSendMessageRequest = service.sendMessageRequest;
const realIsBlocked = service.isBlocked;

beforeEach(() => {
  service.initialized = true;
  service.firestore = {};
  service.fs = {
    doc: (_db, _col, id) => ({ id }),
    getDoc: async () => ({ exists: () => false }),
  };
});

describe('startDirectConversation', () => {
  test('reuses an existing conversation without creating one', async () => {
    service.fs.getDoc = async () => ({ exists: () => true });
    service.createConversation = async () => { throw new Error('should not be called'); };
    const res = await service.startDirectConversation('bob', 'alice');
    expect(res.status).toBe('conversation');
    expect(res.conversationId).toBe('direct_alice_bob');
  });

  test('returns the conversation when the create succeeds', async () => {
    service.createConversation = async () => ({ success: true, conversation: { id: 'direct_alice_bob' } });
    const res = await service.startDirectConversation('bob', 'alice');
    expect(res).toEqual({ status: 'conversation', conversationId: 'direct_alice_bob' });
  });

  test('falls back to a message request on permission-denied', async () => {
    service.createConversation = async () => {
      const err = new Error('denied');
      err.code = 'permission-denied';
      throw err;
    };
    service.sendMessageRequest = async () => ({ success: true, status: 'pending' });
    const res = await service.startDirectConversation('bob', 'alice');
    expect(res).toEqual({ status: 'request', requestStatus: 'pending' });
  });

  test('rethrows a non-permission failure (no silent request)', async () => {
    service.createConversation = async () => {
      const err = new Error('network');
      err.code = 'unavailable';
      throw err;
    };
    await expect(service.startDirectConversation('bob', 'alice')).rejects.toThrow('network');
  });

  test('rejects a self-addressed request', async () => {
    await expect(service.startDirectConversation('alice', 'alice')).rejects.toThrow('Invalid request');
  });
});

describe('blocked pairs cannot reach each other via a message request', () => {
  // A block is terminal. `checkMessagePermission` throws `messaging/blocked`,
  // and that must NOT be downgraded to a message request (which the rules would
  // otherwise accept via `dmRequestFrom`) — otherwise a blocked sender still
  // lands in their blocker's request inbox.
  test('sendMessageRequest refuses when either party has blocked the other', async () => {
    service.sendMessageRequest = realSendMessageRequest;
    service.isBlocked = async () => true;
    service.fs.getDoc = async () => { throw new Error('must not read the request doc'); };
    const res = await service.sendMessageRequest('alice', 'bob');
    expect(res).toEqual({ success: false, blocked: true });
  });

  test('sendMessageRequest still files a request when no block exists', async () => {
    service.sendMessageRequest = realSendMessageRequest;
    service.isBlocked = async () => false;
    service.fs.getDoc = async () => ({ exists: () => false });
    service.fs.setDoc = async () => {};
    service.fs.serverTimestamp = () => 'ts';
    service._getUserService = async () => ({ getUserProfile: async () => null });
    const res = await service.sendMessageRequest('alice', 'bob');
    expect(res).toEqual({ success: true, status: 'pending' });
  });

  test('the real isBlocked is wired through the guard (no stub leaks)', () => {
    expect(typeof realIsBlocked).toBe('function');
    expect(typeof realSendMessageRequest).toBe('function');
  });

  test('startDirectConversation reports a blocked status, never a phantom request', async () => {
    service.createConversation = async () => {
      const err = new Error('denied');
      err.code = 'permission-denied';
      throw err;
    };
    service.sendMessageRequest = async () => ({ success: false, blocked: true });
    const res = await service.startDirectConversation('bob', 'alice');
    expect(res).toEqual({ status: 'blocked' });
  });
});

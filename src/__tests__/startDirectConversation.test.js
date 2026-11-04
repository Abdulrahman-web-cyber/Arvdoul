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

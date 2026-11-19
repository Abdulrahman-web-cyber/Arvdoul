/**
 * Part 1 Core Messaging & Security Contracts Tests.
 *
 * Covers:
 * 1. Attachment validation, URL sanitization, Arvdoul link parsing, and
 *    UID-scoped draft storage/purging (`messagingContracts.js`).
 * 2. Service-level safeguards on `deleteMessage`, `editMessage`, and
 *    `forwardMessage` (`messagesService.js`).
 * 3. ConnectionsScreen non-owner level-gating boundary (`ConnectionsScreen.jsx`).
 *
 * @jest-environment jsdom
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import {
  MESSAGING_PART1_LIMITS,
  validateAttachmentFile,
  sanitizeExternalUrl,
  extractFirstSafeUrl,
  buildSharedContentReference,
  resolveSharedContentRoute,
  parseArvdoulShareUrl,
  saveScopedDraft,
  loadScopedDraft,
  clearScopedDraft,
  listDraftConversationMap,
  purgeMessageDraftsForOwner,
} from '../config/messagingContracts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('messagingContracts', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('validateAttachmentFile blocks dangerous executables, SVG, HTML, 0-byte, and >25MB files', () => {
    expect(validateAttachmentFile(null).valid).toBe(false);
    expect(validateAttachmentFile({ name: 'empty.txt', size: 0, type: 'text/plain' }).valid).toBe(false);
    expect(
      validateAttachmentFile({
        name: 'huge.mp4',
        size: MESSAGING_PART1_LIMITS.ATTACHMENT_MAX_BYTES + 1,
        type: 'video/mp4',
      }).valid
    ).toBe(false);
    expect(validateAttachmentFile({ name: 'payload.exe', size: 1024, type: 'application/octet-stream' }).valid).toBe(false);
    expect(validateAttachmentFile({ name: 'xss.svg', size: 512, type: 'image/svg+xml' }).valid).toBe(false);
    expect(validateAttachmentFile({ name: 'page.html', size: 512, type: 'text/html' }).valid).toBe(false);
    expect(validateAttachmentFile({ name: 'script.js', size: 512, type: 'application/javascript' }).valid).toBe(false);
  });

  test('validateAttachmentFile accepts safe images, videos, audio, and documents', () => {
    expect(validateAttachmentFile({ name: 'photo.jpg', size: 2048, type: 'image/jpeg' })).toEqual({
      valid: true,
      kind: 'image',
    });
    expect(validateAttachmentFile({ name: 'doc.pdf', size: 4096, type: 'application/pdf' })).toEqual({
      valid: true,
      kind: 'file',
    });
    expect(validateAttachmentFile({ name: 'note.webm', size: 8192, type: 'audio/webm' })).toEqual({
      valid: true,
      kind: 'audio',
    });
  });

  test('sanitizeExternalUrl and extractFirstSafeUrl reject dangerous schemes and allow https/http', () => {
    expect(sanitizeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(sanitizeExternalUrl('www.arvdoul.com/post/abc123')).toBe('https://www.arvdoul.com/post/abc123');
    expect(extractFirstSafeUrl('Check out https://arvdoul.com/post/p_12345!')).toBe('https://arvdoul.com/post/p_12345');
  });

  test('parseArvdoulShareUrl identifies post, spark, and vibe internal routes only', () => {
    expect(parseArvdoulShareUrl('https://arvdoul.com/post/abc12345')).toEqual({
      contentType: 'post',
      contentId: 'abc12345',
      url: 'https://arvdoul.com/post/abc12345',
    });
    expect(parseArvdoulShareUrl('https://arvdoul.com/video/spk_999')).toEqual({
      contentType: 'spark',
      contentId: 'spk_999',
      url: 'https://arvdoul.com/video/spk_999',
    });
    expect(parseArvdoulShareUrl('https://arvdoul.com/stories/vibe_777')).toEqual({
      contentType: 'vibe',
      contentId: 'vibe_777',
      url: 'https://arvdoul.com/stories/vibe_777',
    });
    expect(parseArvdoulShareUrl('https://evil.example.com/post/abc12345')).toBeNull();

    const ref = buildSharedContentReference('spark', { id: 'spk_999', title: 'Cool clip' });
    expect(resolveSharedContentRoute(ref)).toBe('/video/spk_999');
  });

  test('draft helpers isolate drafts by UID and purge cleanly on account switch or logout', () => {
    saveScopedDraft('uid_a', 'conv_1', { text: 'Hello Alice' });
    saveScopedDraft('uid_b', 'conv_1', { text: 'Hello Bob' });

    expect(loadScopedDraft('uid_a', 'conv_1')?.text).toBe('Hello Alice');
    expect(loadScopedDraft('uid_b', 'conv_1')?.text).toBe('Hello Bob');
    expect(listDraftConversationMap('uid_a')).toMatchObject({
      conv_1: { text: 'Hello Alice' },
    });

    clearScopedDraft('uid_a', 'conv_1');
    expect(loadScopedDraft('uid_a', 'conv_1')).toBeNull();
    expect(loadScopedDraft('uid_b', 'conv_1')?.text).toBe('Hello Bob');

    purgeMessageDraftsForOwner('uid_b');
    expect(loadScopedDraft('uid_b', 'conv_1')).toBeNull();
  });
});

describe('messagesService Part 1 rules', () => {
  test('deleteMessage allows non-sender Delete-for-Me and blocks non-sender Delete-for-Everyone', async () => {
    const { getMessagingService } = await import('../services/messagesService.js');
    const svc = getMessagingService();

    const fakeUpdateDoc = jest.fn().mockResolvedValue(undefined);
    const fakeArrayUnion = jest.fn((v) => ({ __union: v }));
    const fakeDoc = jest.fn((_db, ...segments) => ({ path: segments.join('/') }));
    const fakeGetDoc = jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({
        senderId: 'user_sender',
        createdAt: Date.now(),
        readBy: ['user_sender'],
      }),
    });

    const spyEnsure = jest.spyOn(svc, 'ensureInitialized').mockResolvedValue(true);
    const spyConv = jest.spyOn(svc, 'getConversation').mockResolvedValue({
      success: true,
      conversation: {
        id: 'conv_1',
        type: 'direct',
        participants: ['user_sender', 'user_peer'],
        createdAt: new Date(),
      },
    });
    const spyDec = jest.spyOn(svc, '_decrementUnreadCounter').mockResolvedValue(undefined);

    const origFs = svc.fs;
    svc.fs = {
      ...origFs,
      doc: fakeDoc,
      getDoc: fakeGetDoc,
      updateDoc: fakeUpdateDoc,
      arrayUnion: fakeArrayUnion,
      serverTimestamp: () => 'SERVER_TS',
    };

    try {
      await expect(
        svc.deleteMessage('msg_1', 'conv_1', 'user_peer', true)
      ).rejects.toThrow(/sender or a moderator/i);

      const res = await svc.deleteMessage('msg_1', 'conv_1', 'user_peer', false);
      expect(res).toEqual({ success: true, deleteForEveryone: false });
      expect(fakeUpdateDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          deletedFor: { __union: 'user_peer' },
        })
      );
      expect(spyDec).toHaveBeenCalledWith('conv_1', 'user_peer', 1);
    } finally {
      svc.fs = origFs;
      spyEnsure.mockRestore();
      spyConv.mockRestore();
      spyDec.mockRestore();
    }
  });

  test('editMessage rejects edits past 15-minute window and allows timely sender edits', async () => {
    const { getMessagingService } = await import('../services/messagesService.js');
    const svc = getMessagingService();

    const spyEnsure = jest.spyOn(svc, 'ensureInitialized').mockResolvedValue(true);
    const spyConv = jest.spyOn(svc, 'getConversation').mockResolvedValue({
      success: true,
      conversation: {
        id: 'conv_1',
        type: 'direct',
        participants: ['user_a', 'user_b'],
        createdAt: new Date(),
      },
    });

    const origFs = svc.fs;
    const oldCreatedAt = Date.now() - MESSAGING_PART1_LIMITS.EDIT_WINDOW_MS - 60000;
    const fakeUpdateDoc = jest.fn().mockResolvedValue(undefined);
    const fakeAddDoc = jest.fn().mockResolvedValue({ id: 'hist_1' });

    try {
      svc.fs = {
        ...origFs,
        doc: jest.fn((_db, ...segments) => ({ path: segments.join('/') })),
        collection: jest.fn((_db, ...segments) => ({ path: segments.join('/') })),
        getDoc: jest
          .fn()
          .mockResolvedValue({
            exists: () => true,
            data: () => ({
              senderId: 'user_a',
              type: 'text',
              content: 'Original text',
              createdAt: oldCreatedAt,
            }),
          }),
        serverTimestamp: () => 'SERVER_TS',
      };

      await expect(
        svc.editMessage('msg_old', 'conv_1', 'user_a', 'Late edit')
      ).rejects.toThrow(/15 minutes/i);

      svc.fs = {
        ...svc.fs,
        getDoc: jest
          .fn()
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
              senderId: 'user_a',
              type: 'text',
              content: 'Original text',
              createdAt: Date.now() - 10000,
            }),
          })
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ messageId: 'msg_fresh', text: 'Original text' }),
          }),
        addDoc: fakeAddDoc,
        updateDoc: fakeUpdateDoc,
        query: jest.fn((ref) => ref),
        orderBy: jest.fn(() => 'order'),
        limit: jest.fn(() => 'limit'),
        getDocs: jest.fn().mockResolvedValue({ size: 1, docs: [] }),
      };

      const res = await svc.editMessage('msg_fresh', 'conv_1', 'user_a', 'Updated text');
      expect(res).toEqual({ success: true });
      expect(fakeUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'last_messages/conv_1' }),
        expect.objectContaining({ text: 'Updated text' })
      );
    } finally {
      svc.fs = origFs;
      spyEnsure.mockRestore();
      spyConv.mockRestore();
    }
  });

  test('forwardMessage rejects deleted and view-once messages', async () => {
    const { getMessagingService } = await import('../services/messagesService.js');
    const svc = getMessagingService();
    const spyEnsure = jest.spyOn(svc, 'ensureInitialized').mockResolvedValue(true);
    const spyGetMsg = jest.spyOn(svc, '_getMessage');

    try {
      spyGetMsg.mockResolvedValueOnce({ id: 'm1', isDeleted: true, type: 'text', content: 'x' });
      await expect(
        svc.forwardMessage('c1', 'm1', 'c2', 'user_a')
      ).rejects.toThrow(/deleted/i);

      spyGetMsg.mockResolvedValueOnce({ id: 'm2', isDeleted: false, type: 'view_once', content: '' });
      await expect(
        svc.forwardMessage('c1', 'm2', 'c2', 'user_a')
      ).rejects.toThrow(/view-once/i);
    } finally {
      spyEnsure.mockRestore();
      spyGetMsg.mockRestore();
    }
  });
});

describe('ConnectionsScreen level-gating boundary', () => {
  test('viewer level/creator flags never bleed onto another user profile', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/Profile/ConnectionsScreen.jsx'), 'utf8');
    expect(src).toMatch(/targetProfile\?\.level\s*\?\?\s*\(isOwner\s*\?/);
    expect(src).toMatch(/\(isOwner\s*&&\s*userProfile\?\.isCreator\)/);
  });
});

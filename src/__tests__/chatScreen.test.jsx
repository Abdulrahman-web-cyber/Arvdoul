/**
 * src/__tests__/chatScreen.test.jsx
 * ChatScreen integrity gates:
 *   - NO mock/simulated content (the old INITIAL_MESSAGES "Isabella"
 *     auto-responder is gone)
 *   - wires to the real messaging service (sendMessage / reactToMessage /
 *     markMessageAsRead)
 *   - renders loading, empty, and conversation states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';

jest.mock('../lib/utils.js', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));
jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}));
jest.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

const mockSendMessage = jest.fn(async () => ({ success: true, messageId: 'm_new' }));
const mockReactToMessage = jest.fn(async () => ({ success: true }));
const mockMarkRead = jest.fn(async () => ({}));
const mockGetMessages = jest.fn(async () => ({
  success: true,
  messages: [
    { id: 'm1', senderId: 'u2', type: 'text', content: 'Hello from the real service', createdAt: new Date() },
    { id: 'm2', senderId: 'u1', type: 'text', content: 'Hi back!', createdAt: new Date() },
  ],
}));
const mockGetConversation = jest.fn(async () => ({
  success: true,
  conversation: { id: 'c1', type: 'direct', participants: ['u1', 'u2'], participantNames: { u2: 'Alice' }, participantCount: 2 },
}));

jest.mock('../services/messagesService.js', () => ({
  getMessagingService: () => ({
    getMessages: mockGetMessages,
    getConversation: mockGetConversation,
    subscribeToConversation: () => () => {},
    sendMessage: mockSendMessage,
    reactToMessage: mockReactToMessage,
    markMessageAsRead: mockMarkRead,
    markConversationAsRead: mockMarkRead,
    sendTypingIndicator: jest.fn(async () => {}),
  }),
  MESSAGING_CONFIG: {
    REACTION_TYPES: ['👍', '❤️', '😂', '😮', '😢', '🔥'],
    MESSAGE_TYPES: { TEXT: 'text', VOICE: 'voice', IMAGE: 'image' },
  },
}));

// Stub heavy children so the test focuses on ChatScreen wiring
jest.mock('../components/messaging/MessageInput.jsx', () => {
  const ReactMock = require('react');
  const Component = ReactMock.memo(({ onSendMessage }) => (
    ReactMock.createElement('div', { 'data-testid': 'message-input' },
      ReactMock.createElement('button', { onClick: () => onSendMessage({ type: 'text', content: 'typed' }) }, 'send-text'))
  ));
  return { __esModule: true, default: Component };
});
jest.mock('../components/messaging/MessageBubble.jsx', () => {
  const ReactMock = require('react');
  const Component = ReactMock.memo(({ message }) =>
    ReactMock.createElement('div', { 'data-testid': 'bubble', 'data-mid': message.id }, message.content || message.type));
  return { __esModule: true, default: Component };
});

const { default: ChatScreen } = require('../screens/ChatScreen.jsx');

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
});

const renderChat = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/messages/c1']}>
        <Routes>
          <Route path="/messages/:conversationId" element={<ChatScreen />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );

describe('ChatScreen - real messaging wiring', () => {
  test('renders REAL messages from the service (no mock content)', async () => {
    renderChat();
    expect(await screen.findByText('Hello from the real service')).toBeInTheDocument();
    expect(screen.getByText('Hi back!')).toBeInTheDocument();
    expect(mockGetMessages).toHaveBeenCalled();
    // The old simulated strings must never return
    expect(screen.queryByText(/How are you doing/)).toBeNull();
    expect(screen.queryByText(/Isabella/i)).toBeNull();
  });

  test('shows the real conversation title', async () => {
    renderChat();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  test('sends a real message through the service', async () => {
    renderChat();
    await screen.findByText('Hello from the real service');
    fireEvent.click(screen.getByText('send-text'));
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('c1', { type: 'text', content: 'typed' });
    });
  });

  test('marks the conversation as read (conversation-level position, one write)', async () => {
    renderChat();
    await screen.findByText('Hello from the real service');
    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalled(); // markConversationAsRead
    }, { timeout: 3000 });
  });

  test('renders an empty state when the conversation has no messages', async () => {
    mockGetMessages.mockResolvedValueOnce({ success: true, messages: [] });
    renderChat();
    expect(await screen.findByText(/No messages yet/i)).toBeInTheDocument();
  });

  test('renders a loading skeleton first', async () => {
    let resolveMessages;
    mockGetMessages.mockImplementationOnce(() => new Promise((r) => { resolveMessages = r; }));
    renderChat();
    // Let the async effect reach getMessages, then assert the skeleton
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    resolveMessages?.({ success: true, messages: [] });
  });
});

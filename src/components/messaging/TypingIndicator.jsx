// src/components/messaging/TypingIndicator.jsx
// 🎯 Animated typing indicator component

import React from 'react';
import { cn } from '../../lib/utils';

const TypingIndicator = React.memo(({
  typingUsers = {},
  userNames = {},
  theme,
}) => {
  const typingUserIds = Object.keys(typingUsers).filter(
    (id) => typingUsers[id]?.isTyping
  );

  if (typingUserIds.length === 0) return null;

  const names = typingUserIds.slice(0, 2).map((id) => userNames[id] || 'Someone');
  const moreCount = typingUserIds.length - 2;
  const displayText =
    typingUserIds.length === 1
      ? `${names[0]} is typing`
      : `${names.join(', ')}${moreCount > 0 ? ` and ${moreCount} more` : ''} are typing`;

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2',
      theme === 'dark'
        ? 'text-gray-400'
        : 'text-gray-600'
    )}>
      {/* Animated dots */}
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm">{displayText}</span>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;

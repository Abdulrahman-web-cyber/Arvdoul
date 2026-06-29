// src/components/messaging/EmptyState.jsx
// 🎯 Empty state component for messaging

import React from 'react';
import { cn } from '../../lib/utils';
import { MessageCircle, Plus } from 'lucide-react';

const EmptyState = React.memo(({
  title = 'No messages',
  description = 'Start a conversation with a friend',
  icon: Icon = MessageCircle,
  action,
  actionLabel = 'Start chat',
  theme,
}) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center min-h-96 gap-4 p-6',
      theme === 'dark'
        ? 'bg-gray-900'
        : 'bg-gray-50'
    )}>
      <div className={cn(
        'p-6 rounded-full',
        theme === 'dark'
          ? 'bg-gray-800'
          : 'bg-gray-100'
      )}>
        <Icon className={cn(
          'w-12 h-12',
          theme === 'dark'
            ? 'text-gray-600'
            : 'text-gray-400'
        )} />
      </div>
      
      <div className="text-center gap-2 flex flex-col">
        <h3 className={cn(
          'text-lg font-semibold',
          theme === 'dark'
            ? 'text-white'
            : 'text-gray-900'
        )}>
          {title}
        </h3>
        <p className={cn(
          'text-sm',
          theme === 'dark'
            ? 'text-gray-400'
            : 'text-gray-600'
        )}>
          {description}
        </p>
      </div>

      {action && (
        <button
          onClick={action}
          className={cn(
            'mt-4 px-6 py-2 rounded-full font-medium flex items-center gap-2 transition-colors',
            'bg-gradient-to-r from-purple-600 to-pink-600 text-white',
            'hover:from-purple-700 hover:to-pink-700'
          )}
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;

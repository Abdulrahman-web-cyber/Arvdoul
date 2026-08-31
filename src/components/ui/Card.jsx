// src/components/ui/Card.jsx
/**
 * ARVDOUL DESIGN SYSTEM — CARD PRIMITIVE
 * Guide Part II: variants (elevated / glass / solid / bordered), padding
 * variants (none/sm/md/lg), interactive states (hover/focus/selected),
 * semantic article when interactive, keyboard + focus-visible support.
 *
 * Default variant keeps the previous look so existing screens are unchanged.
 */

import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const variants = {
  elevated:
    'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg',
  glass: 'bg-white/70 dark:bg-gray-900/70 backdrop-blur-md border border-gray-200/70 dark:border-gray-700/50 shadow-lg',
  solid: 'bg-gray-50 dark:bg-gray-800 border border-transparent shadow-sm',
  bordered: 'bg-transparent border-2 border-gray-200 dark:border-gray-700',
};

const paddings = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

/**
 * @param {Object} props
 * @param {'elevated'|'glass'|'solid'|'bordered'} [props.variant='elevated']
 * @param {'none'|'sm'|'md'|'lg'} [props.padding='md']
 * @param {boolean} [props.interactive] - hover/focus affordances + button role
 * @param {boolean} [props.selected] - highlighted selection state
 * @param {Function} [props.onClick]
 */
export const Card = forwardRef(function Card(
  {
    children,
    variant = 'elevated',
    padding = 'md',
    interactive = false,
    selected = false,
    onClick,
    className,
    ...props
  },
  ref
) {
  const isClickable = interactive || Boolean(onClick);
  return (
    <div
      ref={ref}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.(e);
              }
            }
          : undefined
      }
      className={cn(
        'rounded-2xl',
        variants[variant] || variants.elevated,
        paddings[padding] || paddings.md,
        isClickable &&
          'cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        selected && 'ring-2 ring-blue-500',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export const CardContent = ({ children, className, ...props }) => (
  <div className={cn('p-6', className)} {...props}>
    {children}
  </div>
);

Card.displayName = 'Card';

export default Card;

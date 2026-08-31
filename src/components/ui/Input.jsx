// src/components/ui/Input.jsx
/**
 * ARVDOUL DESIGN SYSTEM — INPUT PRIMITIVE
 *
 * Guide Part II coverage:
 *   - types: text, email, password, phone, search, number, otp
 *   - validation states: error, success, warning
 *   - states: required, disabled, readonly, loading
 *   - a11y: label + hint/error wired via aria-describedby, aria-invalid,
 *     aria-required, aria-busy; 44px min touch target
 */

import React, { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';

const TYPE_VARIANTS = {
  text: 'text',
  email: 'email',
  password: 'password',
  phone: 'tel',
  search: 'search',
  number: 'number',
  otp: 'text',
};

const STATE_CLASSES = {
  normal:
    'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30',
  error:
    'border-red-500 bg-red-50/30 dark:bg-red-950/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/30',
  success:
    'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30',
  warning:
    'border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30',
};

const STATE_MESSAGES = {
  error: { text: 'text-red-500', icon: '✕' },
  success: { text: 'text-emerald-500', icon: '✓' },
  warning: { text: 'text-amber-500', icon: '!' },
};

/**
 * @param {Object} props
 * @param {'text'|'email'|'password'|'phone'|'search'|'number'|'otp'} [props.type]
 * @param {'normal'|'error'|'success'|'warning'} [props.validation]
 * @param {string} [props.label] - visible label (required for a11y)
 * @param {string} [props.hint] - helper text below the field
 * @param {string} [props.error] - error message (implies validation='error')
 * @param {boolean} [props.loading]
 * @param {React.ReactNode} [props.leftIcon]
 * @param {React.ReactNode} [props.rightIcon]
 * @param {number} [props.maxLength] - enforced via input maxLength
 */
export const Input = forwardRef(function Input(
  {
    type = 'text',
    validation = 'normal',
    label,
    hint,
    error,
    loading = false,
    disabled = false,
    readOnly = false,
    required = false,
    leftIcon,
    rightIcon,
    className = '',
    id,
    otpLength,
    ...props
  },
  ref
) {
  const autoId = useId();
  const inputId = id || `arv-input-${autoId}`;
  const messageId = `${inputId}-message`;
  const effectiveValidation = error ? 'error' : validation;
  const hasMessage = Boolean(error || hint);

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {label}
          {required && (
            <span aria-hidden="true" className="text-red-500 ml-0.5">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
          >
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={TYPE_VARIANTS[type] || 'text'}
          disabled={disabled || loading}
          readOnly={readOnly}
          required={required}
          aria-required={required || undefined}
          aria-invalid={effectiveValidation === 'error' || undefined}
          aria-busy={loading || undefined}
          aria-describedby={hasMessage ? messageId : undefined}
          inputMode={type === 'number' ? 'numeric' : type === 'phone' ? 'tel' : undefined}
          autoComplete={type === 'email' ? 'email' : type === 'password' ? 'current-password' : undefined}
          maxLength={props.maxLength}
          className={cn(
            'w-full rounded-xl border px-3.5 text-sm text-gray-900 dark:text-gray-100',
            'placeholder:text-gray-400 dark:placeholder:text-gray-600',
            'transition-colors duration-150 outline-none',
            'min-h-[44px]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'read-only:opacity-70 read-only:cursor-default',
            leftIcon ? 'pl-10' : 'pl-3.5',
            rightIcon || loading ? 'pr-10' : 'pr-3.5',
            STATE_CLASSES[effectiveValidation] || STATE_CLASSES.normal
          )}
          {...props}
        />

        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
            <LoadingSpinner size={18} />
          </span>
        )}
        {!loading && rightIcon && (
          <span
            aria-hidden="true"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
          >
            {rightIcon}
          </span>
        )}
        {!loading && !rightIcon && effectiveValidation !== 'normal' && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold',
              STATE_MESSAGES[effectiveValidation]?.text
            )}
          >
            {STATE_MESSAGES[effectiveValidation]?.icon}
          </span>
        )}
      </div>

      {hasMessage && (
        <p
          id={messageId}
          className={cn(
            'mt-1.5 text-xs',
            effectiveValidation === 'error'
              ? 'text-red-500'
              : effectiveValidation === 'success'
                ? 'text-emerald-500'
                : effectiveValidation === 'warning'
                  ? 'text-amber-500'
                  : 'text-gray-500 dark:text-gray-400'
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
});

export default Input;

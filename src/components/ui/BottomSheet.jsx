// src/components/ui/BottomSheet.jsx
import React, { useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const BottomSheet = memo(({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = ['50%'],
  className = '',
  showClose = true,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose?.();
              }
            }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cn(
              'relative z-10 w-full max-w-xl max-h-[88vh]',
              'bg-arvdoul-bg/95 backdrop-blur-2xl border-t border-x border-arvdoul-border shadow-arvdoul-glass rounded-t-arvdoul-xl',
              'flex flex-col overflow-hidden pb-safe-bottom',
              className
            )}
          >
            {/* Drag Handle */}
            <div className="w-full pt-3 pb-2 flex justify-center cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors" />
            </div>

            {/* Header */}
            {(title || showClose) && (
              <div className="flex items-center justify-between px-5 py-3 border-b border-arvdoul-border/60">
                <h3 className="text-base font-semibold text-arvdoul-text-primary font-display">
                  {title}
                </h3>
                {showClose && (
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full text-arvdoul-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
});

BottomSheet.displayName = 'BottomSheet';

export default BottomSheet;

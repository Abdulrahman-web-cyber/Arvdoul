// src/components/Shared/PaymentModal.jsx - ARVDOUL SECURE CHECKOUT (Stripe)
// Real card collection via Stripe Elements → PaymentMethod → server-verified
// purchase. No free-coin paths, no mocks.
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, X, CreditCard, Lock } from 'lucide-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || null;
let stripePromise = null;
if (PUBLISHABLE_KEY) {
  stripePromise = loadStripe(PUBLISHABLE_KEY);
}

const CARD_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#fff',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#f87171' },
  },
};

function CheckoutForm({ amountLabel, onSubmit, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    try {
      // Real card → Stripe PaymentMethod (no raw card data touches our servers).
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
      });
      if (error) throw new Error(error.message);
      await onSubmit(paymentMethod.id);
    } catch (err) {
      toast.error(err?.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
        <CardElement options={CARD_OPTIONS} />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Lock className="w-3.5 h-3.5" /> Secured by Stripe — card details never touch Arvdoul servers.
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="flex-1 py-3 rounded-xl bg-white/10 font-semibold disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={processing || !stripe}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
          {processing ? 'Processing…' : `Pay ${amountLabel}`}
        </button>
      </div>
    </form>
  );
}

export default function PaymentModal({ open, title, amountLabel, onConfirm, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 20 }}
            className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-white/10 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!PUBLISHABLE_KEY ? (
              <div className="text-center py-6">
                <p className="text-amber-400 font-semibold mb-2">Payments are not configured yet</p>
                <p className="text-sm text-gray-400">
                  Set <code className="bg-white/10 px-1.5 py-0.5 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> to enable card
                  purchases. You can still earn coins by watching ads.
                </p>
              </div>
            ) : (
              <Elements stripe={stripePromise}>
                <CheckoutForm amountLabel={amountLabel} onSubmit={onConfirm} onCancel={onClose} />
              </Elements>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

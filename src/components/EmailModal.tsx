import React, { useState } from 'react';
import { X } from 'lucide-react';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (email: string) => void;
  songTitle?: string;
}

export default function EmailModal({ isOpen, onClose, onConfirm, songTitle }: EmailModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    setTimeout(() => {
      onConfirm(email.trim());
      setEmail('');
      setIsSubmitting(false);
    }, 500);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="bg-white border-2 border-deep-navy rounded-xl p-8 max-w-lg w-full shadow-retro-lg animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-bold text-deep-navy">
            Where should we send your high-quality MP3?
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-deep-navy/60 hover:text-deep-navy hover:bg-warm-cream rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {songTitle && (
          <p className="text-deep-navy/80 text-xl mb-6">
            We'll send <strong>"{songTitle}"</strong> to your inbox!
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="Enter your email address..."
              className="w-full bg-warm-cream border-2 border-deep-navy rounded-lg px-6 py-5 text-xl text-deep-navy placeholder-deep-navy/30 focus:outline-none focus:border-burgundy-wine"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-warm-red text-lg font-semibold">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-paypal-gold text-deep-navy font-bold py-5 px-8 rounded-lg text-xl border-2 border-deep-navy shadow-retro hover:shadow-retro-lg hover:bg-warm-amber transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                Proceed to PayPal
              </>
            )}
          </button>
        </form>

        <p className="text-center text-deep-navy/60 text-lg mt-6">
          🔒 Your email is safe. We will never share it.
        </p>
      </div>
    </div>
  );
}
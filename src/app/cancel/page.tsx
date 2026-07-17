'use client';

import { XCircle, ArrowLeft } from 'lucide-react';

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-lg w-full">
        <div className="glass-card p-12 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-8">
            <XCircle className="w-12 h-12 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">
            Payment Cancelled
          </h1>

          <p className="text-white/70 text-lg mb-8">
            No worries! You can try again anytime.
          </p>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Generator
          </button>
        </div>
      </div>
    </div>
  );
}

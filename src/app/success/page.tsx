'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Music, Mail, Clock } from 'lucide-react';

export default function SuccessPage() {
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsProcessing(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-lg w-full">
        <div className="glass-card p-12 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-float">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">
            Payment Successful!
          </h1>

          {isProcessing ? (
            <div className="space-y-4">
              <p className="text-white/70 text-lg">
                Your song is being crafted by AI...
              </p>
              <div className="flex items-center justify-center gap-3 text-white/50">
                <Clock className="w-5 h-5 animate-spin" />
                <span>Processing may take 1-2 minutes</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-white/70 text-lg">
                Your personalized song will be delivered to your email soon!
              </p>
              <div className="glass-card p-6">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <Mail className="w-8 h-8 text-primary-400" />
                  <Music className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-white font-semibold mb-2">What happens next?</h3>
                <ul className="text-white/60 text-sm space-y-2 text-left">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    AI is generating your custom song
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    We will email you the download link
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    Enjoy your personalized masterpiece!
                  </li>
                </ul>
              </div>
            </div>
          )}

          <button
            onClick={() => window.location.href = '/'}
            className="mt-8 w-full btn-primary"
          >
            Create Another Song
          </button>
        </div>
      </div>
    </div>
  );
}

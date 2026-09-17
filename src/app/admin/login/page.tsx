'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';

// Cannot export `metadata` from a client component; the page is excluded from
// indexing by src/app/robots.ts instead.
export default function AdminLoginPage() {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextPath, setNextPath] = useState('/admin');

  // Read ?next= from window.location rather than useSearchParams(): this page has no
  // Suspense boundary, and the hook would break the build.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && next.startsWith('/')) setNextPath(next);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        window.location.href = nextPath;
        return;
      }
      setError(data.error || 'Login failed');
    } catch (err) {
      console.error('[admin:login] error:', err);
      setError('Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-base-100 rounded-2xl shadow-xl p-8 border border-base-300">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-primary" />
            </span>
            <h1 className="font-serif text-2xl font-bold text-base-content">Admin</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-base-content/80 font-semibold mb-2" htmlFor="secret">
                Access secret
              </label>
              <input
                id="secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-white border-2 border-base-300 rounded-lg px-4 py-3 text-base text-base-content placeholder-base-content/30 focus:outline-none focus:border-primary"
                placeholder="Enter admin secret"
                required
              />
            </div>

            {error && (
              <div className="bg-error/10 border border-error/30 rounded-lg p-3">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-white font-bold py-3 px-6 rounded-xl border-2 border-base-content shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-base-content/50 text-xs mt-6 text-center">
            Internal monitoring dashboard. Requires the ADMIN_SECRET configured on the server.
          </p>
        </div>
      </div>
    </div>
  );
}

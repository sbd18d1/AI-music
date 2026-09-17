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
      setError(
        res.status === 401
          ? '口令错误，请重新输入'
          : data.error === 'Admin dashboard is not configured.'
            ? '后台未配置 ADMIN_SECRET，暂时无法访问'
            : '登录失败，请重试'
      );
    } catch (err) {
      console.error('[admin:login] error:', err);
      setError('登录失败，请重试');
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
            <h1 className="font-serif text-2xl font-bold text-base-content">数据监控后台</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-base-content/80 font-semibold mb-2" htmlFor="secret">
                访问口令
              </label>
              <input
                id="secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-white border-2 border-base-300 rounded-lg px-4 py-3 text-base text-base-content placeholder-base-content/30 focus:outline-none focus:border-primary"
                placeholder="请输入后台口令"
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
                  登录中…
                </>
              ) : (
                '登录'
              )}
            </button>
          </form>

          <p className="text-base-content/50 text-xs mt-6 text-center">
            内部数据监控后台，口令由服务器上的 ADMIN_SECRET 环境变量配置。
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <nav className="sticky top-0 z-50 bg-base-100/95 backdrop-blur border-b border-base-300 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo / Brand */}
        <Link href="/" className="flex items-center gap-2 font-serif font-bold text-lg text-primary">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          SmartMusicLab
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-5 text-sm">
          <a href="/#how-it-works" className="text-base-content/70 hover:text-primary transition-colors hidden sm:inline">
            How It Works
          </a>
          <a href="/#pricing" className="text-base-content/70 hover:text-primary transition-colors hidden sm:inline">
            Pricing
          </a>
          <Link href="/terms" className="text-base-content/70 hover:text-primary transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="text-base-content/70 hover:text-primary transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </nav>
  );
}

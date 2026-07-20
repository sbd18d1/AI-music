'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check, X, Music, Clock, ArrowLeft, Download, Mail } from 'lucide-react';

interface Order {
  id: string;
  recipientName: string;
  genre: string;
  status: string;
  audioUrl?: string;
  lyrics?: string;
  title?: string;
  coverImageUrl?: string;
  duration?: string;
  createdAt: string;
  customerEmail?: string | null;
}

export default function OrderStatus() {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);
  const [autoDownloaded, setAutoDownloaded] = useState(false);

  // 邮箱相关状态
  const [emailInput, setEmailInput] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const orderId = urlParams.get('order_id');
    const token = urlParams.get('token');
    const payerId = urlParams.get('PayerID');

    if (!sessionId && !orderId) {
      setError('No order ID found');
      setIsLoading(false);
      return;
    }

    let captureCalled = false;

    const capturePayPalPayment = async () => {
      if (!token || !payerId || !orderId || captureCalled) return;
      captureCalled = true;

      try {
        const response = await fetch('/api/paypal/capture-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId,
            paypalOrderId: token,
            token,
            payerId,
          }),
        });

        const data = await response.json();
        if (data.success) {
          console.log('Payment captured successfully:', data.message);
        } else {
          console.error('Payment capture failed:', data.error);
          captureCalled = false;
        }
      } catch (err) {
        console.error('Error capturing payment:', err);
        captureCalled = false;
      }
    };

    const fetchOrder = async (retryCount: number = 0) => {
      try {
        const params = sessionId ? `session_id=${sessionId}` : `order_id=${orderId}`;
        const response = await fetch(`/api/order-status?${params}`);
        const data = await response.json();

        if (data.success && data.order) {
          setOrder(data.order);

          if (data.order.status === 'pending' && token && payerId) {
            capturePayPalPayment();
          }

          if (data.order.status === 'pending' || data.order.status === 'processing') {
            setTimeout(fetchOrder, 3000);
          } else {
            setPolling(false);
          }
        } else {
          // 如果订单没找到且重试次数少于5次，继续重试
          if (retryCount < 5) {
            console.log(`Order not found, retrying... (${retryCount + 1}/5)`);
            setTimeout(() => fetchOrder(retryCount + 1), 2000);
          } else {
            setError(data.error || 'Order not found');
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch order:', err);
        // 如果网络错误且重试次数少于5次，继续重试
        if (retryCount < 5) {
          setTimeout(() => fetchOrder(retryCount + 1), 2000);
        } else {
          setError('Failed to fetch order status');
          setIsLoading(false);
        }
      }
    };

    fetchOrder();

    return () => {
      setPolling(false);
    };
  }, []);

  // 支付成功后自动下载
  useEffect(() => {
    if (order?.status === 'success' && order?.audioUrl && !autoDownloaded) {
      setAutoDownloaded(true);
      const downloadAudio = async () => {
        try {
          const response = await fetch(`/api/download-audio?url=${encodeURIComponent(order.audioUrl ?? '')}&filename=${encodeURIComponent(order.title ?? 'song')}`);
          if (!response.ok) throw new Error('Failed to download');
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${order.title || 'song'}.mp3`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Auto download error:', error);
        }
      };
      downloadAudio();
    }
  }, [order, autoDownloaded]);

  // 发送邮件到用户输入的邮箱
  const handleSendEmail = async () => {
    if (!order?.audioUrl) {
      setEmailError('Song is not ready yet');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailStatus('sending');
    setEmailError('');

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          audioUrl: order.audioUrl,
          title: order.title,
          lyrics: order.lyrics,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      setEmailStatus('sent');
    } catch (err) {
      console.error('Email send error:', err);
      setEmailStatus('error');
      setEmailError('Failed to send email. Please try again.');
    }
  };

  const getStatusContent = () => {
    if (!order) return null;

    switch (order.status) {
      case 'processing':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-burgundy-wine/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-burgundy-wine animate-spin" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-deep-navy mb-2">AI is Creating Your Song</h3>
            <p className="text-deep-navy/70 text-lg">
              We're generating your personalized {order.genre} song for {order.recipientName}.
              <br />This usually takes 1-2 minutes...
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-warm-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-warm-green" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-deep-navy mb-2">Your Song is Ready!</h3>
            <p className="text-deep-navy/70 text-lg mb-6">
              Here's your personalized {order.genre} song for {order.recipientName}:
            </p>
            
            {order.coverImageUrl && (
              <img src={order.coverImageUrl} alt={order.title || 'Cover'} className="w-32 h-32 rounded-xl object-cover mx-auto mb-4 border-2 border-deep-navy shadow-card" />
            )}
            {order.title && <h4 className="font-serif text-xl font-semibold text-deep-navy mb-4">{order.title}</h4>}
            
            {order.audioUrl && (
              <div className="bg-warm-cream border-2 border-deep-navy rounded-lg p-6 mb-6 shadow-card">
                <audio
                  controls
                  src={order.audioUrl}
                  className="w-full"
                />
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/download-audio?url=${encodeURIComponent(order.audioUrl ?? '')}&filename=${encodeURIComponent(order.title ?? 'song')}`);
                      if (!response.ok) throw new Error('Failed to download');
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${order.title || 'song'}.mp3`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    } catch (error) {
                      console.error('Download error:', error);
                      alert('Download failed. Please try again.');
                    }
                  }}
                  className="inline-flex items-center gap-3 px-8 py-5 bg-paypal-gold text-deep-navy font-bold rounded-lg text-xl border-2 border-deep-navy shadow-retro hover:shadow-retro-lg hover:bg-warm-amber transition-all active:translate-x-1 active:translate-y-1 active:shadow-none mt-6"
                >
                  <Download className="w-7 h-7" />
                  Download Full Song
                </button>
              </div>
            )}
            
            <div className="bg-warm-cream border-2 border-deep-navy rounded-lg p-6 shadow-card">
              <h4 className="font-serif text-xl font-bold text-deep-navy mb-4">🎵 Lyrics</h4>
              {order.lyrics ? (
                <div className="lyrics-container">
                  {order.lyrics.split('\n').map((line: string, index: number) => (
                    line.trim() ? (
                      <p key={index} className="text-center text-deep-navy/80 text-xl leading-relaxed">
                        {line.trim()}
                      </p>
                    ) : null
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-deep-navy/50 text-xl">
                  🎶 This is an instrumental track, no lyrics available
                </div>
              )}
            </div>

            <div className="bg-warm-cream border-2 border-deep-navy rounded-lg p-6 mt-6 shadow-card">
              <h4 className="font-serif text-xl font-bold text-deep-navy mb-4 text-center">🔗 Share This Song</h4>
              <div className="flex justify-center gap-4">
                <a
                  href={`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/song/${order.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-burgundy-wine hover:bg-burgundy-wine/80 text-white font-bold py-3 px-6 rounded-lg border-2 border-deep-navy shadow-retro-sm hover:shadow-retro transition-all text-lg"
                >
                  📤 Share Link
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')}/song/${order.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg border-2 border-deep-navy shadow-retro-sm hover:shadow-retro transition-all text-lg"
                >
                  📘 Facebook
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listen to this special song for ${order.recipientName}!`)})&url=${encodeURIComponent(process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')}/song/${order.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-6 rounded-lg border-2 border-deep-navy shadow-retro-sm hover:shadow-retro transition-all text-lg"
                >
                  🐦 Twitter
                </a>
              </div>
              <p className="text-center text-deep-navy/60 text-lg mt-4">
                Share your unique song with friends and family!
              </p>
            </div>

            {/* 邮箱发送区域 - 用户可主动输入邮箱接收歌曲 */}
            <div className="bg-white border-2 border-deep-navy rounded-lg p-6 mt-6 shadow-card">
              <h4 className="font-serif text-xl font-bold text-deep-navy mb-4 text-center flex items-center justify-center gap-2">
                <Mail className="w-6 h-6" />
                Send Song to Your Email
              </h4>
              {emailStatus === 'sent' ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-warm-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-warm-green" />
                  </div>
                  <p className="text-deep-navy text-xl font-semibold">
                    Email sent successfully!
                  </p>
                  <p className="text-deep-navy/70 text-lg mt-2">
                    Check your inbox at {emailInput}
                  </p>
                  <button
                    onClick={() => {
                      setEmailStatus('idle');
                      setEmailInput('');
                    }}
                    className="mt-4 text-burgundy-wine hover:text-burgundy-wine/80 font-semibold text-lg underline"
                  >
                    Send to another email
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-deep-navy/70 text-lg text-center">
                    Enter your email to receive the MP3 and lyrics directly in your inbox.
                  </p>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setEmailError('');
                      setEmailStatus('idle');
                    }}
                    placeholder="Enter your email address..."
                    className="w-full bg-warm-cream border-2 border-deep-navy rounded-lg px-6 py-5 text-xl text-deep-navy placeholder-deep-navy/30 focus:outline-none focus:border-burgundy-wine"
                    disabled={emailStatus === 'sending'}
                  />
                  {emailError && (
                    <p className="text-warm-red text-lg font-semibold text-center">{emailError}</p>
                  )}
                  <button
                    onClick={handleSendEmail}
                    disabled={emailStatus === 'sending' || !emailInput.trim()}
                    className="w-full bg-burgundy-wine hover:bg-burgundy-wine/80 text-white font-bold py-5 px-8 rounded-lg text-xl border-2 border-deep-navy shadow-retro hover:shadow-retro-lg transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emailStatus === 'sending' ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-6 h-6" />
                        Send to My Email
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 'failed':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-warm-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-10 h-10 text-warm-red" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-deep-navy mb-2">Generation Failed</h3>
            <p className="text-deep-navy/70 text-lg">
              Sorry, we couldn't generate your song. Please try again later or contact support.
            </p>
          </div>
        );

      case 'pending':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-paypal-gold/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-deep-navy" />
            </div>
            <h3 className="font-serif text-2xl font-bold text-deep-navy mb-2">Payment Pending</h3>
            <p className="text-deep-navy/70 text-lg">
              We're waiting for your payment to complete...
            </p>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <h3 className="font-serif text-2xl font-bold text-deep-navy mb-2">Unknown Status</h3>
            <p className="text-deep-navy/70 text-lg">We couldn't determine your order status.</p>
          </div>
        );
    }
  };

  if (isLoading && !order) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-deep-navy animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-center">
          <X className="w-16 h-16 text-warm-red mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-deep-navy mb-2">Error</h2>
          <p className="text-deep-navy/70 text-lg">{error}</p>
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-burgundy-wine hover:text-burgundy-wine/80 font-semibold text-lg"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-cream">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="bg-white border-2 border-deep-navy p-6 md:p-10 shadow-card">
          <div className="flex items-center gap-3 mb-8">
            <a href="/" className="text-deep-navy/60 hover:text-deep-navy transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </a>
            <h1 className="font-serif text-2xl font-bold text-deep-navy">Order Status</h1>
          </div>

          {polling && order?.status === 'processing' && (
            <div className="mb-4 text-center">
              <span className="inline-flex items-center gap-2 text-burgundy-wine text-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                Refreshing...
              </span>
            </div>
          )}

          {getStatusContent()}

          {order && (
            <div className="mt-8 pt-6 border-t-2 border-deep-navy/20">
              <div className="grid grid-cols-2 gap-4 text-lg">
                <div>
                  <p className="text-deep-navy/50">Order ID</p>
                  <p className="text-deep-navy font-mono truncate">{order.id}</p>
                </div>
                <div>
                  <p className="text-deep-navy/50">Recipient</p>
                  <p className="text-deep-navy">{order.recipientName}</p>
                </div>
                <div>
                  <p className="text-deep-navy/50">Genre</p>
                  <p className="text-deep-navy">{order.genre}</p>
                </div>
                <div>
                  <p className="text-deep-navy/50">Created</p>
                  <p className="text-deep-navy">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <a
              href="/?paid=1"
              className="inline-flex items-center gap-2 text-burgundy-wine hover:text-burgundy-wine/80 font-semibold text-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Create Another Song
            </a>
          </div>
        </div>
      </div>

      <style>{`
        .lyrics-container {
          max-height: 300px;
          overflow-y: auto;
          padding-right: 12px;
        }
        .lyrics-container::-webkit-scrollbar {
          width: 12px;
        }
        .lyrics-container::-webkit-scrollbar-track {
          background: rgba(17, 24, 39, 0.1);
          border-radius: 6px;
        }
        .lyrics-container::-webkit-scrollbar-thumb {
          background: rgba(17, 24, 39, 0.4);
          border-radius: 6px;
        }
        .lyrics-container::-webkit-scrollbar-thumb:hover {
          background: rgba(17, 24, 39, 0.6);
        }
        .lyrics-container {
          scrollbar-width: thin;
          scrollbar-color: rgba(17, 24, 39, 0.4) rgba(17, 24, 39, 0.1);
        }
      `}</style>
    </div>
  );
}
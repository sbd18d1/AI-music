'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check, X, Music, Clock, ArrowLeft, Download } from 'lucide-react';

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
}

export default function OrderStatus() {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);
  const [autoDownloaded, setAutoDownloaded] = useState(false);

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

    const fetchOrder = async () => {
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
          setError(data.error || 'Order not found');
          setIsLoading(false);
        }
      } catch (err) {
        setError('Failed to fetch order status');
        setIsLoading(false);
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
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Music, Heart, Zap, CreditCard, Loader2, Check, Rocket, Lock, ArrowRight, Download, Mail, RefreshCw, Share2 } from 'lucide-react';
import { getDeliveryStrategy, DELIVERY_MODE, type DeliveryStrategy, type DeviceSession } from '@/lib/deliveryStrategy';
import SongConfigPanel from '@/components/SongConfigPanel';
import VintageAudioPlayer from '@/components/VintageAudioPlayer';
import ShareModal from '@/components/ShareModal';
import { DEFAULT_SELECTION, isSelectionComplete, deriveGenreFromConfig, type SongConfigSelection } from '@/lib/song-config';
import { getDeviceId } from '@/lib/device-id';
import { canUseNativeShare, openNativeShare, type SharePayload } from '@/lib/share';

type Style = 'Classic Rock' | 'Country & Folk' | 'Blues & Soul' | '60s/70s Pop Ballad';
type ArtistStyle = 'None' | 'Frank Sinatra' | 'Elvis Presley' | 'The Beatles' | 'The Rolling Stones' | 'Bob Dylan' | 'Simon & Garfunkel' | 'Aretha Franklin' | 'Neil Diamond' | 'Johnny Cash';

interface FormData {
  description: string;
  style: Style | '';
  artistStyle: ArtistStyle;
}

const styleOptions: { id: Style; name: string; icon: string; description: string }[] = [
  {
    id: 'Classic Rock',
    name: 'Classic Rock',
    icon: '🎸',
    description: 'Timeless & Powerful',
  },
  {
    id: 'Country & Folk',
    name: 'Country & Folk',
    icon: '🌾',
    description: 'Warm & Storytelling',
  },
  {
    id: 'Blues & Soul',
    name: 'Blues & Soul',
    icon: '🎷',
    description: 'Soulful & Emotional',
  },
  {
    id: '60s/70s Pop Ballad',
    name: '60s/70s Pop Ballad',
    icon: '🎹',
    description: 'Romantic & Nostalgic',
  },
];

const artistOptions: { id: ArtistStyle; name: string; description: string }[] = [
  { id: 'None', name: 'None', description: 'Modern clean production' },
  { id: 'Frank Sinatra', name: 'Frank Sinatra', description: 'Smooth jazz standards & big band' },
  { id: 'Elvis Presley', name: 'Elvis Presley', description: 'Classic Rock & Roll king' },
  { id: 'The Beatles', name: 'The Beatles', description: '60s melodic pop-rock' },
  { id: 'The Rolling Stones', name: 'The Rolling Stones', description: 'Bluesy rock & roll' },
  { id: 'Bob Dylan', name: 'Bob Dylan', description: 'Folk-rock storytelling' },
  { id: 'Simon & Garfunkel', name: 'Simon & Garfunkel', description: 'Harmonic folk-pop' },
  { id: 'Aretha Franklin', name: 'Aretha Franklin', description: 'Soulful R&B vocals' },
  { id: 'Neil Diamond', name: 'Neil Diamond', description: 'Classic pop ballads' },
  { id: 'Johnny Cash', name: 'Johnny Cash', description: 'Deep baritone country' },
];

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    description: '',
    style: 'Classic Rock',
    artistStyle: 'None',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [songTitle, setSongTitle] = useState('');
  const [songLyrics, setSongLyrics] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [songDuration, setSongDuration] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [orderId, setOrderId] = useState('');

  const [userEmail, setUserEmail] = useState('');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isPaidDevice, setIsPaidDevice] = useState(false);
  const [showPaidForm, setShowPaidForm] = useState(false);
  // Whether the device has already used its one free trial generation. Once true,
  // the form must only offer paid generation (no free "Hear a Preview" button).
  const [hasUsedFreeTrial, setHasUsedFreeTrial] = useState(false);

  const [songConfig, setSongConfig] = useState<SongConfigSelection>(DEFAULT_SELECTION);
  const [productPrice, setProductPrice] = useState<string>('$1.00');
  const [priceLoading, setPriceLoading] = useState(false);

  // Coupon (fingerprint-bound) states — no user-facing code, no manual redemption.
  const [couponEarned, setCouponEarned] = useState(false); // shown as "you earned $2 off" toast

  // Share (native sheet / modal) state
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload>({ url: '', title: '', text: '' });



  const deliveryStrategy = getDeliveryStrategy();

  // Price is fixed at $1.00 (matches /api/paypal/create-order PURCHASE_PRICE).
  // A fingerprint-bound $0.50 coupon, when available, auto-deducts to $0.50 at checkout.
  // No dynamic price fetching — PayPal shows the actual total in its checkout window.

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === '1') {
        const performReset = async () => {
          // Read deviceId before clearing localStorage
          const deviceId = localStorage.getItem('device_fingerprint_id');

          // Always call API to clear database records (by deviceId and/or IP)
          try {
            await fetch('/api/reset-trial', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deviceId: deviceId || undefined }),
            });
            console.log('[reset] Trial data cleared from database');
          } catch (e) {
            console.error('[reset] Failed to clear trial data from database:', e);
          }

          // Clear all localStorage keys
          localStorage.removeItem('has_used_free_trial');
          localStorage.removeItem('trial_song_data');
          localStorage.removeItem('instant_song_data');
          localStorage.removeItem('instant_trial_used');
          localStorage.removeItem('session_lock_song_data');
          localStorage.removeItem('session_lock_device_token');
          localStorage.removeItem('session_lock_session');
          localStorage.removeItem('session_lock_has_paid');
          localStorage.removeItem('device_has_paid');
          localStorage.removeItem('trial_order_id');
          localStorage.removeItem('device_fingerprint_id');
          document.cookie = 'has_used_free_trial=; path=/; max-age=0';
          window.history.replaceState({}, document.title, window.location.pathname);
          window.location.reload();
        };

        performReset();
        return;
      }

      if (params.get('paid') === '1') {
        localStorage.setItem('device_has_paid', 'true');
        localStorage.removeItem('instant_song_data');
        localStorage.removeItem('instant_trial_used');
        localStorage.removeItem('trial_song_data');
        localStorage.removeItem('has_used_free_trial');
        localStorage.removeItem('trial_order_id');
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsPaidDevice(true);
        setShowResult(false);
        return;
      }
    }

    deliveryStrategy.init();

    if (localStorage.getItem('device_has_paid') === 'true' || deliveryStrategy.hasPaidBefore()) {
      setIsPaidDevice(true);
      setShowResult(false);
      return;
    }
    
    if (deliveryStrategy.hasUnpaidSong() || deliveryStrategy.getSavedSongData()) {
      // Restoring a saved trial song means this device already used its one free trial,
      // so the form must only offer paid generation from here on.
      setHasUsedFreeTrial(true);
      const savedSong = deliveryStrategy.getSavedSongData();
      if (savedSong) {
        setAudioUrl(savedSong.audioUrl);
        setIsPreview(savedSong.isPreview);
        setSongTitle(savedSong.title);
        setSongLyrics(savedSong.lyrics);
        setCoverImageUrl(savedSong.coverImageUrl);
        // Duration safety: fallback to 180s so player never shows 0:00
        const savedDur = savedSong.duration;
        const savedDurNum = savedDur ? parseFloat(String(savedDur)) : NaN;
        setSongDuration(isFinite(savedDurNum) && savedDurNum > 0 ? String(savedDurNum) : '180');
        setShowResult(true);
      }
      // Restore trial orderId from localStorage so it can be passed to payment flow
      const savedOrderId = localStorage.getItem('trial_order_id');
      if (savedOrderId) {
        setOrderId(savedOrderId);
      }
    }
  }, []);

  const handleGenerateSong = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.description.trim()) {
        alert('Please fill in the description');
        return;
      }

      setIsLoading(true);
    setShowResult(false);
    setErrorMessage('');

    try {
      const derivedGenre = deriveGenreFromConfig(songConfig);
      const deviceId = await getDeviceId();
      const payload = {
        recipientName: 'Gift Recipient',
        personality: formData.description,
        genre: derivedGenre,
        selectedStyle: derivedGenre,
        selectedArtistStyle: 'None',
        songConfig,
        deviceId: deviceId || undefined,
      };

      const response = await fetch('/api/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        if (data.status === 'generating' && data.taskId) {
          setIsLoading(true);
          setShowResult(false);
          await pollGenerationStatus(data.taskId);
        } else if (data.audioUrl) {
          setAudioUrl(data.audioUrl);
          setIsPreview(data.isPreview || true);
          setSongTitle(data.title || '');
          setSongLyrics(data.lyrics || '');
          setCoverImageUrl(data.coverImageUrl || '');
          setSongDuration(data.duration || '');
          setOrderId(data.orderId || '');
          setShowResult(true);
          // This device has now used its one free trial generation.
          setHasUsedFreeTrial(true);

          // Persist trial orderId so it can be passed to the payment flow after refresh
          if (data.orderId) {
            localStorage.setItem('trial_order_id', data.orderId);
          }

          deliveryStrategy.saveSongData({
            audioUrl: data.audioUrl,
            isPreview: data.isPreview || true,
            title: data.title || '',
            lyrics: data.lyrics || '',
            coverImageUrl: data.coverImageUrl || '',
            duration: data.duration || '',
          });
          
          if (DELIVERY_MODE === 'SESSION_LOCK') {
            const deviceToken = deliveryStrategy.getDeviceToken() || deliveryStrategy.generateDeviceToken();
            deliveryStrategy.saveDeviceSession({
              deviceToken,
              audioUrl: data.audioUrl,
              title: data.title || '',
              status: 'unpaid',
            });
          }
        } else {
          let errorMsg = data.error || 'Failed to generate song';
          if (typeof errorMsg === 'object') {
            errorMsg = errorMsg.message || errorMsg.message_cn || JSON.stringify(errorMsg);
          }
          setErrorMessage(errorMsg);
          setShowResult(true);
        }
      } else {
        let errorMsg = data.error || 'Failed to generate song';
        if (typeof errorMsg === 'object') {
          errorMsg = errorMsg.message || errorMsg.message_cn || JSON.stringify(errorMsg);
        }
        setErrorMessage(errorMsg);
        setShowResult(true);
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('An error occurred during generation');
      setShowResult(true);
    } finally {
      setIsLoading(false);
    }
  };

  const pollGenerationStatus = async (taskId: string) => {
    const maxRetries = 120;
    const delay = 5000;
    const pollStartTime = Date.now();

    for (let i = 0; i < maxRetries; i++) {
      const pollT0 = Date.now();
      try {
        console.log(`[poll #${i + 1}] START at +${Date.now() - pollStartTime}ms`);
        const response = await fetch(`/api/generate-status/${taskId}`);
        const data = await response.json();
        const fetchMs = Date.now() - pollT0;
        console.log(`[poll #${i + 1}] response in ${fetchMs}ms, status=${data.status}`);

        if (data.success) {
          if (data.status === 'completed' && data.audioUrl) {
            console.log(`[poll] COMPLETED after ${Date.now() - pollStartTime}ms total, ${i + 1} polls`);
            setAudioUrl(data.audioUrl);
            setIsPreview(data.isPreview || true);
            setSongTitle(data.title || '');
            setSongLyrics(data.lyrics || '');
            setCoverImageUrl(data.coverImageUrl || '');
            setSongDuration(data.duration || '');
            setOrderId(data.orderId || '');
            setShowResult(true);
            // This device has now used its one free trial generation.
            setHasUsedFreeTrial(true);

            // Persist trial orderId so it can be passed to the payment flow after refresh
            if (data.orderId) {
              localStorage.setItem('trial_order_id', data.orderId);
            }

            deliveryStrategy.saveSongData({
              audioUrl: data.audioUrl,
              isPreview: data.isPreview || true,
              title: data.title || '',
              lyrics: data.lyrics || '',
              coverImageUrl: data.coverImageUrl || '',
              duration: data.duration || '',
            });
            
            if (DELIVERY_MODE === 'SESSION_LOCK') {
              const deviceToken = deliveryStrategy.getDeviceToken() || deliveryStrategy.generateDeviceToken();
              deliveryStrategy.saveDeviceSession({
                deviceToken,
                audioUrl: data.audioUrl,
                title: data.title || '',
                status: 'unpaid',
              });
            }
            return;
          } else if (data.status === 'failed') {
            setErrorMessage(data.error || 'Generation failed');
            setShowResult(true);
            return;
          }
        }
        
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        console.error('Polling error:', error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    setErrorMessage('Generation timeout');
    setShowResult(true);
  };

  // ===== PayPal payment flow helpers =====
  // Payload builders used by the purchase buttons to create a PayPal order (and, on
  // capture, reuse the already-generated preview song when paying for the full version).

  // Build payload for "Get Full Song" — reuses the preview song (trialOrderId passed).
  // personality is intentionally left EMPTY: the backend backfills it from the trial
  // order's stored description. This keeps unlocking the already-generated preview
  // independent of the (possibly cleared) description textbox. For a brand-new song,
  // buildBuyNewSongPayload sends the real description instead.
  const buildBuyFullVersionPayload = useCallback((): Record<string, unknown> => {
    const genre = deriveGenreFromConfig(songConfig);
    const trialOrderId = orderId || localStorage.getItem('trial_order_id') || undefined;

    const payload: Record<string, unknown> = {
      recipientName: 'Gift Recipient',
      personality: '',
      genre,
      selectedStyle: genre,
      selectedArtistStyle: 'None',
    };

    if (userEmail) {
      payload.userEmail = userEmail;
    }
    if (trialOrderId) {
      payload.trialOrderId = trialOrderId;
    }

    payload.songConfig = songConfig;
    return payload;
  }, [songConfig, orderId, userEmail]);

  // Build payload for "Generate a Brand New Song" — no trialOrderId, fresh generation after payment.
  const buildBuyNewSongPayload = useCallback((): Record<string, unknown> => {
    const personality = (formData.description || '').trim().slice(0, 900);
    const genre = deriveGenreFromConfig(songConfig);

    const payload: Record<string, unknown> = {
      recipientName: 'Gift Recipient',
      personality,
      genre,
      selectedStyle: genre,
      selectedArtistStyle: 'None',
      // Note: no trialOrderId — backend will generate a brand new song after capture
    };

    if (userEmail) {
      payload.userEmail = userEmail;
    }

    payload.songConfig = songConfig;
    return payload;
  }, [formData, songConfig, userEmail]);

  // Bool: a PayPal redirect is in-flight. Kept SEPARATE from `isLoading` so the
  // pay button does NOT show "Generating/Processing" before payment — we want the
  // user to go straight to PayPal. "Generating" is meant to appear AFTER payment
  // (on the order-status page), not before.
  const [isPaying, setIsPaying] = useState(false);

  const handlePayPalRedirect = useCallback(async (buildPayload: () => Record<string, unknown>) => {
    if (isPaying) return; // guard against double-submit while redirecting
    setIsPaying(true);
    try {
      console.log('[PayPal] Creating order...');
      // Attach the browser fingerprint so the backend can auto-apply the user's
      // fingerprint-bound coupon (if any) and discount the price.
      const deviceId = await getDeviceId();
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildPayload(), deviceId }),
      });
      const data = await response.json();
      // Redirect to PayPal immediately — no "generating" text before payment.
      if (data.success && data.links) {
        // Surface an applied coupon discount before leaving for PayPal.
        if (data.couponApplied) {
          console.log('[PayPal] Coupon applied, amount paid:', data.amountPaid);
        }
        const approvalLink = data.links.find((link: { rel: string }) => link.rel === 'approve');
        if (approvalLink) {
          window.location.href = approvalLink.href;
          return; // page navigates away; no need to reset isPaying
        }
        throw new Error('No PayPal approval link returned');
      }
      throw new Error(data.error || 'Failed to create PayPal order');
    } catch (err) {
      setIsPaying(false);
      console.error('[PayPal] Create order error:', err);
      const msg = err instanceof Error ? err.message : 'Payment error';
      alert('Payment failed: ' + msg);
    }
  }, [isPaying]);

  const handleBuyFullVersion = useCallback(() => {
    // "Get Full Song" unlocks the ALREADY-GENERATED preview song (reusing its
    // trial order) — it does NOT depend on the description textbox. Only require
    // that a generated song actually exists; the backend uses trialOrderId to
    // serve the current preview without regenerating.
    const hasGeneratedSong = !!orderId || !!localStorage.getItem('trial_order_id');
    if (!hasGeneratedSong) {
      alert('No song to unlock yet. Please generate a preview song first.');
      return;
    }
    handlePayPalRedirect(buildBuyFullVersionPayload);
  }, [orderId, handlePayPalRedirect, buildBuyFullVersionPayload]);

  const handleBuyNewSong = useCallback(() => {
    if (!formData.description || !formData.description.trim()) {
      alert('Please fill in the description first');
      return;
    }
    handlePayPalRedirect(buildBuyNewSongPayload);
  }, [formData.description, handlePayPalRedirect, buildBuyNewSongPayload]);

  // ===== Coupon (free-song) flow =====
  // Sharing after unlocking a paid full song earns the user a fingerprint-bound $2
  // coupon ("first share"). It is auto-applied on their NEXT purchase server-side —
  // no code is ever shown or entered. Idempotent: we only surface the "earned" toast.
  const handleIssueCoupon = useCallback(async () => {
    try {
      const deviceId = await getDeviceId();
      const response = await fetch('/api/coupon/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      const data = await response.json();
      if (data.success) {
        setCouponEarned(true); // show "you earned $0.50 off your next song"
      } else {
        console.warn('[coupon] issue returned:', data);
      }
    } catch (err) {
      console.error('[coupon] issue error:', err);
    }
  }, []);

  // Unified share: try the OS native share sheet first (mobile — lets the user pick
  // Facebook/WhatsApp/Messages/etc.), and fall back to an in-app platform modal on
  // desktop where navigator.share isn't available. Awarding the coupon fires whenever
  // the user actually completes/makes a share choice.
  const handleOpenShare = useCallback((payload: SharePayload) => {
    openNativeShare(payload).then((usedNative) => {
      if (!usedNative) {
        setSharePayload(payload);
        setShareOpen(true);
      } else {
        handleIssueCoupon();
      }
    });
  }, [handleIssueCoupon]);

  // "Generate a brand new song" from the trial results area: scroll back to the
  // always-visible description form so the user can revise their prompt, then pay
  // to generate a brand new song (which replaces the free trial one).
  const handleGenerateNew = useCallback(() => {
    setPaymentComplete(false);
    const formEl = document.getElementById('pricing');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleDownload = () => {
    if (deliveryStrategy.canDownload()) {
      downloadAudio();
    } else {
      // Payment required — trigger the Create Full Song checkout instead.
      handleBuyFullVersion();
    }
  };

  const downloadAudio = async () => {
    try {
      const response = await fetch(`/api/download-audio?url=${encodeURIComponent(audioUrl ?? '')}&filename=${encodeURIComponent(songTitle ?? 'song')}`);
      if (!response.ok) throw new Error('Failed to download');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${songTitle || 'song'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed. Please try again.');
    }
  };

  const handleResetDevice = () => {
    deliveryStrategy.clearSongData();
    setShowResult(false);
    setAudioUrl('');
    setSongTitle('');
    setSongLyrics('');
    setCoverImageUrl('');
    setSongDuration('');
    setFormData({
      description: '',
      style: 'Classic Rock',
      artistStyle: 'None',
    });
  };

  return (
    <div className="min-h-screen bg-base-100 font-sans leading-body">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <header className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-3 bg-base-200 border border-base-300 px-5 py-2 rounded-full mb-5 shadow-sm">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-base-content/80 font-medium text-base">AI-Powered Music Creation for Every Generation</span>
          </div>
          <h1 className="font-serif text-2xl md:text-3xl lg:text-4xl font-bold text-base-content mb-5 leading-tight">
            Create Personalized Songs
          </h1>
          <p className="text-lg md:text-xl text-base-content/80 max-w-2xl mx-auto leading-relaxed">
            Turn your memories into beautiful melodies. AI creates unique songs for your loved ones in classic styles you grew up with.
          </p>
        </header>

        <div id="how-it-works" className="bg-base-200/80 border border-base-300 rounded-2xl p-4 shadow-vintage mb-10 scroll-mt-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Music className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-serif text-sm font-semibold text-base-content line-clamp-1">AI-Generated</h3>
                <p className="text-base-content/60 text-xs line-clamp-2">Unique songs crafted by advanced AI</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Heart className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="font-serif text-sm font-semibold text-base-content line-clamp-1">Personalized</h3>
                <p className="text-base-content/60 text-xs line-clamp-2">Custom lyrics based on your story</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-base-content" />
              </div>
              <div>
                <h3 className="font-serif text-sm font-semibold text-base-content line-clamp-1">Instant Delivery</h3>
                <p className="text-base-content/60 text-xs line-clamp-2">Get your song immediately</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-10">
          <div className="bg-base-200/80 border border-base-300 p-5 md:p-8 shadow-vintage rounded-2xl">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center font-serif font-bold text-lg">AI</span>
                <p className="text-base-content/80 font-semibold text-lg">What you tell the AI:</p>
              </div>
              <p className="text-base-content text-base md:text-lg leading-relaxed pl-14 italic">
                "I want a warm, nostalgic Country song for my husband Bob's 70th birthday. He spent 40 years as a petroleum pipe-fitter in Houston and now loves fishing on Lake Conroe. Please thank him for working so hard for our three kids, and let him know how much we love him."
              </p>
              <div className="flex items-center gap-3 pl-14 pt-2">
                <Music className="w-5 h-5 text-primary" />
                <span className="text-base-content/80 text-lg font-medium">Music Style: Warm Country Folk</span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t-2 border-base-300/20">
              <h4 className="font-serif text-lg font-bold text-base-content mb-3 text-center">🎵 Listen to the Generated Song</h4>
              <VintageAudioPlayer 
                src="/test-song.mp3" 
                controlsList="nodownload" 
                isPreview={false}
              />
              <div className="mt-3 text-center">
                <p className="text-base-content/80 text-base">Song Title: <strong className="text-base-content">Bob on Conroe</strong></p>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t-2 border-base-300/20">
              <div className="flex items-start gap-4">
                <Lock className="w-6 h-6 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-base-content/80 text-base leading-relaxed">
                    <strong className="text-base-content">100% Personal Copyright:</strong> You own your custom song forever. Download the high-quality MP3 to play in the car, share on Facebook, or email to family!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form id="pricing" className="bg-base-200/80 border border-base-300 p-5 md:p-8 shadow-vintage rounded-2xl scroll-mt-20">
            <h2 className="font-serif text-xl md:text-2xl font-bold text-base-content text-center mb-6">
              Create Your Song
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-base-content/80 font-semibold mb-3 text-lg">
                  What's this song about?
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white border-2 border-base-300 rounded-lg px-5 py-4 text-base text-base-content placeholder-base-content/30 focus:outline-none focus:border-primary resize-none"
                  rows={4}
                  placeholder="Example: A song for my grandson Jack's graduation, or my golden wedding anniversary with Mary..."
                  required
                />
              </div>

              <SongConfigPanel
                selection={songConfig}
                onChange={setSongConfig}
              />

              <div>
                <label className="block text-base-content/80 font-semibold mb-3 text-lg">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-white border-2 border-base-300 rounded-lg px-5 py-4 text-base text-base-content placeholder-base-content/30 focus:outline-none focus:border-primary"
                  placeholder="Enter your email to receive the song..."
                />
                <p className="text-base-content/60 text-sm mt-2">
                  💡 Optional: Provide your email to receive the MP3 directly in your inbox after purchase.
                </p>
              </div>

              <div className="space-y-4">
                {!hasUsedFreeTrial && !isPaidDevice && (
                <button
                  type="button"
                  onClick={handleGenerateSong}
                  disabled={isLoading}
                  className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl text-lg border-2 border-base-content shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Generating... (est. 2-3 min)
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" />
                      Hear a Free Preview
                    </>
                  )}
                </button>
                )}
                {!hasUsedFreeTrial && !isPaidDevice && (
                  <p className="text-center text-base-content/60 text-sm mt-1">
                    Listen to a short preview. No download.
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleBuyNewSong}
                  // Use isPaying (pay-only), NOT isLoading (free-preview shared state),
                  // so we DON'T flash "Generating" before payment. Going straight to PayPal.
                  disabled={isPaying}
                  className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl text-lg border-2 border-base-content shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Redirecting to payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-6 h-6" />
                      Create Full Song ({productPrice})
                    </>
                  )}
                </button>
                <p className="text-center text-base-content/60 text-sm mt-1">
                  Full song with MP3 download. One-time payment.
                </p>

                {couponEarned && (
                  <div className="mt-4 border-2 border-success bg-success/10 rounded-lg p-3 text-center">
                    <p className="font-semibold text-success">🎉 You earned $0.50 off! Applied automatically at checkout.</p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-base-content/60 text-sm mt-5">
              Secure payment via PayPal or credit card. No subscription, one-time purchase only.
            </p>
          </form>

        {showResult && !isPaidDevice && (
          <div className="bg-base-200/80 border border-base-300 p-6 md:p-10 shadow-vintage rounded-2xl mt-8">
            {DELIVERY_MODE === 'SESSION_LOCK' && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleResetDevice}
                  className="inline-flex items-center gap-2 text-base-content/60 hover:text-base-content text-lg font-medium"
                >
                  <RefreshCw className="w-5 h-5" />
                  Create Another Song
                </button>
              </div>
            )}
            
            {errorMessage ? (
              <div className="text-center">
                <div className="text-5xl mb-4">❌</div>
                <h3 className="font-serif text-2xl font-bold text-error mb-3">Generation Failed</h3>
                <p className="text-base-content/80 text-xl">{errorMessage}</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="font-serif text-2xl font-bold text-success mb-3">
                  {paymentComplete ? 'Payment Successful!' : 'Song Generated!'}
                </h3>
                <p className="text-base-content/80 text-xl mb-6">
                  {paymentComplete ? (
                    'Check your email for the download link!'
                  ) : (
                    'Your personalized song is ready! Download the high-quality MP3.'
                  )}
                </p>
                <div className="space-y-6">
                  {coverImageUrl && (
                    <div className="flex justify-center">
                      <img src={coverImageUrl} alt={songTitle || 'Cover'} className="w-48 h-48 rounded-xl object-cover border-2 border-base-300 shadow-md" />
                    </div>
                  )}
                  {songTitle && <h3 className="font-serif text-2xl font-bold text-base-content text-center">{songTitle}</h3>}
                  
                  <div className="bg-base-200/80 border border-base-300 rounded-xl p-6">
                    <VintageAudioPlayer 
                      src={audioUrl} 
                      controlsList={deliveryStrategy.shouldHideDownloadButton() ? 'nodownload' : ''}
                      isPreview={deliveryStrategy.shouldHideDownloadButton()}
                      duration={songDuration}
                    />
                  </div>

                  <div className="bg-base-200/80 border border-base-300 rounded-xl p-6 shadow-md">
                    <h4 className="font-serif text-xl font-bold text-base-content mb-4 text-center">🎵 Lyrics</h4>
                    {songLyrics ? (
                      <div className="lyrics-container">
                        <div className="space-y-4">
                          {songLyrics.split('\n').map((line, index) => (
                            line.trim() ? (
                              <p key={index} className="text-center text-base-content/80 text-xl leading-relaxed">
                                {line.trim()}
                              </p>
                            ) : null
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-base-content/60 text-xl">
                        🎶 This is an instrumental track, no lyrics available
                      </div>
                    )}
                  </div>

                  {!paymentComplete && (
                    <div className="bg-base-200/80 border border-base-300 rounded-xl p-6">
                      <h4 className="font-serif text-xl font-bold text-base-content mb-4 text-center">📧 Email (Optional)</h4>
                      <p className="text-base-content/80 text-lg text-center mb-4">
                        Enter your email to receive the song directly after purchase
                      </p>
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        className="w-full bg-white border-2 border-base-300 rounded-xl px-6 py-5 text-xl text-base-content placeholder-base-content/30 focus:outline-none focus:border-primary"
                        placeholder="your@email.com"
                      />
                    </div>
                  )}

                  {orderId && paymentComplete && (
                    <div className="bg-base-200/80 border border-base-300 rounded-xl p-6">
                      <h4 className="font-serif text-xl font-bold text-base-content mb-4 text-center">🔗 Share This Song</h4>
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenShare({
                              url: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/song/${orderId}`,
                              title: `🎵 ${songTitle || 'A custom song'} — made on Smart Music Lab`,
                              text: `Listen to this special song for ${songTitle || 'someone special'}! Made with love on Smart Music Lab.`,
                            })
                          }
                          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-xl border-2 border-base-content shadow-sm transition-all text-lg"
                        >
                          <Share2 className="w-5 h-5" />
                          Share to Friends
                        </button>
                      </div>
                      <p className="text-center text-base-content/60 text-lg mt-4">
                        Share via Messages, Facebook, WhatsApp &amp; more — share and earn $0.50 off your next song!
                      </p>

                      {couponEarned && (
                        <div className="mt-6 border-2 border-success bg-success/10 rounded-xl p-4 text-center">
                          <p className="font-serif text-xl font-bold text-success">🎉 You earned $0.50 off!</p>
                          <p className="text-base-content/70 text-sm">
                            Applied automatically to your next song.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!paymentComplete && (
                    <>
                      <button
                        type="button"
                        onClick={handleBuyFullVersion}
                        disabled={isPaying}
                        className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl text-lg border-2 border-base-content shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
                      >
                        {isPaying ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Redirecting to payment...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-6 h-6" />
                            Get Full Song ({productPrice})
                          </>
                        )}
                      </button>

                      <div className="mt-6 border-t border-base-300 pt-6 text-center">
                        <p className="text-base-content/50 text-sm mb-3">Not satisfied with this song?</p>
                        <div className="inline-block text-left w-full max-w-md mx-auto">
                          <p className="text-base-content/50 text-xs mb-3">
                            Use the form above to write a new description, then pay to generate a brand new song (it replaces this preview).
                          </p>
                          <button
                            type="button"
                            onClick={handleGenerateNew}
                            disabled={isLoading}
                            className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl border-2 border-base-content shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
                          >
                            <RefreshCw className="w-5 h-5" />
                            Generate a Brand New Song ({productPrice})
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="text-center mt-12 md:mt-16">
          <p className="text-base-content/60 text-lg">Made with ❤️ for music lovers everywhere</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <a href="mailto:support@smartmusiclab.com" className="text-base-content/80 hover:text-primary font-medium transition-colors">
              support@smartmusiclab.com
            </a>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-base-content/50 flex-wrap">
            <a href="/pricing" className="hover:text-primary transition-colors">Pricing</a>
            <span className="text-base-content/30">·</span>
            <a href="/terms" className="hover:text-primary transition-colors">Terms of Service</a>
            <span className="text-base-content/30">·</span>
            <a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a>
            <span className="text-base-content/30">·</span>
            <a href="/refund" className="hover:text-primary transition-colors">Refund Policy</a>
          </div>
          <a href="/?reset=1" className="inline-block mt-4 text-base-content/30 hover:text-base-content/60 text-base underline">
            Reset (Clear all data)
          </a>
          <div className="mt-6 pt-4 border-t border-base-300 text-xs text-base-content/40 space-y-1">
            <p className="font-medium">Smart Music Lab is owned and operated by Qingdao Dianliu Information Technology Co., Ltd.</p>
            <p>Company Registration No.: 91370213MAD9GFBR8X</p>
            <p>Business Address: 303-30, Building 1, No. 568 Jiushuidong Road, Licang District, Qingdao City, Shandong Province</p>
            <p>Contact Email: <a href="mailto:support@smartmusiclab.com" className="hover:text-primary transition-colors">support@smartmusiclab.com</a></p>
            <p className="mt-2">© 2025 Smart Music Lab. All rights reserved.</p>
          </div>
        </footer>
      </div>

      {/* Share modal (desktop fallback when the OS native sheet isn't available) */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        payload={sharePayload}
        onShared={handleIssueCoupon}
      />


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
        .style-card {
          transition: all 0.15s ease;
        }
        .style-card:active {
          transform: translate(2px, 2px);
        }
      `}</style>
    </div>
  );
}
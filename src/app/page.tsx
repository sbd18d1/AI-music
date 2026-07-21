'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Music, Heart, Zap, CreditCard, Loader2, Check, Rocket, Lock, ArrowRight, Download, Mail, RefreshCw } from 'lucide-react';
import { getDeliveryStrategy, DELIVERY_MODE, type DeliveryStrategy, type DeviceSession } from '@/lib/deliveryStrategy';
import EmailModal from '@/components/EmailModal';
import SongConfigPanel from '@/components/SongConfigPanel';
import VintageAudioPlayer from '@/components/VintageAudioPlayer';
import { DEFAULT_SELECTION, isSelectionComplete, deriveGenreFromConfig, type SongConfigSelection } from '@/lib/song-config';

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

const PAYMENT_PROVIDER = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || 'paypal';

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

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isPaidDevice, setIsPaidDevice] = useState(false);
  const [showPaidForm, setShowPaidForm] = useState(false);

  const [songConfig, setSongConfig] = useState<SongConfigSelection>(DEFAULT_SELECTION);
  
  const deliveryStrategy = getDeliveryStrategy();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === '1') {
        localStorage.removeItem('has_used_free_trial');
        localStorage.removeItem('trial_song_data');
        localStorage.removeItem('instant_song_data');
        localStorage.removeItem('session_lock_song_data');
        localStorage.removeItem('session_lock_device_token');
        localStorage.removeItem('session_lock_session');
        localStorage.removeItem('session_lock_has_paid');
        localStorage.removeItem('device_has_paid');
        document.cookie = 'has_used_free_trial=; path=/; max-age=0';
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
        return;
      }

      if (params.get('paid') === '1') {
        localStorage.setItem('device_has_paid', 'true');
        localStorage.removeItem('instant_song_data');
        localStorage.removeItem('instant_trial_used');
        localStorage.removeItem('trial_song_data');
        localStorage.removeItem('has_used_free_trial');
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
      const savedSong = deliveryStrategy.getSavedSongData();
      if (savedSong) {
        setAudioUrl(savedSong.audioUrl);
        setIsPreview(savedSong.isPreview);
        setSongTitle(savedSong.title);
        setSongLyrics(savedSong.lyrics);
        setCoverImageUrl(savedSong.coverImageUrl);
        setSongDuration(savedSong.duration);
        setShowResult(true);
      }
    }
  }, []);

  const handleGenerateSong = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description) {
        alert('Please fill in the description');
        return;
      }

      setIsLoading(true);
    setShowResult(false);
    setErrorMessage('');

    try {
      const derivedGenre = deriveGenreFromConfig(songConfig);
      const payload = {
        recipientName: 'Gift Recipient',
        personality: formData.description,
        genre: derivedGenre,
        selectedStyle: derivedGenre,
        selectedArtistStyle: 'None',
        songConfig,
      };

      const response = await fetch('/api/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success && data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setIsPreview(data.isPreview || true);
        setSongTitle(data.title || '');
        setSongLyrics(data.lyrics || '');
        setCoverImageUrl(data.coverImageUrl || '');
        setSongDuration(data.duration || '');
        setOrderId(data.orderId || '');
        setShowResult(true);
        
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
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('An error occurred during generation');
      setShowResult(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyWithEmail = (email: string) => {
    setUserEmail(email);
    setShowEmailModal(false);
    handleBuyFullVersion(email);
  };

  const handleBuyFullVersion = (email?: string) => {
    const userEmailAddress = email || userEmail || undefined;
    const personality = (formData.description || 'Custom song request').slice(0, 900);
    const genre = deriveGenreFromConfig(songConfig);

    setIsLoading(true);

    const payload: Record<string, unknown> = {
      recipientName: 'Gift Recipient',
      personality: personality,
      genre: genre,
      selectedStyle: genre,
      selectedArtistStyle: 'None',
    };

    if (userEmailAddress) {
      payload.userEmail = userEmailAddress;
    }

    payload.songConfig = songConfig;

    if (PAYMENT_PROVIDER === 'paypal') {
      fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((response) => response.json())
        .then((data) => {
          setIsLoading(false);
          if (data.success && data.links) {
            const approvalLink = data.links.find((link: { rel: string }) => link.rel === 'approve');
            if (approvalLink) {
              window.location.href = approvalLink.href;
            } else {
              alert('Failed to get PayPal approval link');
            }
          } else {
            alert('Failed to create PayPal order: ' + (data.error || 'Unknown error'));
          }
        })
        .catch((error) => {
          setIsLoading(false);
          console.error('Error:', error);
          alert('An error occurred');
        });
    } else {
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((response) => response.json())
        .then((data) => {
          setIsLoading(false);
          if (data.url) {
            window.location.href = data.url;
          } else {
            alert('Failed to create checkout session: ' + (data.error || 'Unknown error'));
          }
        })
        .catch((error) => {
          setIsLoading(false);
          console.error('Error:', error);
          alert('An error occurred');
        });
    }
  };

  const handleDownload = () => {
    if (deliveryStrategy.canDownload()) {
      downloadAudio();
    } else {
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

        <div className="bg-base-200/80 border border-base-300 rounded-2xl p-4 shadow-vintage mb-10">
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

        {!showResult && (
          <form className="bg-base-200/80 border border-base-300 p-5 md:p-8 shadow-vintage rounded-2xl">
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
                {!isPaidDevice && (
                <button
                  type="button"
                  onClick={handleGenerateSong}
                  disabled={isLoading}
                  className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl text-lg border-2 border-base-content shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" />
                      Hear a Free Preview
                    </>
                  )}
                </button>
                )}
                {!isPaidDevice && (
                  <p className="text-center text-base-content/60 text-sm mt-1">
                    Listen to a short preview. No download.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleBuyFullVersion()}
                  disabled={isLoading}
                  className="w-full bg-secondary text-base-content font-bold py-4 px-6 rounded-xl text-lg border-2 border-base-content shadow-sm hover:bg-secondary/90 transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-6 h-6" />
                      Create Full Song ($4.99)
                    </>
                  )}
                </button>
                <p className="text-center text-base-content/60 text-sm mt-1">
                  Full song with MP3 download. One-time payment.
                </p>
              </div>
            </div>

            <p className="text-center text-base-content/60 text-sm mt-5">
              Secure payment via {PAYMENT_PROVIDER === 'paypal' ? 'PayPal' : 'Stripe'}. No subscription, one-time purchase only.
            </p>
          </form>
        )}

        {showResult && (
          <div className="bg-base-200/80 border border-base-300 p-6 md:p-10 shadow-vintage rounded-2xl">
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
                    />
                    
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-3 px-8 py-5 bg-secondary text-base-content font-bold rounded-xl text-xl border-2 border-base-content shadow-sm hover:bg-secondary/90 transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                      >
                        <Download className="w-7 h-7" />
                        {deliveryStrategy.canDownload() ? 'Download MP3 Now' : 'Download High-Quality MP3 ($4.99)'}
                      </button>
                    </div>
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
                      <div className="flex justify-center gap-4">
                        <a
                          href={`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/song/${orderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl border-2 border-base-content shadow-sm transition-all text-lg"
                        >
                          📤 Share Link
                        </a>
                        <a
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')}/song/${orderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl border-2 border-blue-800 shadow-md transition-all text-lg"
                        >
                          📘 Facebook
                        </a>
                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listen to this special song for ${songTitle || 'someone special'}!`)})&url=${encodeURIComponent(process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')}/song/${orderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-6 rounded-xl border-2 border-sky-700 shadow-md transition-all text-lg"
                        >
                          🐦 Twitter
                        </a>
                      </div>
                      <p className="text-center text-base-content/60 text-lg mt-4">
                        Share your unique song with friends and family!
                      </p>
                    </div>
                  )}

                  {!paymentComplete && (
                    <button
                      type="button"
                      onClick={() => handleBuyFullVersion()}
                      disabled={isLoading}
                      className="w-full bg-secondary text-base-content font-bold py-5 px-6 rounded-xl text-xl border-2 border-base-content shadow-sm hover:bg-secondary/90 transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-6 h-6" />
                          Get Full Song ($4.99)
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="text-center mt-12 md:mt-16">
          <p className="text-base-content/60 text-lg">Made with ❤️ for music lovers everywhere</p>
          <a href="/?reset=1" className="inline-block mt-4 text-base-content/30 hover:text-base-content/60 text-base underline">
            Reset (Clear all data)
          </a>
        </footer>
      </div>

      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onConfirm={handleBuyWithEmail}
        songTitle={songTitle || 'your personalized song'}
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
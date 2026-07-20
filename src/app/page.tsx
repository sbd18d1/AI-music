'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Music, Heart, Zap, CreditCard, Loader2, Check, Rocket, Lock, ArrowRight, Download, Mail, RefreshCw } from 'lucide-react';
import { getTheme } from '@/lib/theme';
import { getDeliveryStrategy, DELIVERY_MODE, type DeliveryStrategy, type DeviceSession } from '@/lib/deliveryStrategy';
import EmailModal from '@/components/EmailModal';
import SongConfigPanel from '@/components/SongConfigPanel';
import { DEFAULT_SELECTION, isSelectionComplete, deriveGenreFromConfig, type SongConfigSelection } from '@/lib/song-config';

const theme = getTheme();

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

  // 多维度歌曲配置选择
  const [songConfig, setSongConfig] = useState<SongConfigSelection>(DEFAULT_SELECTION);
  
  const deliveryStrategy = getDeliveryStrategy();

  useEffect(() => {
    // 支持 URL 参数 ?reset=1 清除所有本地状态（用于测试）
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === '1') {
        // 清除所有相关的 localStorage
        localStorage.removeItem('has_used_free_trial');
        localStorage.removeItem('trial_song_data');
        localStorage.removeItem('instant_song_data');
        localStorage.removeItem('session_lock_song_data');
        localStorage.removeItem('session_lock_device_token');
        localStorage.removeItem('session_lock_session');
        localStorage.removeItem('session_lock_has_paid');
        localStorage.removeItem('device_has_paid');
        // 清除 cookie
        document.cookie = 'has_used_free_trial=; path=/; max-age=0';
        // 清除 URL 参数
        window.history.replaceState({}, document.title, window.location.pathname);
        // 刷新页面
        window.location.reload();
        return;
      }

      // 支付完成后返回主页：清除试用歌曲，标记设备已付费
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

    // 检测设备是否已付费（支付完成后返回主页或再次访问）
    if (localStorage.getItem('device_has_paid') === 'true' || deliveryStrategy.hasPaidBefore()) {
      setIsPaidDevice(true);
      setShowResult(false);
      return;
    }
    
    if (deliveryStrategy.hasUnpaidSong() || deliveryStrategy.getSavedSongData()) {
      // 有未付费的歌曲：恢复显示
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

    // 校验：每个维度都必须选择一项（互斥规则已由单选按钮保证）
    if (!isSelectionComplete(songConfig)) {
      alert('Please complete all 5 song configuration dimensions (Style, Audience, Vocal, Vibe, Occasion)');
      return;
    }

    setIsLoading(true);
    setShowResult(false);
    setErrorMessage('');

    try {
      // 从多维度配置推导 genre（兼容旧版字段）
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
    // 邮箱为可选，未提供时也允许直接付款
    const userEmailAddress = email || userEmail || undefined;

    // 如果表单为空（如试用后刷新页面），使用已保存的歌曲信息
    const personality = (formData.description || 'Custom song request').slice(0, 900);
    // 从多维度配置推导 genre（兼容旧版字段）
    const genre = deriveGenreFromConfig(songConfig);

    setIsLoading(true);

    const payload: Record<string, unknown> = {
      recipientName: 'Gift Recipient',
      personality: personality,
      genre: genre,
      selectedStyle: genre,
      selectedArtistStyle: 'None',
    };

    // 仅在用户提供邮箱时才带上
    if (userEmailAddress) {
      payload.userEmail = userEmailAddress;
    }

    // 带上多维度配置，确保整曲生成沿用试听时的选择
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
      // 已付费：直接下载
      downloadAudio();
    } else {
      // 未付费：直接发起支付（邮箱可选，在表单中填写）
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
    <div className={`min-h-screen ${theme.background} font-sans leading-body`}>
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <header className="text-center mb-12 md:mb-16">
          <div className={`inline-flex items-center gap-3 bg-white border-2 border-deep-navy px-6 py-3 rounded-full mb-6 shadow-card`}>
            <Sparkles className="w-6 h-6 text-burgundy-wine" />
            <span className="text-deep-navy/80 font-medium text-lg">AI-Powered Music Creation for Every Generation</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-deep-navy mb-6 leading-tight">
            Create Personalized Songs
          </h1>
          <p className="text-xl md:text-2xl text-deep-navy/80 max-w-2xl mx-auto leading-relaxed">
            Turn your memories into beautiful melodies. AI creates unique songs for your loved ones in classic styles you grew up with.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white border-2 border-deep-navy p-6 md:p-8 text-center shadow-card">
            <div className="w-20 h-20 bg-burgundy-wine/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Music className="w-10 h-10 text-burgundy-wine" />
            </div>
            <h3 className="font-serif text-xl md:text-2xl font-semibold text-deep-navy mb-3">AI-Generated</h3>
            <p className="text-deep-navy/70 text-lg">Unique songs crafted by advanced AI</p>
          </div>
          <div className="bg-white border-2 border-deep-navy p-6 md:p-8 text-center shadow-card">
            <div className="w-20 h-20 bg-warm-green/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Heart className="w-10 h-10 text-warm-green" />
            </div>
            <h3 className="font-serif text-xl md:text-2xl font-semibold text-deep-navy mb-3">Personalized</h3>
            <p className="text-deep-navy/70 text-lg">Custom lyrics based on your story</p>
          </div>
          <div className="bg-white border-2 border-deep-navy p-6 md:p-8 text-center shadow-card">
            <div className="w-20 h-20 bg-paypal-gold/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-10 h-10 text-deep-navy" />
            </div>
            <h3 className="font-serif text-xl md:text-2xl font-semibold text-deep-navy mb-3">Instant Delivery</h3>
            <p className="text-deep-navy/70 text-lg">Get your song immediately</p>
          </div>
        </div>

        <div className="mb-12">
          <div className="bg-white border-2 border-deep-navy p-6 md:p-10 shadow-card">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 bg-burgundy-wine text-white rounded-lg flex items-center justify-center font-serif font-bold text-xl">AI</span>
                <p className="text-deep-navy/70 font-semibold text-xl">What you tell the AI:</p>
              </div>
              <p className="text-deep-navy text-xl md:text-2xl leading-relaxed pl-16">
                "I want a warm, nostalgic Country song for my husband Bob's 70th birthday. He spent 40 years as a petroleum pipe-fitter in Houston and now loves fishing on Lake Conroe. Please thank him for working so hard for our three kids, and let him know how much we love him."
              </p>
              <div className="flex items-center gap-3 pl-16 pt-2">
                <Music className="w-6 h-6 text-burgundy-wine" />
                <span className="text-deep-navy/80 text-xl font-medium">Music Style: Warm Country Folk</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t-2 border-deep-navy/20">
              <h4 className="font-serif text-xl font-bold text-deep-navy mb-4 text-center">🎵 Listen to the Generated Song</h4>
              <div className="bg-warm-cream border-2 border-deep-navy rounded-lg p-6">
                <audio controls controlsList="nodownload" src="/test-song.mp3" className="w-full" />
              </div>
              <div className="mt-4 text-center">
                <p className="text-deep-navy/80 text-lg">Song Title: <strong className="text-deep-navy">Bob on Conroe</strong></p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t-2 border-deep-navy/20">
              <div className="flex items-start gap-4">
                <Lock className="w-7 h-7 text-warm-green flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-deep-navy/80 text-xl leading-relaxed">
                    <strong className="text-deep-navy">100% Personal Copyright:</strong> You own your custom song forever. Download the high-quality MP3 to play in the car, share on Facebook, or email to family!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!showResult && (
          <form className="bg-white border-2 border-deep-navy p-6 md:p-10 shadow-card">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-deep-navy text-center mb-8">
              Create Your Song
            </h2>

            <div className="space-y-8">
              <div>
                <label className="block text-deep-navy/80 font-semibold mb-4 text-xl">
                  What's this song about?
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-warm-cream border-2 border-deep-navy rounded-lg px-6 py-5 text-xl text-deep-navy placeholder-deep-navy/30 focus:outline-none focus:border-burgundy-wine resize-none"
                  rows={4}
                  placeholder="Example: A song for my grandson Jack's graduation, or my golden wedding anniversary with Mary..."
                  required
                />
              </div>

              {/* 多维度歌曲配置面板（点击弹出，包含音乐风格/人声等全部维度） */}
              <SongConfigPanel
                selection={songConfig}
                onChange={setSongConfig}
              />

              <div>
                <label className="block text-deep-navy/80 font-semibold mb-4 text-xl">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full bg-warm-cream border-2 border-deep-navy rounded-lg px-6 py-5 text-xl text-deep-navy placeholder-deep-navy/30 focus:outline-none focus:border-burgundy-wine"
                  placeholder="Enter your email to receive the song..."
                />
                <p className="text-deep-navy/60 text-lg mt-3">
                  💡 Optional: Provide your email to receive the MP3 directly in your inbox after purchase.
                </p>
              </div>

              <div className="space-y-5">
                {!isPaidDevice && (
                <button
                  type="button"
                  onClick={handleGenerateSong}
                  disabled={isLoading}
                  className="w-full bg-burgundy-wine text-white font-bold py-5 px-8 rounded-lg text-xl border-2 border-deep-navy shadow-retro hover:shadow-retro-lg transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-7 h-7" />
                      Hear a Free Preview
                    </>
                  )}
                </button>
                )}
                {!isPaidDevice && (
                  <p className="text-center text-deep-navy/50 text-base mt-1">
                    Listen to a short preview. No download.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleBuyFullVersion()}
                  disabled={isLoading}
                  className="w-full bg-paypal-gold text-deep-navy font-bold py-5 px-8 rounded-lg text-xl border-2 border-deep-navy shadow-retro hover:shadow-retro-lg hover:bg-warm-amber transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-7 h-7" />
                      Create Full Song ($4.99)
                    </>
                  )}
                </button>
                <p className="text-center text-deep-navy/50 text-base mt-1">
                  Full song with MP3 download. One-time payment.
                </p>
              </div>

              <div className="bg-warm-cream border-2 border-deep-navy rounded-lg p-5">
                <div className="flex items-start gap-4">
                  <Lock className="w-7 h-7 text-warm-green flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-deep-navy/80 text-xl leading-relaxed">
                      <strong className="text-deep-navy">100% Personal Copyright:</strong> All generated songs belong to you. You are free to share them on Facebook, YouTube, or with family forever.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-deep-navy/60 text-lg mt-6">
              Secure payment via {PAYMENT_PROVIDER === 'paypal' ? 'PayPal' : 'Stripe'}. No subscription, one-time purchase only.
            </p>
          </form>
        )}

        {showResult && (
          <div className="bg-white border-2 border-deep-navy p-6 md:p-10 shadow-card">
            {DELIVERY_MODE === 'SESSION_LOCK' && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleResetDevice}
                  className="inline-flex items-center gap-2 text-deep-navy/60 hover:text-deep-navy text-lg font-medium"
                >
                  <RefreshCw className="w-5 h-5" />
                  Create Another Song
                </button>
              </div>
            )}
            
            {errorMessage ? (
              <div className="text-center">
                <div className="text-5xl mb-4">❌</div>
                <h3 className="font-serif text-2xl font-bold text-warm-red mb-3">Generation Failed</h3>
                <p className="text-deep-navy/70 text-xl">{errorMessage}</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="font-serif text-2xl font-bold text-warm-green mb-3">
                  {paymentComplete ? 'Payment Successful!' : 'Song Generated!'}
                </h3>
                <p className="text-deep-navy/70 text-xl mb-6">
                  {paymentComplete ? (
                    'Check your email for the download link!'
                  ) : (
                    'Your personalized song is ready! Download the high-quality MP3.'
                  )}
                </p>
                <div className="space-y-6">
                  {coverImageUrl && (
                    <div className="flex justify-center">
                      <img src={coverImageUrl} alt={songTitle || 'Cover'} className="w-48 h-48 rounded-xl object-cover border-2 border-deep-navy shadow-card" />
                    </div>
                  )}
                  {songTitle && <h3 className="font-serif text-2xl font-bold text-deep-navy text-center">{songTitle}</h3>}
                  
                  <div className="bg-warm-cream border-2 border-deep-navy rounded-lg p-6">
                    <audio 
                      controls 
                      src={audioUrl} 
                      className="w-full"
                      controlsList={deliveryStrategy.shouldHideDownloadButton() ? 'nodownload' : ''}
                      onTimeUpdate={(e) => {
                        const audio = e.target as HTMLAudioElement;
                        setCurrentTime(audio.currentTime);
                      }}
                    />
                    
                    <div className="flex justify-center mt-6">
                      <button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-3 px-8 py-5 bg-paypal-gold text-deep-navy font-bold rounded-lg text-xl border-2 border-deep-navy shadow-retro hover:shadow-retro-lg hover:bg-warm-amber transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                      >
                        <Download className="w-7 h-7" />
                        {deliveryStrategy.canDownload() ? 'Download MP3 Now' : 'Download High-Quality MP3 ($4.99)'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border-2 border-deep-navy rounded-lg p-6 shadow-card">
                    <h4 className="font-serif text-xl font-bold text-deep-navy mb-4 text-center">🎵 Lyrics</h4>
                    {songLyrics ? (
                      <div className="lyrics-container">
                        <div className="space-y-4">
                          {songLyrics.split('\n').map((line, index) => (
                            line.trim() ? (
                              <p key={index} className="text-center text-deep-navy/80 text-xl leading-relaxed">
                                {line.trim()}
                              </p>
                            ) : null
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-deep-navy/50 text-xl">
                        🎶 This is an instrumental track, no lyrics available
                      </div>
                    )}
                  </div>

                  {!paymentComplete && (
                    <div className="bg-warm-cream border-2 border-deep-navy rounded-lg p-6">
                      <h4 className="font-serif text-xl font-bold text-deep-navy mb-4 text-center">📧 Email (Optional)</h4>
                      <p className="text-deep-navy/70 text-lg text-center mb-4">
                        Enter your email to receive the song directly after purchase
                      </p>
                      <input
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        className="w-full bg-white border-2 border-deep-navy rounded-lg px-6 py-5 text-xl text-deep-navy placeholder-deep-navy/30 focus:outline-none focus:border-burgundy-wine"
                        placeholder="your@email.com"
                      />
                    </div>
                  )}

                  {orderId && paymentComplete && (
                    <div className="bg-warm-cream border-2 border-deep-navy rounded-lg p-6">
                      <h4 className="font-serif text-xl font-bold text-deep-navy mb-4 text-center">🔗 Share This Song</h4>
                      <div className="flex justify-center gap-4">
                        <a
                          href={`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/song/${orderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-burgundy-wine hover:bg-burgundy-wine/80 text-white font-bold py-3 px-6 rounded-lg border-2 border-deep-navy shadow-retro-sm hover:shadow-retro transition-all text-lg"
                        >
                          📤 Share Link
                        </a>
                        <a
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')}/song/${orderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg border-2 border-deep-navy shadow-retro-sm hover:shadow-retro transition-all text-lg"
                        >
                          📘 Facebook
                        </a>
                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Listen to this special song for ${songTitle || 'someone special'}!`)})&url=${encodeURIComponent(process.env.NEXT_PUBLIC_URL || 'http://localhost:3000')}/song/${orderId}`}
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
                  )}

                  {!paymentComplete && (
                    <button
                      type="button"
                      onClick={() => handleBuyFullVersion()}
                      disabled={isLoading}
                      className="w-full bg-paypal-gold text-deep-navy font-bold py-5 px-6 rounded-lg text-xl border-2 border-deep-navy shadow-retro hover:shadow-retro-lg hover:bg-warm-amber transition-all flex items-center justify-center gap-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
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
          <p className="text-deep-navy/60 text-lg">Made with ❤️ for music lovers everywhere</p>
          <a href="/?reset=1" className="inline-block mt-4 text-deep-navy/30 hover:text-deep-navy/60 text-base underline">
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
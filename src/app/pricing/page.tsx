import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Smart Music Lab',
  description: 'Limited-time offer - $5.00 per song (regularly $9.90). Create personalized AI-generated songs',
};

const PROMO_PRICE = '$5.00';
const REGULAR_PRICE = '$9.90';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-base-100 rounded-2xl shadow-xl p-8 md:p-12 border border-base-300">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">Pricing</h1>
          <p className="text-base-content/60 mb-8">Last updated: August 2026</p>

          <div className="bg-secondary/15 border-2 border-secondary rounded-xl p-4 text-center mb-8">
            <p className="text-primary font-bold text-lg">🔥 Limited-Time Offer — Save 49%</p>
            <p className="text-base-content/80 text-sm mt-1">
              <span className="font-semibold">{REGULAR_PRICE}</span>{' '}
              <span className="inline-block px-1.5 py-0.5 mx-1 bg-primary text-primary-content text-xs rounded">Now</span>{' '}
              <span className="font-bold">{PROMO_PRICE}</span> per song. Expires soon!
            </p>
          </div>

          <section className="space-y-8 text-base-content/80 leading-relaxed">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-6 border-2 border-primary">
                <div className="text-center relative">
                  <span className="absolute top-0 right-0 bg-secondary text-secondary-content text-xs font-bold px-2 py-1 rounded-full rotate-6">⚡ LIMITED TIME</span>
                  <h2 className="text-2xl font-bold text-primary mb-2">One Song</h2>
                  <p className="text-xl text-base-content/50 line-through mb-1">{REGULAR_PRICE}</p>
                  <p className="text-4xl font-bold text-primary mb-1">{PROMO_PRICE}</p>
                  <p className="text-base-content/60 text-sm mb-1">per song · regular price {REGULAR_PRICE}</p>
                  <ul className="text-left space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>Full commercial-free MP3 download</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>Custom lyrics with your personalization</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>Multiple music styles & genres</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>Instant preview before purchase</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>Email delivery with lyrics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>Personal, non-commercial use license</span>
                    </li>
                  </ul>
                  <p className="mt-4 text-xs text-base-content/60">
                    Payment: PayPal or credit card
                  </p>
                </div>
              </div>

              <div className="bg-base-200/50 rounded-xl p-6 border border-base-300">
                <h3 className="text-lg font-semibold text-base-content mb-4">How it works</h3>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-2">
                    <span className="bg-primary text-primary-content rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    <span>Describe your song: recipient, style, mood</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-primary text-primary-content rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    <span>Get a free preview — preview before you buy</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-primary text-primary-content rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    <span>Pay <s>{REGULAR_PRICE}</s> <strong>{PROMO_PRICE}</strong> to unlock the full song</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-primary text-primary-content rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                    <span>Download MP3 and receive email with lyrics</span>
                  </li>
                </ol>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">Important Information</h2>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Each song is a separate one-time purchase at <s>{REGULAR_PRICE}</s> <strong>{PROMO_PRICE}</strong> during the limited-time offer</li>
                <li>No subscriptions, no recurring fees</li>
                <li>Prices listed in USD (United States Dollars)</li>
                <li>Taxes may apply based on your location</li>
                <li>See our <a href="/refund" className="text-primary hover:underline">Refund Policy</a> for details on cancellations</li>
              </ul>
            </div>
          </section>

          <hr className="my-8 border-base-300" />

          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">价格说明</h1>
          <p className="text-base-content/60 mb-8">最后更新：2026年8月</p>

          <div className="bg-secondary/15 border-2 border-secondary rounded-xl p-4 text-center mb-8">
            <p className="text-primary font-bold text-lg">🔥 限时优惠 — 立省 49%</p>
            <p className="text-base-content/80 text-sm mt-1">
              <span className="font-semibold">原价 {REGULAR_PRICE}</span>{' '}
              <span className="inline-block px-1.5 py-0.5 mx-1 bg-primary text-primary-content text-xs rounded">现在</span>{' '}
              <span className="font-bold">每首歌 {PROMO_PRICE}</span>，优惠活动即将结束！
            </p>
          </div>

          <section className="space-y-8 text-base-content/80 leading-relaxed">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-6 border-2 border-primary">
                <div className="text-center relative">
                  <span className="absolute top-0 right-0 bg-secondary text-secondary-content text-xs font-bold px-2 py-1 rounded-full -rotate-6">⚡ 限时</span>
                  <h2 className="text-2xl font-bold text-primary mb-2">单曲购买</h2>
                  <p className="text-xl text-base-content/50 line-through mb-1">{REGULAR_PRICE}</p>
                  <p className="text-4xl font-bold text-primary mb-1">{PROMO_PRICE}</p>
                  <p className="text-base-content/60 text-sm mb-1">每首歌曲 · 原价 {REGULAR_PRICE}</p>
                  <ul className="text-left space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>无水印 MP3 完整下载</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>自定义歌词与个性化内容</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>多种音乐风格可供选择</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>购买前免费试听预览</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>邮件交付歌词</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">✓</span>
                      <span>个人非商业用途授权</span>
                    </li>
                  </ul>
                  <p className="mt-4 text-xs text-base-content/60">
                    支付方式：PayPal 或信用卡
                  </p>
                </div>
              </div>

              <div className="bg-base-200/50 rounded-xl p-6 border border-base-300">
                <h3 className="text-lg font-semibold text-base-content mb-4">使用流程</h3>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-2">
                    <span className="bg-primary text-primary-content rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    <span>描述你的歌曲：收件人、风格、情绪</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-primary text-primary-content rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    <span>免费试听预览 — 购买前先听</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-primary text-primary-content rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    <span>支付 <s>{REGULAR_PRICE}</s> <strong>{PROMO_PRICE}</strong> 解锁完整歌曲</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-primary text-primary-content rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                    <span>下载 MP3 并通过邮件获取歌词</span>
                  </li>
                </ol>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">重要信息</h2>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>限时优惠期间，每首歌曲为独立一次性购买，价格 <s>{REGULAR_PRICE}</s> <strong>{PROMO_PRICE}</strong></li>
                <li>无订阅费用，无自动续费</li>
                <li>价格以美元（USD）标价</li>
                <li>税费可能根据您的所在地适用</li>
                <li>取消退款请查看 <a href="/refund" className="text-primary hover:underline">退款政策</a></li>
              </ul>
            </div>
          </section>

          <div className="mt-10 pt-8 border-t border-base-300 text-center">
            <a href="/" className="text-primary hover:underline">← Back to Home / 返回首页</a>
          </div>
        </div>
      </div>
    </div>
  );
}

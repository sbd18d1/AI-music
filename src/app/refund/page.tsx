import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy | Smart Music Lab',
  description: 'Refund Policy for Smart Music Lab - AI Personalized Song Generator',
};

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-base-100 rounded-2xl shadow-xl p-8 md:p-12 border border-base-300">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">Refund Policy</h1>
          <p className="text-base-content/60 mb-8">Last updated: July 2025</p>

          <section className="space-y-6 text-base-content/80 leading-relaxed">
            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">14-Day Money-Back Guarantee</h2>
              <p>
                At Smart Music Lab, we stand behind the quality of our AI-generated songs. We offer a <strong>14-day money-back guarantee</strong> on all purchases. If you are not satisfied with your song for any reason, you may request a full refund within 14 days of your purchase date.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">Eligibility for Refund</h2>
              <p>To be eligible for a refund, your request must meet the following criteria:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The request is made within 14 days of the purchase date</li>
                <li>The song has not been downloaded or used (streaming preview does not count as use)</li>
                <li>You provide a valid reason for the refund request</li>
              </ul>
            </div>

            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 rounded my-6">
              <h3 className="font-semibold text-yellow-700 mb-1">⚠️ Digital Services Notice / Important Disclaimer</h3>
              <p className="text-sm">
                <strong>Due to the digital and non-tangible nature of our service</strong>, and because AI computational resources are consumed at the time of generation, <strong>we are generally unable to offer refunds for songs that have been downloaded or for which the full version has been delivered.</strong> The 14-day guarantee applies only to songs that remain unused and undownloaded.
              </p>
              <p className="text-sm mt-2">
                <strong>Once a song has been downloaded or if the full audio file has been delivered to your email, the sale is considered final and non-refundable.</strong> This is because:
              </p>
              <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                <li>AI generation consumes significant computational resources at the moment of creation</li>
                <li>Digital goods, once delivered, cannot be returned or reclaimed</li>
                <li>You have the opportunity to preview the song (free trial with watermark) before purchasing</li>
              </ul>
              <p className="text-sm mt-3 font-medium">
                Due to the nature of digital goods, generated audio files are non-refundable once downloaded. However, full refunds or credit redelivery will be issued if a system generation error occurs.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">How to Request a Refund</h2>
              <p>To request a refund, please follow these steps:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Send an email to <a href="mailto:support@smartmusiclab.com" className="text-primary hover:underline">support@smartmusiclab.com</a> with the subject line &quot;Refund Request - [Your Order ID]&quot;</li>
                <li>Include your order ID (found in your payment confirmation email)</li>
                <li>Provide a brief reason for your refund request</li>
                <li>We will review your request and respond within 3 business days</li>
              </ol>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">Non-Refundable Cases</h2>
              <p>Refunds will NOT be provided in the following cases:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>More than 14 days have passed since the purchase</li>
                <li>The song has been downloaded or the full version has been delivered</li>
                <li>The request is due to a change of mind after receiving the full song</li>
                <li>The same song was already refunded previously</li>
                <li>Fraudulent or abusive refund requests</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">Refund Processing</h2>
              <p>
                If your refund is approved, the refund will be processed to your original payment method (PayPal or credit card) within 5-10 business days. Please note that processing times may vary depending on your payment provider.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">Technical Issues</h2>
              <p>
                If you experience technical issues with your song (e.g., file corruption, playback issues), please contact us immediately at <a href="mailto:support@smartmusiclab.com" className="text-primary hover:underline">support@smartmusiclab.com</a>. We will work with you to resolve the issue or provide a replacement song at no extra cost.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">Changes to This Policy</h2>
              <p>
                We may update this Refund Policy from time to time. Changes will be effective upon posting on our website. The updated policy will apply to all future purchases.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">Contact Us</h2>
              <p>
                If you have any questions about this Refund Policy, please contact us at{' '}
                <a href="mailto:support@smartmusiclab.com" className="text-primary hover:underline">support@smartmusiclab.com</a>
              </p>
            </div>
          </section>

          <hr className="my-8 border-base-300" />

          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">退款与取消政策</h1>
          <p className="text-base-content/60 mb-8">最后更新：2025年7月</p>

          <section className="space-y-6 text-base-content/80 leading-relaxed">
            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">14天退款保证</h2>
              <p>
                Smart Music Lab 对我们 AI 生成的歌曲质量充满信心。我们为所有购买提供 <strong>14天退款保证</strong>。如果您对歌曲不满意，可在购买日期起 14 天内申请全额退款。
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">退款资格</h2>
              <p>申请退款需满足以下条件：</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>请求在购买日期起 14 天内提出</li>
                <li>歌曲未被下载或使用（试听预览不算使用）</li>
                <li>您提供合理的退款理由</li>
              </ul>
            </div>

            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 rounded my-6">
              <h3 className="font-semibold text-yellow-700 mb-1">⚠️ 数字服务声明 / 重要提示</h3>
              <p className="text-sm">
                <strong>由于我们服务的数字化和无形性质</strong>，且 AI 算力资源在生成时已被消耗，<strong>对于已下载的歌曲或已交付完整版本的歌曲，我们通常无法提供退款。</strong> 14 天保证仅适用于未使用、未下载的歌曲。
              </p>
              <p className="text-sm mt-2">
                <strong>一旦歌曲被下载或完整音频文件已发送至您的邮箱，销售即视为完成，不予退款。</strong>原因如下：
              </p>
              <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                <li>AI 生成在创建时消耗大量算力资源</li>
                <li>数字商品一旦交付无法归还或收回</li>
                <li>您在购买前有机会试听带水印的预览版本</li>
              </ul>
              <p className="text-sm mt-3 font-medium">
                由于数字商品的特性，生成的音频文件一经下载不可退款。但如果发生系统生成错误，我们将提供全额退款或重新生成。
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">如何申请退款</h2>
              <p>申请退款请按以下步骤操作：</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>发送邮件至 <a href="mailto:support@smartmusiclab.com" className="text-primary hover:underline">support@smartmusiclab.com</a>，主题为&quot;退款申请 - [您的订单号]&quot;</li>
                <li>在邮件中包含您的订单号（可在付款确认邮件中找到）</li>
                <li>简要说明退款理由</li>
                <li>我们将在 3 个工作日内审核您的请求并回复</li>
              </ol>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">不可退款的情况</h2>
              <p>以下情况不予退款：</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>购买时间已超过 14 天</li>
                <li>歌曲已下载或完整版本已交付</li>
                <li>因收到完整歌曲后改变主意</li>
                <li>同一歌曲已退款过一次</li>
                <li>欺诈性或滥用退款请求</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">退款处理</h2>
              <p>
                退款批准后，款项将在 5-10 个工作日内退回至您的原始付款方式（PayPal 或信用卡）。具体到账时间可能因付款提供商而异。
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">技术问题</h2>
              <p>
                如您在使用歌曲时遇到技术问题（如文件损坏、无法播放），请立即联系 <a href="mailto:support@smartmusiclab.com" className="text-primary hover:underline">support@smartmusiclab.com</a>。我们将协助您解决问题或免费提供替换歌曲。
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">政策变更</h2>
              <p>
                我们可能不时更新本退款政策。变更将在网站发布时生效。更新后的政策适用于所有未来购买。
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">联系我们</h2>
              <p>
                如您对本退款政策有任何疑问，请通过 <a href="mailto:support@smartmusiclab.com" className="text-primary hover:underline">support@smartmusiclab.com</a> 联系我们。
              </p>
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

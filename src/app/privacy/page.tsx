import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Smart Music Lab',
  description: 'Privacy Policy for Smart Music Lab - AI Personalized Song Generator',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-base-100 rounded-2xl shadow-xl p-8 md:p-12 border border-base-300">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">Privacy Policy</h1>
          <p className="text-base-content/60 mb-8">Last updated: July 2025</p>

          <section className="space-y-6 text-base-content/80 leading-relaxed">
            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">1. Information We Collect</h2>
              <p>
                Smart Music Lab collects the following information to provide our service:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Device Information:</strong> We use browser fingerprinting to identify unique devices and prevent abuse of our free trial. This information is stored locally and associated with your trial/payment orders.</li>
                <li><strong>Order Information:</strong> When you create a song, we collect the song description, recipient name, and genre preferences.</li>
                <li><strong>Email Address:</strong> If you choose to receive your song via email, we collect your email address. This is optional and only used for song delivery.</li>
                <li><strong>Payment Information:</strong> We do not store your payment card details. Payments are processed securely by PayPal, Stripe, and Paddle. We only receive payment status notifications from these providers.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">2. How We Use Your Information</h2>
              <p>We use your information to:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Provide and improve our song generation service</li>
                <li>Process payments through our payment providers</li>
                <li>Deliver your generated song via email (if requested)</li>
                <li>Prevent fraud and abuse of our free trial system</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">3. Data Storage & Security</h2>
              <p>
                Your data is stored on secure servers with encryption at rest and in transit. We use industry-standard security practices to protect your information. However, no internet transmission is completely secure, and we cannot guarantee absolute security.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">4. Information Sharing</h2>
              <p>We do not sell or rent your personal information. We share information only with:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Payment processors (PayPal, Stripe, Paddle) for transaction processing</li>
                <li>Email service providers for song delivery</li>
                <li>AI music generation providers (302.ai) for song creation — song descriptions are transmitted to generate your music</li>
                <li>Legal authorities when required by law</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">5. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict processing of your data</li>
                <li>Export your data in a portable format</li>
              </ul>
              <p className="mt-2">To exercise these rights, contact us at <a href="mailto:zyr950608@gmail.com" className="text-primary hover:underline">zyr950608@gmail.com</a>.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">6. Cookies & Local Storage</h2>
              <p>
                We use cookies and local storage to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Maintain your session and trial status</li>
                <li>Store your device fingerprint for trial limit enforcement</li>
                <li>Remember your song preferences and generated songs</li>
                <li>Improve our service through analytics</li>
              </ul>
              <p className="mt-2">You can disable cookies in your browser settings, but this may affect the functionality of our service.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">7. Data Retention</h2>
              <p>
                We retain order data for as long as necessary to provide our service and comply with legal obligations. Trial usage records are retained indefinitely to prevent abuse. You may request deletion of your data at any time.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">8. Children&apos;s Privacy</h2>
              <p>
                Our service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Changes will be posted on this page with a revised date. Your continued use of our service after changes constitutes acceptance of the updated policy.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">10. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at{' '}
                <a href="mailto:zyr950608@gmail.com" className="text-primary hover:underline">zyr950608@gmail.com</a>
              </p>
            </div>
          </section>

          <hr className="my-8 border-base-300" />

          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">隐私政策</h1>
          <p className="text-base-content/60 mb-8">最后更新：2025年7月</p>

          <section className="space-y-6 text-base-content/80 leading-relaxed">
            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">一、我们收集的信息</h2>
              <p>Smart Music Lab 收集以下信息以提供服务：</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>设备信息：</strong>我们使用浏览器指纹识别来标识唯一设备，防止滥用免费试用。此信息本地存储并与您的试用/付款订单关联。</li>
                <li><strong>订单信息：</strong>创建歌曲时，我们收集歌曲描述、收件人姓名和风格偏好。</li>
                <li><strong>电子邮箱：</strong>如您选择通过邮件接收歌曲，我们会收集您的邮箱地址。此为可选项，仅用于歌曲交付。</li>
                <li><strong>付款信息：</strong>我们不存储您的支付卡详情。付款由 PayPal、Stripe 和 Paddle 安全处理，我们仅接收这些提供商的付款状态通知。</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">二、信息使用方式</h2>
              <p>我们使用您的信息用于：</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>提供和改进歌曲生成服务</li>
                <li>通过付款提供商处理付款</li>
                <li>通过邮件交付生成的歌曲（如您请求）</li>
                <li>防止欺诈和滥用免费试用系统</li>
                <li>履行法律义务</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">三、数据存储与安全</h2>
              <p>
                您的数据存储在安全服务器上，采用静态和传输中的加密。我们使用行业标准的安全实践来保护您的信息。然而，互联网传输并非完全安全，我们无法保证绝对安全。
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">四、信息共享</h2>
              <p>我们不出售或出租您的个人信息。我们仅与以下方共享信息：</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>付款处理商（PayPal、Stripe、Paddle）用于交易处理</li>
                <li>电子邮件服务提供商用于歌曲交付</li>
                <li>AI 音乐生成提供商（302.ai）用于歌曲创作——歌曲描述会被传输以生成音乐</li>
                <li>法律机构在法律要求时</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">五、您的权利</h2>
              <p>您有权：</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>访问我们持有的关于您的个人数据</li>
                <li>请求更正不准确的数据</li>
                <li>请求删除您的数据</li>
                <li>反对或限制处理您的数据</li>
                <li>以可移植格式导出您的数据</li>
              </ul>
              <p className="mt-2">要行使这些权利，请联系 <a href="mailto:zyr950608@gmail.com" className="text-primary hover:underline">zyr950608@gmail.com</a>。</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">六、Cookie 与本地存储</h2>
              <p>我们使用 Cookie 和本地存储来：</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>维持您的会话和试用状态</li>
                <li>存储设备指纹以执行试用限制</li>
                <li>记住您的歌曲偏好和已生成的歌曲</li>
                <li>通过分析改进服务</li>
              </ul>
              <p className="mt-2">您可以在浏览器设置中禁用 Cookie，但这可能影响服务功能。</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">七、数据保留</h2>
              <p>
                我们在提供服务和履行法律义务所需的期限内保留订单数据。试用使用记录将无限期保留以防止滥用。您可随时请求删除数据。
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">八、儿童隐私</h2>
              <p>
                本服务不面向 13 岁以下儿童。我们不会故意收集 13 岁以下儿童的个人信息。如您认为我们收集了儿童信息，请立即联系我们。
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">九、政策变更</h2>
              <p>
                我们可能不时更新本隐私政策。变更将在本页面发布并注明修订日期。继续使用服务即表示接受更新后的政策。
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-base-content mb-2">十、联系我们</h2>
              <p>
                如您对本隐私政策有任何疑问，请通过 <a href="mailto:zyr950608@gmail.com" className="text-primary hover:underline">zyr950608@gmail.com</a> 联系我们。
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

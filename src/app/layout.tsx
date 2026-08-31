import type { Metadata } from 'next';
import './globals.css';
import { getThemeName } from '@/lib/theme';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'AI Personalized Song Generator',
  description: 'Create unique AI-generated songs for your loved ones. Perfect gift for birthdays, anniversaries, or any special occasion.',
  openGraph: {
    title: 'AI Personalized Song Generator',
    description: 'Create unique AI-generated songs for your loved ones.',
    type: 'website',
    images: [
      {
        url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=AI%20music%20generator%20landing%20page%20hero%20image%20with%20neon%20lights%20and%20musical%20notes&image_size=landscape_16_9',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeName = getThemeName();
  
  return (
    <html lang="en" data-theme={themeName}>
      <body className="min-h-screen">
        {/* Meta Pixel Code */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1005144665907990');
fbq('track', 'PageView');
`,
          }}
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1005144665907990&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {/* End Meta Pixel Code */}
        <Header />
        {children}
      </body>
    </html>
  );
}
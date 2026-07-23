import type { Metadata } from 'next';
import './globals.css';
import { getThemeName } from '@/lib/theme';

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
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
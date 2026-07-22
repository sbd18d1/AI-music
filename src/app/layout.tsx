import type { Metadata } from 'next';
import './globals.css';
import { getThemeName } from '@/lib/theme';
import { Mail } from 'lucide-react';

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
        {children}
        <footer className="fixed bottom-0 left-0 right-0 bg-base-200/95 border-t border-base-300 py-3 px-4 shadow-lg z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <a href="mailto:imallaboutyou@foxmail.com" className="text-base-content/80 hover:text-primary font-medium transition-colors">
              imallaboutyou@foxmail.com
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
import { NextRequest, NextResponse } from 'next/server';
import { generateSong } from '@/lib/ai-music';

export async function POST(request: NextRequest) {
  try {
    const result = await generateSong({
      recipientName: 'Bob',
      personality: "I want a warm, nostalgic Country song for my husband Bob's 70th birthday. He spent 40 years as a petroleum pipe-fitter in Houston and now loves fishing on Lake Conroe. Please thank him for working so hard for our three kids, and let him know how much we love him.",
      genre: 'Country & Folk',
      selectedStyle: 'Country & Folk',
      selectedArtistStyle: 'Johnny Cash',
      isPreview: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating example song:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
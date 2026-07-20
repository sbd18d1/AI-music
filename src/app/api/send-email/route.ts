import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendSongEmail } from '@/lib/email';

const sendEmailSchema = z.object({
  email: z.string().email(),
  audioUrl: z.string(),
  title: z.string().optional(),
  lyrics: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = sendEmailSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, audioUrl, title, lyrics } = validation.data;

    await sendSongEmail({
      email,
      recipientName: 'You',
      audioUrl,
      title,
      lyrics,
    });

    console.log(`[${new Date().toISOString()}] Email sent successfully to: ${email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to send email:`, error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
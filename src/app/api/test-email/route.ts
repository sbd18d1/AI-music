import { NextRequest, NextResponse } from 'next/server';
import { sendSongEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, recipientName, audioUrl, title, lyrics, orderId } = body;

    if (!email || !recipientName || !audioUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: email, recipientName, audioUrl' },
        { status: 400 }
      );
    }

    const sendResult = await sendSongEmail({
      email,
      recipientName,
      audioUrl,
      title,
      lyrics,
      orderId,
    });

    if (!sendResult.ok) {
      console.error(`[${new Date().toISOString()}] Test email FAILED to ${email}: ${sendResult.error}`);
      return NextResponse.json(
        { error: `Email send failed: ${sendResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Test email error:`, error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

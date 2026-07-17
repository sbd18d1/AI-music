import { Resend } from 'resend';

const AI_GENERATION_MODE = process.env.NEXT_PUBLIC_AI_GENERATION_MODE || 'mock';
const RESEND_API_KEY = AI_GENERATION_MODE === 'mock' 
  ? process.env.RESEND_API_KEY_TEST 
  : process.env.RESEND_API_KEY_LIVE;

const RESEND_FROM_EMAIL = AI_GENERATION_MODE === 'mock'
  ? 'onboarding@resend.dev'
  : (process.env.RESEND_FROM_EMAIL || 'no-reply@aimusic.com');

const resend = new Resend(RESEND_API_KEY);

interface SendSongEmailParams {
  email: string;
  recipientName: string;
  audioUrl: string;
  title?: string;
  lyrics?: string;
  orderId?: string;
}

export async function sendSongEmail(
  params: SendSongEmailParams
): Promise<void> {
  const { email, recipientName, audioUrl, title, lyrics, orderId } = params;
  const songTitle = title || `${recipientName}'s Song`;
  const safeFilename = songTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100) || 'song';
  const downloadUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/download-audio?url=${encodeURIComponent(audioUrl)}&filename=${encodeURIComponent(safeFilename)}`;

  try {
    console.log(`[${new Date().toISOString()}] Sending email to: ${email}`);
    console.log(`[${new Date().toISOString()}] From email: ${RESEND_FROM_EMAIL}`);
    console.log(`[${new Date().toISOString()}] Subject: Your AI Song "${songTitle}" is Ready!`);

    let attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    
    try {
      const fullAudioUrl = audioUrl.startsWith('/')
        ? `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}${audioUrl}`
        : audioUrl;
      
      console.log(`[${new Date().toISOString()}] Downloading audio for attachment: ${fullAudioUrl}`);
      const audioResponse = await fetch(fullAudioUrl);
      
      if (audioResponse.ok) {
        const blob = await audioResponse.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        attachments.push({
          filename: `${safeFilename}.mp3`,
          content: buffer,
          contentType: 'audio/mpeg',
        });
        console.log(`[${new Date().toISOString()}] Audio attachment added: ${buffer.length} bytes`);
      } else {
        console.warn(`[${new Date().toISOString()}] Failed to download audio for attachment: ${audioResponse.status}`);
      }
    } catch (attachmentError) {
      console.warn(`[${new Date().toISOString()}] Error adding audio attachment:`, attachmentError);
    }
    
    const result = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: email,
      subject: `Your AI Song "${songTitle}" is Ready! 🎵`,
      attachments,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your AI Song is Ready!</title>
          <style>
            body {
              font-family: Georgia, serif;
              background-color: #FAF6EE;
              margin: 0;
              padding: 40px;
            }
            .container {
              max-width: 650px;
              margin: 0 auto;
              background-color: #FFFFFF;
              border-radius: 12px;
              padding: 40px;
              border: 2px solid #111827;
              box-shadow: 4px 4px 0px 0px #111827;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #881337;
              text-align: center;
              margin-bottom: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #111827;
              font-size: 32px;
              margin: 0;
              font-family: Georgia, serif;
            }
            .header p {
              color: #111827;
              margin-top: 10px;
              font-size: 18px;
              line-height: 1.6;
            }
            .song-card {
              background-color: #FAF6EE;
              border-radius: 8px;
              padding: 30px;
              text-align: center;
              margin: 30px 0;
              border: 2px solid #111827;
            }
            .song-card h2 {
              color: #881337;
              margin: 0 0 15px 0;
              font-size: 28px;
              font-family: Georgia, serif;
            }
            .song-card p {
              color: #111827;
              margin: 0;
              font-size: 18px;
              line-height: 1.6;
            }
            .attachment-hint {
              margin-top: 20px;
              font-size: 20px !important;
              font-weight: bold;
              color: #881337 !important;
            }
            .lyrics-section {
              background-color: #FAF6EE;
              border-radius: 8px;
              padding: 25px;
              margin-top: 30px;
              border: 2px solid #111827;
            }
            .lyrics-section h3 {
              color: #881337;
              margin: 0 0 15px 0;
              font-size: 22px;
              font-family: Georgia, serif;
            }
            .lyrics-section p {
              color: #111827;
              margin: 0;
              font-size: 18px;
              line-height: 1.8;
              white-space: pre-wrap;
            }
            .footer {
              text-align: center;
              margin-top: 35px;
              color: #111827;
              font-size: 16px;
              line-height: 1.6;
            }
            .copyright {
              text-align: center;
              margin-top: 25px;
              color: #111827;
              font-size: 16px;
              line-height: 1.6;
              background-color: #881337;
              color: #FFFFFF;
              padding: 20px;
              border-radius: 8px;
            }
            .copyright strong {
              color: #FFC439;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🎵 AI Music Generator</div>
            <div class="header">
              <h1>Your Personalized Song is Ready!</h1>
              <p>We've crafted a unique song just for ${recipientName}</p>
            </div>
            <div class="song-card">
              <h2>"${songTitle}"</h2>
              <p>Your personalized song is attached to this email!</p>
              <p class="attachment-hint">🎵 Check your email attachments for the MP3 file</p>
            </div>
            ${lyrics ? `
            <div class="lyrics-section">
              <h3>📝 Full Lyrics</h3>
              <p>${lyrics}</p>
            </div>
            ` : ''}
            <div class="footer">
              <p>Made with ❤️ by AI Music Generator</p>
              <p style="margin-top: 10px;">Order ID: ${orderId || 'N/A'}</p>
            </div>
            <div class="copyright">
              <p><strong>🔒 100% Personal Copyright:</strong> This song belongs to you. You are free to share it on Facebook, YouTube, or with family forever.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    console.log(`[${new Date().toISOString()}] Email sent successfully to: ${email}`);
    console.log(`[${new Date().toISOString()}] Resend result:`, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to send email to ${email}:`, error);
  }
}

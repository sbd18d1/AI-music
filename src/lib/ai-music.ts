/**
 * AI 音乐生成模块
 * 
 * 该模块封装了与 302.ai Suno API 的交互逻辑，支持模拟模式和真实模式。
 * 
 * 环境变量配置：
 * - THREE02_AI_KEY: 302.ai API 密钥
 * - THREE02_AI_BASE_URL: API 基础地址，默认 https://api.302.ai
 * - NEXT_PUBLIC_AI_GENERATION_MODE: 生成模式，"mock" 或 "real"
 *   - mock: 使用预设的测试音频，不消耗 API 余额，用于开发测试
 *   - real: 调用 302.ai Suno API，会消耗账户余额，用于生产环境
 */

/**
 * 生成歌曲的参数接口
 */
interface GenerateSongParams {
  recipientName: string;           // 接收人姓名
  personality: string;            // 特点/故事背景
  genre: string;                  // 曲风
  isPreview?: boolean;            // 是否为预览模式（30秒短片段）
  selectedStyle?: string;         // 用户选择的风格
  selectedArtistStyle?: string;   // 用户选择的致敬乐手风格
  /** 多维度歌曲配置选择（可选，用于生成更精准的提示词） */
  songConfig?: import('./song-config').SongConfigSelection;
}

/**
 * 生成歌曲的响应接口
 */
interface GenerateSongResponse {
  success: boolean;          // 是否成功
  audioUrl?: string;         // 生成的音频 URL
  requestId?: string;        // 请求 ID（用于追踪）
  error?: string;            // 错误信息（失败时）
  lyrics?: string;           // 歌词
  title?: string;            // 歌曲标题
  coverImageUrl?: string;    // 封面图片链接
  duration?: string;         // 歌曲时长
}

// API 基础配置
const THREE02_AI_BASE_URL = process.env.THREE02_AI_BASE_URL || 'https://api.302.ai';
const AI_GENERATION_MODE = process.env.NEXT_PUBLIC_AI_GENERATION_MODE || 'mock';

import fs from 'fs';
import path from 'path';

const TEST_DATA_PATH = path.join(process.cwd(), 'test-song-data.json');
const PUBLIC_AUDIO_PATH = path.join(process.cwd(), 'public', 'test-song.mp3');

/**
 * 日志工具函数
 * @param message 日志消息
 * @param data 可选的附加数据
 */
function log(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * 风格标签映射表
 * 将用户选择的风格转换为 Suno API 最容易理解的英文标签
 */
const styleTagMap: Record<string, string> = {
  'Classic Rock': '60s 70s classic rock, electric guitars, powerful drums, vintage amp sound, energetic, nostalgic, rock anthem',
  'Country & Folk': '60s 70s classic country folk, rich acoustic guitar, warm vintage harmonies, storytelling lyrics, heartfelt, authentic',
  'Blues & Soul': 'vintage blues soul, smooth saxophone, warm organ, soulful vocals, emotional, groove-based, late night vibe',
  '60s/70s Pop Ballad': '60s 70s pop ballad, lush orchestration, melodic piano, romantic vocals, dreamy, nostalgic, timeless',
  'Rock': 'classic rock, electric guitars, powerful drums, energetic',
  'Country': 'country folk, acoustic guitar, storytelling lyrics',
  'Pop': 'pop ballad, melodic, romantic, catchy',
  'Rap': 'rap hiphop, rhythmic, lyric-driven',
};

/**
 * 致敬乐手风格映射表
 * 将用户选择的致敬乐手转换为 Suno API 最容易理解的英文标签
 */
const artistStyleMap: Record<string, string> = {
  'Frank Sinatra': 'inspired by Frank Sinatra, smooth jazz standards, big band arrangement, velvet vocals, sophisticated crooning, classic elegance',
  'Elvis Presley': 'inspired by Elvis Presley, classic Rock & Roll, smooth vocals, retro vibe, charismatic performance, King of Rock and Roll',
  'The Beatles': 'inspired by The Beatles, 60s melodic pop-rock, vocal harmonies, innovative songwriting, British Invasion style, timeless melodies',
  'The Rolling Stones': 'inspired by The Rolling Stones, bluesy rock & roll, gritty vocals, raw energy, rebellious attitude, classic riffs',
  'Bob Dylan': 'inspired by Bob Dylan, folk-rock storytelling, harmonica, acoustic guitar, poetic lyrics, protest song vibe, authentic voice',
  'Simon & Garfunkel': 'inspired by Simon & Garfunkel, harmonic folk-pop, beautiful vocal harmonies, acoustic guitar, introspective lyrics, warm sound',
  'Aretha Franklin': 'inspired by Aretha Franklin, soulful R&B vocals, powerful voice, gospel roots, emotional delivery, Queen of Soul',
  'Neil Diamond': 'inspired by Neil Diamond, classic pop ballads, warm vocals, catchy melodies, heartfelt lyrics, iconic sound',
  'Johnny Cash': 'inspired by Johnny Cash, deep baritone country, storytelling, outlaw country, train rhythm, Man in Black',
  'None': '',
};

/**
 * 扩写用户简单描述为完整的 Suno Prompt
 * 
 * 将老人的简短输入（如 "For my wife's 60th birthday"）扩展为完整的、情感丰富的歌曲描述。
 * 
 * @param description 用户的简单描述
 * @param selectedStyle 用户选择的风格
 * @returns 扩写后的完整 Prompt
 */
function expandPrompt(description: string, selectedStyle: string): string {
  const baseTemplates: Record<string, string[]> = {
    'Classic Rock': [
      'A powerful, anthemic song celebrating',
      'An energetic rock ballad dedicated to',
      'A classic rock tribute to',
    ],
    'Country & Folk': [
      'A heartwarming, emotional country ballad dedicated to',
      'A sweet folk song celebrating',
      'A heartfelt country tribute to',
    ],
    'Blues & Soul': [
      'A soulful, heartfelt blues song dedicated to',
      'An emotional soul ballad celebrating',
      'A smooth blues tribute to',
    ],
    '60s/70s Pop Ballad': [
      'A romantic, nostalgic pop ballad dedicated to',
      'A timeless love song celebrating',
      'A dreamy pop tribute to',
    ],
    'Rock': ['A powerful rock song celebrating', 'An energetic rock ballad dedicated to'],
    'Country': ['A heartwarming country song dedicated to', 'A sweet folk song celebrating'],
    'Pop': ['A romantic pop ballad dedicated to', 'A catchy love song celebrating'],
    'Rap': ['A rhythmic rap song celebrating', 'A lyric-driven hiphop tribute to'],
  };

  const templates = baseTemplates[selectedStyle] || baseTemplates['Classic Rock'];
  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

  const emotionKeywords = [
    'love', 'memories', 'together', 'forever', 'happiness', 'joy',
    'special moments', 'beautiful journey', 'cherished times', 'heartfelt',
  ];
  const randomEmotion = emotionKeywords[Math.floor(Math.random() * emotionKeywords.length)];

  return `${randomTemplate} ${description}. Celebrating ${randomEmotion}, connection, and timeless moments together.`;
}

/**
 * 组装 Suno API 请求参数
 *
 * 优先使用多维度配置面板的选择来生成精准提示词；
 * 如果没有提供 songConfig，则回退到旧的 styleTagMap + expandPrompt 逻辑。
 *
 * @param params 用户输入参数
 * @returns 组装后的 Suno API 请求参数
 */
function buildSunoRequest(params: GenerateSongParams): { gpt_description_prompt: string; style_tags: string } {
  const { personality: description, selectedStyle, selectedArtistStyle, genre, isPreview = false, songConfig } = params;

  // 优先使用多维度配置面板
  if (songConfig) {
    const { buildPrompts } = require('./prompt-builder');
    const built = buildPrompts(songConfig, description, params.recipientName);

    log('Prompt Engineering (Multi-Dimension Config):', {
      songConfig,
      sunoStyleTags: built.sunoStyleTags,
      lyricSystemInstruction: built.lyricSystemInstruction,
      gptDescriptionPrompt: built.gptDescriptionPrompt,
    });

    return {
      gpt_description_prompt: built.gptDescriptionPrompt,
      style_tags: built.sunoStyleTags,
    };
  }

  // 回退：旧的拼接逻辑
  const effectiveStyle = selectedStyle || genre || 'Classic Rock';
  const styleTags = styleTagMap[effectiveStyle] || styleTagMap['Classic Rock'];
  const artistTags = selectedArtistStyle && selectedArtistStyle !== 'None' 
    ? artistStyleMap[selectedArtistStyle] 
    : '';

  const combinedTags = [styleTags, artistTags].filter(Boolean).join(', ');
  const expandedPrompt = expandPrompt(description, effectiveStyle);

  log('Prompt Engineering (Legacy):', {
    userDescription: description,
    selectedStyle: effectiveStyle,
    selectedArtistStyle,
    combinedTags: combinedTags.substring(0, 100) + '...',
    expandedPrompt: expandedPrompt.substring(0, 100) + '...',
  });

  return {
    gpt_description_prompt: expandedPrompt,
    style_tags: combinedTags,
  };
}

/**
 * 保存生成结果到测试数据文件
 * 
 * 当真实模式成功生成歌曲时，自动保存所有数据到 test-song-data.json，
 * 并下载音频文件到 public/test-song.mp3，以便模拟模式使用。
 * 
 * @param response 生成响应数据
 */
async function saveTestData(response: GenerateSongResponse): Promise<void> {
  if (!response.success || !response.audioUrl) {
    log('saveTestData: Skipping - no valid data to save');
    return;
  }

  try {
    const testData = {
      audioUrl: '/test-song.mp3',
      lyrics: response.lyrics || '',
      title: response.title || 'Generated Song',
      coverImageUrl: response.coverImageUrl || '',
      duration: response.duration || '180',
    };

    log('saveTestData: Saving test data to', TEST_DATA_PATH);
    fs.writeFileSync(TEST_DATA_PATH, JSON.stringify(testData, null, 2));

    if (response.audioUrl) {
      log('saveTestData: Downloading audio file to', PUBLIC_AUDIO_PATH);
      const audioResponse = await fetch(response.audioUrl);
      if (audioResponse.ok) {
        const audioBuffer = await audioResponse.arrayBuffer();
        fs.writeFileSync(PUBLIC_AUDIO_PATH, Buffer.from(audioBuffer));
        log('saveTestData: Audio file downloaded successfully');
      } else {
        log('saveTestData: Failed to download audio - status:', audioResponse.status);
      }
    }

    log('saveTestData: All test data saved successfully');
  } catch (error) {
    log('saveTestData: Error saving test data:', { error });
  }
}

/**
 * 模拟生成歌曲（Mock Mode）
 * 
 * 当 AI_GENERATION_MODE 设置为 "mock" 时使用此函数，
 * 返回预设的测试音频 URL，不消耗 302.ai API 余额。
 * 
 * @param params 生成参数
 * @returns 生成响应
 */
async function mockGenerateSong(
  params: GenerateSongParams
): Promise<GenerateSongResponse> {
  log('MOCK MODE: Simulating song generation');
  log('MOCK: Params:', params);

  // 模拟生成延迟（3秒）
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 根据预览模式选择不同的测试音频
  try {
    const testData = require('../../test-song-data.json');
    log('MOCK MODE: Loaded test data from file');
    log('MOCK: Title:', testData.title);
    log('MOCK: Audio URL:', testData.audioUrl);
    log('MOCK: Lyrics length:', testData.lyrics ? testData.lyrics.length : 0);

    return {
      success: true,
      audioUrl: testData.audioUrl,
      requestId: `mock-task-${Date.now()}`,
      lyrics: testData.lyrics || '',
      title: testData.title || 'Generated Song',
      coverImageUrl: testData.coverImageUrl || '',
      duration: testData.duration || '180',
    };
  } catch (error) {
    log('MOCK MODE: Failed to load test data, using fallback', { error });
    return {
      success: true,
      audioUrl: '/test-song.mp3',
      requestId: `mock-task-${Date.now()}`,
      lyrics: '[Verse 1]\nMr White in Albuquerque\nBorn to this desert air\nSame sun on his driveway\nSame chalk dust in his hair',
      title: 'Mr White in Albuquerque',
      coverImageUrl: '',
      duration: '180',
    };
  }
}

/**
 * 生成歌曲的主函数
 * 
 * 根据环境变量 AI_GENERATION_MODE 决定使用模拟模式还是真实模式。
 * 
 * @param params 生成参数
 * @returns 生成响应
 */
export async function generateSong(
  params: GenerateSongParams
): Promise<GenerateSongResponse> {
  // 检查是否启用模拟模式
  if (AI_GENERATION_MODE === 'mock') {
    log('AI_GENERATION_MODE=mock, using mock generation');
    return mockGenerateSong(params);
  }

  // 真实模式：调用 302.ai Suno API
  log('Starting REAL song generation', { params });
  log('Using API base URL:', THREE02_AI_BASE_URL);

  try {
    const { gpt_description_prompt, style_tags } = buildSunoRequest(params);

    const submitUrl = `${THREE02_AI_BASE_URL}/suno/submit/music`;

    const requestBody = {
      gpt_description_prompt,
      style_tags,
      mv: 'chirp-crow',
      make_instrumental: false,
    };

    const requestHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${process.env.THREE02_AI_KEY}`,
    };

    console.log("===== 请求报文 START =====");
    console.log("URL:", submitUrl);
    console.log("Method:", 'POST');
    console.log("Headers:", JSON.stringify(requestHeaders, null, 2));
    console.log("Body:", JSON.stringify(requestBody, null, 2));
    console.log("===== 请求报文 END =====");

    log('Sending request to:', submitUrl);
    log('Request body:', requestBody);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(submitUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBodyText = await response.text();

    console.log("===== 响应报文 START =====");
    console.log("Status:", response.status, response.statusText);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    console.log("Headers:", JSON.stringify(responseHeaders, null, 2));
    console.log("Body:", responseBodyText || '(empty)');
    console.log("===== 响应报文 END =====");

    log(`Response status: ${response.status} ${response.statusText}`);
    log('Response headers:', responseHeaders);
    log('Response body:', responseBodyText || '(empty)');

    let data: any;
    try {
      if (responseBodyText) {
        data = JSON.parse(responseBodyText);
        log('Parsed response data:', data);
      }
    } catch (parseError) {
      log('JSON parse failed:', parseError instanceof Error ? parseError.message : String(parseError));
      log('Raw text response:', responseBodyText);
      
      return {
        success: false,
        error: `API returned invalid response. Status: ${response.status}. Content-Type: ${response.headers.get('Content-Type')}. Response length: ${responseBodyText.length} bytes.`,
      };
    }

    // 处理 API 错误响应
    if (!response.ok) {
      let errorMsg = 'Failed to generate song';
      
      // 如果响应体为空，直接返回状态码错误
      if (!data) {
        errorMsg = `API returned empty response with status ${response.status}`;
      } else if (typeof data.message === 'string') {
        errorMsg = data.message;
      } else if (typeof data.error === 'string') {
        errorMsg = data.error;
      } else if (data.error && typeof data.error.message === 'string') {
        errorMsg = data.error.message;
      } else if (data.error && typeof data.error.message_cn === 'string') {
        errorMsg = data.error.message_cn;
      } else if (data.data && typeof data.data.message === 'string') {
        errorMsg = data.data.message;
      } else if (data.data && typeof data.data.error === 'string') {
        errorMsg = data.data.error;
      } else if (data.message && typeof data.message.message === 'string') {
        errorMsg = data.message.message;
      } else if (typeof data === 'string') {
        errorMsg = data;
      }
      
      log('API request failed:', errorMsg);
      
      // 添加帮助提示
      if (errorMsg.includes('Insufficient account balance') || errorMsg.includes('Create your own tool')) {
        errorMsg += '\n\n请登录 302.ai 创建工具并使用工具的 API Key，而不是账户的 API Key。';
      }
      
      return {
        success: false,
        error: errorMsg,
      };
    }

    // 提取任务 ID，用于轮询结果
    if (data.data && typeof data.data === 'string') {
      log('Received task_id from data.data:', data.data);
      const result = await pollForResult(data.data);
      return result;
    }

    if (data.data && data.data.task_id) {
      log('Received task_id from data.data.task_id:', data.data.task_id);
      const result = await pollForResult(data.data.task_id);
      return result;
    }

    if (data.task_id) {
      log('Received task_id (direct):', data.task_id);
      const result = await pollForResult(data.task_id);
      return result;
    }

    log('No task_id found in response');
    return {
      success: false,
      error: 'No task ID returned',
    };
  } catch (error: any) {
    const errorCode = error.cause?.code || error.code;
    const errorHost = error.cause?.hostname || '';
    
    log('AI music generation error:', {
      message: error.message,
      code: errorCode,
      hostname: errorHost,
      stack: error.stack,
    });

    let errorMessage = 'Internal server error';
    
    // 根据错误类型提供更具体的提示
    if (errorCode === 'UND_ERR_CONNECT_TIMEOUT') {
      errorMessage = `Connection timeout to ${errorHost || THREE02_AI_BASE_URL}. Please check your network, or set NEXT_PUBLIC_AI_GENERATION_MODE=mock in .env to test without the API.`;
    } else if (errorCode === 'ENOTFOUND') {
      errorMessage = `Domain not found: ${errorHost || THREE02_AI_BASE_URL}. Please check the API URL configuration.`;
    } else {
      errorMessage = error.message || 'Internal server error';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 轮询等待生成结果
 * 
 * 302.ai 的生成是异步的，提交请求后需要轮询直到任务完成或失败。
 * 
 * @param taskId 任务 ID
 * @returns 生成响应
 */
async function pollForResult(taskId: string): Promise<GenerateSongResponse> {
  const maxRetries = 60;    // 最大重试次数（5分钟）
  const delay = 5000;       // 轮询间隔（5秒）

  log('Starting poll for task:', taskId);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const fetchUrl = `${THREE02_AI_BASE_URL}/suno/fetch/${taskId}`;
      log(`Poll attempt ${i + 1}/${maxRetries} - GET:`, fetchUrl);

      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.THREE02_AI_KEY}`,
        },
      });

      log('Poll response status:', response.status);

      const responseBodyText = await response.text();
      log('Poll response body:', responseBodyText.substring(0, 500));

      let data: any;
      try {
        data = JSON.parse(responseBodyText);
      } catch (parseError) {
        log('JSON parse failed:', parseError instanceof Error ? parseError.message : String(parseError));
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // 检查任务状态
      if (data.data && data.data.data && Array.isArray(data.data.data)) {
        const songs = data.data.data;
        
        if (songs.length > 0) {
          const song = songs[0];
          
          if (song.audio_url) {
            log('Song generation complete! Audio URL:', song.audio_url);
            log('Song title:', song.title || 'Unknown');
            log('Lyrics preview:', song.prompt ? song.prompt.substring(0, 100) + '...' : 'None');
            
            const result: GenerateSongResponse = {
              success: true,
              audioUrl: song.audio_url,
              requestId: taskId,
              lyrics: song.prompt,
              title: song.title,
              coverImageUrl: song.image_url || song.image_large_url,
              duration: song.duration,
            };

            saveTestData(result).catch(err => {
              log('Failed to save test data:', err);
            });

            return result;
          }
          
          if (song.status === 'failed' || song.error) {
            const errorMsg = song.error || song.msg || 'Generation failed';
            log('Task failed:', errorMsg);
            return {
              success: false,
              error: errorMsg,
              requestId: taskId,
            };
          }
        }
      }

      // 任务还在处理中，继续轮询
      log(`Waiting ${delay}ms before next poll...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error: any) {
      log('Polling error:', {
        message: error.message,
        code: error.cause?.code || error.code,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 轮询超时
  log(`Polling timeout after ${maxRetries} attempts`);
  return {
    success: false,
    error: 'Timeout waiting for generation',
    requestId: taskId,
  };
}

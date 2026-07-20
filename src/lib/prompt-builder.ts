/**
 * Prompt 拼接工具
 *
 * 根据用户在 5 个维度上的选择 + 原始记忆描述，
 * 生成两类提示词：
 *  1. Suno 风格标签（style_tags，最长 120 字符）
 *  2. 发给歌词 LLM 的系统指令（lyric system instruction）
 *
 * 互斥规则：每个维度最多取一个 option，确保提示词不会自相矛盾。
 */

import {
  SongConfigSelection,
  resolveSelection,
  SongConfigOption,
} from './song-config';
import { resolveSelectionFromDb, SongConfigOptionDb } from './song-config-db';

/** Suno 风格标签的最大字符数 */
const MAX_SUNO_STYLE_TAG_LENGTH = 120;

/** 拼接结果 */
export interface BuiltPrompts {
  /** 发送给 Suno 的音乐风格标签（已截断到 120 字符） */
  sunoStyleTags: string;
  /** 发送给歌词 LLM 的系统指令 */
  lyricSystemInstruction: string;
  /** 给 Suno 的 gpt_description_prompt（含用户原始描述） */
  gptDescriptionPrompt: string;
}

/**
 * 截断字符串到指定长度，尽量在单词边界截断并加省略号
 */
function truncatePreservingWords(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength - 1);
  const lastComma = sliced.lastIndexOf(',');
  if (lastComma > maxLength * 0.6) {
    return sliced.slice(0, lastComma);
  }
  const lastSpace = sliced.lastIndexOf(' ');
  return sliced.slice(0, lastSpace > 0 ? lastSpace : maxLength - 1);
}

/**
 * 拼接 Suno 风格标签
 *
 * 来源：维度1（主曲风）+ 维度2（音色部分）+ 维度3（人声）+ 维度4（情感氛围）
 * 注意：维度5（场景）只影响歌词，不进入风格标签。
 */
type SongConfigOptionLike = SongConfigOption | SongConfigOptionDb;

function buildSunoStyleTags(resolved: {
  musicStyle?: SongConfigOptionLike;
  audience?: SongConfigOptionLike;
  vocalCharacter?: SongConfigOptionLike;
  emotionalVibe?: SongConfigOptionLike;
}): string {
  const parts: string[] = [];

  if (resolved.musicStyle?.styleTag) parts.push(resolved.musicStyle.styleTag);
  if (resolved.audience?.styleTag) parts.push(resolved.audience.styleTag);
  if (resolved.vocalCharacter?.styleTag) parts.push(resolved.vocalCharacter.styleTag);
  if (resolved.emotionalVibe?.styleTag) parts.push(resolved.emotionalVibe.styleTag);

  const joined = parts.join(', ');
  return truncatePreservingWords(joined, MAX_SUNO_STYLE_TAG_LENGTH);
}

/**
 * 拼接歌词 LLM 系统指令
 *
 * 来源：用户原始记忆描述 + 维度5（场景规则）+ 维度2（歌词年龄段限制）
 *      + 维度4（情感基调，作为辅助）
 *
 * 示例输出：
 *   Write a heartwarming, cheerful custom song about Lily baking cupcakes with
 *   her grandma for her Birthday Celebration. The target audience is a 4-8 years
 *   old child, so use simple words, vivid imagery, and create an incredibly
 *   catchy chorus.
 */
function buildLyricSystemInstruction(
  userDescription: string,
  resolved: {
    audience?: SongConfigOptionLike;
    emotionalVibe?: SongConfigOptionLike;
    occasion?: SongConfigOptionLike;
  },
  recipientName?: string
): string {
  const fragments: string[] = [];

  if (resolved.emotionalVibe?.lyricInstruction) {
    fragments.push(resolved.emotionalVibe.lyricInstruction);
  }

  if (resolved.occasion?.lyricInstruction) {
    fragments.push(resolved.occasion.lyricInstruction);
  }

  if (resolved.audience?.lyricInstruction) {
    fragments.push(resolved.audience.lyricInstruction);
  }

  const guideline = fragments.filter(Boolean).join('; ');

  const aboutSubject = recipientName
    ? `about ${recipientName}`
    : 'about the story below';

  const descriptionPart = userDescription.trim()
    ? `based on this memory: "${userDescription.trim()}"`
    : '';

  if (guideline) {
    return `Write a custom song ${aboutSubject}. ${descriptionPart} Guidelines: ${guideline}. Create an incredibly catchy chorus and vivid storytelling lyrics.`.trim();
  }
  return `Write a custom song ${aboutSubject}. ${descriptionPart} Create an incredibly catchy chorus and vivid storytelling lyrics.`.trim();
}

/**
 * 拼接 Suno 的 gpt_description_prompt
 *
 * 这是发给 Suno 的整体描述，包含情感、人声和用户故事概要。
 */
function buildGptDescriptionPrompt(
  userDescription: string,
  resolved: {
    musicStyle?: SongConfigOptionLike;
    vocalCharacter?: SongConfigOptionLike;
    emotionalVibe?: SongConfigOptionLike;
  },
  recipientName?: string
): string {
  const fragments: string[] = [];

  if (resolved.musicStyle?.name) {
    fragments.push(`A ${resolved.musicStyle.name.toLowerCase()} song`);
  } else {
    fragments.push('A custom song');
  }

  if (recipientName) {
    fragments.push(`for ${recipientName}`);
  }

  if (resolved.emotionalVibe?.name) {
    fragments.push(`with a ${resolved.emotionalVibe.name.toLowerCase()} feel`);
  }

  if (resolved.vocalCharacter?.name) {
    fragments.push(`featuring ${resolved.vocalCharacter.name.toLowerCase()}`);
  }

  const intro = fragments.join(' ');

  const descriptionPart = userDescription.trim()
    ? `inspired by: "${userDescription.trim()}"`
    : '';

  return `${intro} ${descriptionPart}`.trim();
}

/**
 * 主入口：根据用户选择 + 描述生成全部提示词
 *
 * @param selection 5 个维度的选择
 * @param userDescription 用户原始记忆描述
 * @param recipientName 可选的接收人姓名
 */
export function buildPrompts(
  selection: SongConfigSelection,
  userDescription: string,
  recipientName?: string
): BuiltPrompts {
  const resolved = resolveSelection(selection);

  const sunoStyleTags = buildSunoStyleTags(resolved);
  const lyricSystemInstruction = buildLyricSystemInstruction(
    userDescription,
    resolved,
    recipientName
  );
  const gptDescriptionPrompt = buildGptDescriptionPrompt(
    userDescription,
    resolved,
    recipientName
  );

  return {
    sunoStyleTags,
    lyricSystemInstruction,
    gptDescriptionPrompt,
  };
}

export async function buildPromptsFromDb(
  selection: SongConfigSelection,
  userDescription: string,
  recipientName?: string
): Promise<BuiltPrompts> {
  const resolved = await resolveSelectionFromDb(selection);

  const sunoStyleTags = buildSunoStyleTags(resolved);
  const lyricSystemInstruction = buildLyricSystemInstruction(
    userDescription,
    resolved,
    recipientName
  );
  const gptDescriptionPrompt = buildGptDescriptionPrompt(
    userDescription,
    resolved,
    recipientName
  );

  return {
    sunoStyleTags,
    lyricSystemInstruction,
    gptDescriptionPrompt,
  };
}

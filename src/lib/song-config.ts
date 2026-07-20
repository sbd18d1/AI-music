/**
 * 歌曲配置维度数据
 *
 * 每个维度最多只能选择一个选项（互斥），避免产生矛盾的提示词。
 * 设计目标：把技术性的 prompt 编写转化为老人也能理解的直观选择。
 */

/**
 * 单个配置选项
 */
export interface SongConfigOption {
  /** 唯一标识 */
  id: string;
  /** 显示图标 */
  icon: string;
  /** 显示名称 */
  name: string;
  /** 简短描述 */
  description: string;
  /** 发送给 Suno 的音乐风格标签 */
  styleTag?: string;
  /** 发送给 LLM 的歌词创作指引 */
  lyricInstruction?: string;
  /** 映射到旧版 genre 字段（用于数据库与兼容旧逻辑） */
  genreValue?: string;
}

/**
 * 配置维度
 */
export interface SongConfigDimension {
  /** 维度标识 */
  id: string;
  /** 维度标题 */
  title: string;
  /** 维度副标题 */
  subtitle?: string;
  /** 该维度下的选项 */
  options: SongConfigOption[];
}

/**
 * 维度1：主曲风与年代
 * 决定歌曲的基础音乐风格和年代质感
 */
export const MUSIC_STYLE_DIMENSION: SongConfigDimension = {
  id: 'musicStyle',
  title: 'Music Style & Era',
  subtitle: 'Pick the vibe that feels like home',
  options: [
    {
      id: 'nashville_acoustic',
      icon: '☕',
      name: '1970s Nashville Acoustic',
      description: 'Warm storytelling folk',
      styleTag:
        '1970s acoustic folk, warm analog master, gentle fingerpicked acoustic guitar, storytelling tempo',
      genreValue: 'Country & Folk',
    },
    {
      id: 'texas_honky_tonk',
      icon: '🌵',
      name: 'Texas Roadside Honky-Tonk',
      description: 'Upbeat classic country',
      styleTag:
        'upbeat classic country, slide guitar, honky-tonk piano, driving drum rhythm, vintage 1970s vinyl master',
      genreValue: 'Country & Folk',
    },
    {
      id: 'west_coast_rock',
      icon: '🌊',
      name: 'West Coast Sunset Rock',
      description: 'Smooth 70s soft rock',
      styleTag:
        '1970s soft rock, smooth vocal harmonies, warm electric piano, nostalgic electric guitar solo',
      genreValue: 'Classic Rock',
    },
    {
      id: 'folk_revival_60s',
      icon: '🎸',
      name: '1960s Folk Revival',
      description: 'Raw poetic protest folk',
      styleTag:
        '1960s protest folk, raw acoustic guitar strumming, poetic delivery, organic analog recording',
      genreValue: '60s/70s Pop Ballad',
    },
  ],
};

/**
 * 维度2：目标受众与年龄段
 * 当选择儿童选项时，自动注入适合该年龄段的音色和歌词规则
 */
export const AUDIENCE_DIMENSION: SongConfigDimension = {
  id: 'audience',
  title: 'Who Is This Song For?',
  subtitle: 'We will tune the lyrics and sound for them',
  options: [
    {
      id: 'adults',
      icon: '👴',
      name: 'For Myself / Adults',
      description: 'Mature adult contemporary',
      styleTag: 'mature adult contemporary delivery',
      lyricInstruction: 'mature themes and storytelling',
    },
    {
      id: 'toddler_lullaby',
      icon: '🌙',
      name: 'For Kids: Toddler Lullaby (0-3)',
      description: 'Soft bedtime magic',
      styleTag:
        'magical glockenspiel, soft acoustic padding, peaceful bedtime vibe, Disney fairytale music arrangement style',
      lyricInstruction:
        'simple words, soothing sounds, repetitive gentle phrases suitable for ages 0-3',
    },
    {
      id: 'playful_childhood',
      icon: '🧸',
      name: 'For Kids: Playful Childhood (4-8)',
      description: 'Whimsical sing-along fun',
      styleTag:
        'playful banjo picking, toe-tapping acoustic rhythm, whimsical and fun, kid-friendly storytelling',
      lyricInstruction:
        'vivid imagery like catching fireflies, climbing trees, baking cookies; simple catchy words for ages 4-8',
    },
    {
      id: 'campfire_singalong',
      icon: '🌳',
      name: 'For Kids: Campfire Sing-Along (9-12)',
      description: 'Bright adventure folk',
      styleTag:
        'bright sing-along folk, uplifting acoustic guitar strumming, catchy rhythmic clapping, happy camping vibe',
      lyricInstruction:
        'themes of friendship, adventure, independent growth; easy-to-remember chorus for ages 9-12',
    },
  ],
};

/**
 * 维度3：人声特征
 * 决定主唱的音色与演唱风格
 */
export const VOCAL_CHARACTER_DIMENSION: SongConfigDimension = {
  id: 'vocalCharacter',
  title: 'Vocal Character',
  subtitle: 'Choose the voice that tells your story',
  options: [
    {
      id: 'deep_baritone',
      icon: '🤠',
      name: 'The Deep Baritone',
      description: 'Johnny Cash style',
      styleTag: 'deep gravelly baritone male vocal, speak-singing style, raw emotional delivery',
    },
    {
      id: 'golden_songstress',
      icon: '🌾',
      name: 'The Golden Songstress',
      description: 'Dolly Parton style',
      styleTag: 'vintage female country vocal, sweet vibrato, high angelic tone, heartfelt delivery',
    },
    {
      id: 'velvet_crooner',
      icon: '🕯️',
      name: 'The Velvet Crooner',
      description: 'Elvis style',
      styleTag: 'warm velvet romantic male vocal, smooth crooner style, rich vibrato',
    },
    {
      id: 'pure_folk_whisperer',
      icon: '🕊️',
      name: 'The Pure Folk Whisperer',
      description: 'Karen Carpenter style',
      styleTag: 'clear soothing female folk vocal, soft vintage tone, warm and comforting',
    },
  ],
};

/**
 * 维度4：情感氛围
 */
export const EMOTIONAL_VIBE_DIMENSION: SongConfigDimension = {
  id: 'emotionalVibe',
  title: 'Emotional Vibe',
  subtitle: 'How should this song feel?',
  options: [
    {
      id: 'tear_jerker',
      icon: '😭',
      name: 'The Tear-Jerker',
      description: 'Deeply nostalgic & melancholic',
      styleTag: 'deeply nostalgic, melancholic, slow burning intensity, poignant violin pads',
      lyricInstruction: 'deeply nostalgic and emotional tone, bittersweet memories',
    },
    {
      id: 'heartwarming_sunny',
      icon: '☀️',
      name: 'Heartwarming & Sunny',
      description: 'Uplifting & cheerful',
      styleTag: 'uplifting, cheerful, heartwarming, bright major key',
      lyricInstruction: 'uplifting and cheerful tone, focus on joy and warmth',
    },
    {
      id: 'peaceful_reflection',
      icon: '🌅',
      name: 'Peaceful Reflection',
      description: 'Tranquil & serene',
      styleTag: 'tranquil, serene, slow tempo, reflective, soft acoustic padding',
      lyricInstruction: 'tranquil and reflective tone, peaceful life moments',
    },
  ],
};

/**
 * 维度5：场景与目的
 * 主要影响歌词内容，不影响音乐风格标签
 */
export const OCCASION_DIMENSION: SongConfigDimension = {
  id: 'occasion',
  title: 'Occasion & Purpose',
  subtitle: 'What is the special moment?',
  options: [
    {
      id: 'birthday',
      icon: '🎂',
      name: 'Birthday Celebration',
      description: 'Happy birthday theme',
      lyricInstruction: 'celebratory tone, happy birthday theme, make the recipient feel special',
    },
    {
      id: 'anniversary',
      icon: '💍',
      name: 'Golden / Silver Anniversary',
      description: 'Everlasting love theme',
      lyricInstruction: 'romantic milestone anthem, everlasting love theme, celebrate years together',
    },
    {
      id: 'christmas_holidays',
      icon: '🎄',
      name: 'Christmas & Holidays',
      description: 'Festive winter spirit',
      lyricInstruction: 'festive warmth, cozy winter holiday spirit, family gathering themes',
    },
    {
      id: 'graduation',
      icon: '🎓',
      name: 'Graduation & New Journey',
      description: 'Proud & encouraging',
      lyricInstruction: 'proud and encouraging tone, future adventure theme, celebrate new beginnings',
    },
    {
      id: 'everyday_love_note',
      icon: '💌',
      name: 'Everyday Love Note',
      description: 'No special reason',
      lyricInstruction: 'intimate, personal letter style, everyday moments of love',
    },
  ],
};

/**
 * 全部维度配置
 */
export const ALL_DIMENSIONS: SongConfigDimension[] = [
  MUSIC_STYLE_DIMENSION,
  AUDIENCE_DIMENSION,
  VOCAL_CHARACTER_DIMENSION,
  EMOTIONAL_VIBE_DIMENSION,
  OCCASION_DIMENSION,
];

/**
 * 用户在 5 个维度上的选择结果
 * 每个字段保存对应维度的 option id
 */
export interface SongConfigSelection {
  musicStyle: string;
  audience: string;
  vocalCharacter: string;
  emotionalVibe: string;
  occasion: string;
}

/**
 * 默认选择（全部为空字符串表示未选择）
 */
export const DEFAULT_SELECTION: SongConfigSelection = {
  musicStyle: '',
  audience: '',
  vocalCharacter: '',
  emotionalVibe: '',
  occasion: '',
};

/**
 * 校验选择是否完整（每个维度都必须选择一项）
 */
export function isSelectionComplete(selection: SongConfigSelection): boolean {
  return (
    selection.musicStyle !== '' &&
    selection.audience !== '' &&
    selection.vocalCharacter !== '' &&
    selection.emotionalVibe !== '' &&
    selection.occasion !== ''
  );
}

/**
 * 根据 option id 查找对应的 option 对象
 */
function findOption(
  dimension: SongConfigDimension,
  optionId: string
): SongConfigOption | undefined {
  return dimension.options.find((opt) => opt.id === optionId);
}

/**
 * 根据 selection 查找全部已选 option
 */
export function resolveSelection(
  selection: SongConfigSelection
): {
  musicStyle?: SongConfigOption;
  audience?: SongConfigOption;
  vocalCharacter?: SongConfigOption;
  emotionalVibe?: SongConfigOption;
  occasion?: SongConfigOption;
} {
  return {
    musicStyle: findOption(MUSIC_STYLE_DIMENSION, selection.musicStyle),
    audience: findOption(AUDIENCE_DIMENSION, selection.audience),
    vocalCharacter: findOption(VOCAL_CHARACTER_DIMENSION, selection.vocalCharacter),
    emotionalVibe: findOption(EMOTIONAL_VIBE_DIMENSION, selection.emotionalVibe),
    occasion: findOption(OCCASION_DIMENSION, selection.occasion),
  };
}

/**
 * 从 songConfig 推导出旧版 genre 字段
 * 用于兼容数据库与后端旧逻辑
 */
export function deriveGenreFromConfig(selection: SongConfigSelection): string {
  const resolved = resolveSelection(selection);
  return resolved.musicStyle?.genreValue || 'Classic Rock';
}

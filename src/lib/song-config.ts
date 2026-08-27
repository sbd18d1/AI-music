/**
 * 歌曲配置维度数据
 *
 * 每个维度最多只能选择一个选项（互斥），避免产生矛盾的提示词。
 * 设计目标：把技术性的 prompt 编写转化为老人也能理解的直观选择。
 *
 * 注意：这些静态定义仅作为【兜底】——前端面板与 prompt 生成实际从数据库读
 * (SongConfigDimension / SongConfigOption)，见 src/components/SongConfigPanel.tsx
 * (fetch /api/song-config) 与 src/lib/song-config-db.ts (resolveSelectionFromDb)。
 * 修改分类的正确方式：更新 prisma/config-export.json 再同步数据库。
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
  /** 附加到 Suno 风格标签的关键词列表 */
  keywords?: string[];
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
  title: 'Music Style & Genre',
  subtitle: 'Pick the vibe that feels like home',
  options: [
    {
      id: 'classic_country',
      icon: '🎸',
      name: 'Classic Country & Folk',
      description: 'Warm storytelling with acoustic guitar & pedal steel',
      styleTag:
        '1970s acoustic country folk, warm analog sound, pedal steel guitar, gentle fingerpicked rhythm, storytelling tempo',
      genreValue: 'Country',
    },
    {
      id: 'classic_rock',
      icon: '🎸',
      name: '1970s Classic Rock',
      description: 'Smooth vintage rock with electric guitar & organs',
      styleTag:
        '1970s classic soft rock, warm hammond organ, smooth electric guitar, solid drums, nostalgic rock feel',
      genreValue: 'Rock',
    },
    {
      id: 'vintage_pop_ballad',
      icon: '🎹',
      name: '60s/70s Pop Ballad',
      description: 'Sweet nostalgic melody with grand piano & strings',
      styleTag:
        '1960s 1970s vintage pop ballad, acoustic grand piano, warm lush string section, smooth melody',
      genreValue: 'Pop',
    },
    {
      id: 'gospel_soul',
      icon: '🎶',
      name: 'Warm Gospel & Soul',
      description: 'Uplifting emotional faith & heart-filled rhythm',
      styleTag:
        'gospel soul, warm organ padding, rhythmic tambourine, uplifting vocal harmonies, spiritual emotional vibe',
      genreValue: 'Gospel',
    },
    {
      id: 'jazz_crooner_swing',
      icon: '🎷',
      name: 'Vintage Jazz & Swing',
      description: 'Classy, relaxed big band or jazz trio',
      styleTag:
        'vintage jazz trio, subtle brush drums, walking bass line, warm brass section, elegant smooth swing tempo',
      genreValue: 'Jazz',
    },
    {
      id: 'upbeat_rockabilly',
      icon: '💃',
      name: '50s Rock & Roll / Rockabilly',
      description: 'Fun, high-energy danceable retro beat',
      styleTag:
        '1950s rockabilly, slapback bass, energetic vintage electric guitar, upbeat danceable rock and roll drum beat',
      genreValue: 'Rock & Roll',
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
      id: 'spouse_partner',
      icon: '💖',
      name: 'My Spouse / Life Partner',
      description: 'For husband, wife, or long-time partner',
      styleTag: 'intimate romantic mood, heartfelt affection, emotional warmth',
      lyricInstruction: 'romantic lifetime love story, shared golden memories, enduring love, appreciation for years together',
    },
    {
      id: 'grandkids_kids',
      icon: '🧒',
      name: 'Grandkids or Children',
      description: 'For beloved grandchildren or kids',
      styleTag: 'playful comforting vibe, loving gentle acoustic touch',
      lyricInstruction: 'themes of unconditional love, watching them grow, life wisdom, sweet storytelling for young generation',
    },
    {
      id: 'parents_grandparents',
      icon: '🏡',
      name: 'Parents or In-Laws',
      description: 'Honoring wisdom, family & roots',
      styleTag: 'reverent honoring tone, warm comforting acoustics',
      lyricInstruction: 'themes of gratitude, lifetime sacrifices, family roots, legacy and deep respect',
    },
    {
      id: 'dear_friend',
      icon: '🤝',
      name: 'A Lifetime Friend',
      description: 'Celebrating years of friendship',
      styleTag: 'warm uplifting acoustic rhythm, cheerful relaxed vibe',
      lyricInstruction: 'themes of laughter, old memories, loyal friendship, shared adventures through the years',
    },
  ],
};

/**
 * 维度3：人声特征
 * 决定主唱的音色与演唱风格
 */
export const VOCAL_CHARACTER_DIMENSION: SongConfigDimension = {
  id: 'vocalCharacter',
  title: 'Vocal Type',
  subtitle: 'Choose the voice that tells your story',
  options: [
    {
      id: 'warm_baritone_male',
      icon: '🎤',
      name: 'Deep & Warm Male Vocal',
      description: 'Rich, resonant classic male tone',
      styleTag: 'deep resonant baritone male vocal, warm conversational tone, sincere storytelling delivery',
    },
    {
      id: 'sweet_vintage_female',
      icon: '🌸',
      name: 'Sweet & Clear Female Vocal',
      description: 'Angelic, smooth vintage female tone',
      styleTag: 'sweet vintage female vocal, high clear tone, soft vibrato, comforting gentle delivery',
    },
    {
      id: 'smooth_crooner_male',
      icon: '🕯️',
      name: 'Smooth Velvet Male Crooner',
      description: 'Romantic 1950s style male singer',
      styleTag: 'velvet smooth male crooner, rich vocal vibrato, romantic tone, intimate microphone distance',
    },
    {
      id: 'harmonious_duet',
      icon: '🎤',
      name: 'Male & Female Duet',
      description: 'Blended male & female harmonies',
      styleTag: 'male and female vocal duet, blended vocal harmonies, emotional back and forth singing',
    },
    {
      id: 'children_choir',
      icon: '👧',
      name: 'Sweet Kids / Grandkids Choir',
      description: 'Innocent, cheerful children singing',
      styleTag: 'innocent children choir, cute playful vocals, sweet group singing, joyful uplifting kid voices',
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
      id: 'tear_jerker_nostalgic',
      icon: '😭',
      name: 'Deeply Touching & Nostalgic',
      description: 'Bittersweet, emotional, tear-jerking',
      styleTag: 'deeply nostalgic, emotional slow burn, poignant string resonance, bittersweet tone',
      lyricInstruction: 'deeply touching and emotional tone, focusing on precious memories that bring happy tears',
    },
    {
      id: 'joyful_sunny',
      icon: '☀️',
      name: 'Heartwarming & Joyful',
      description: 'Uplifting, cheerful, bright major key',
      styleTag: 'uplifting, cheerful, bright major key, heartwarming melody, happy rhythm',
      lyricInstruction: 'cheerful and bright tone, celebrating joy, laughter, and sunny moments',
    },
    {
      id: 'peaceful_serene',
      icon: '🌅',
      name: 'Peaceful & Tranquil',
      description: 'Calm, reflective, soft acoustic padding',
      styleTag: 'tranquil, serene, slow reflective tempo, soft acoustic padding, peaceful atmosphere',
      lyricInstruction: 'peaceful and tranquil tone, calm reflection on life\'s sweet and quiet moments',
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
      id: 'anniversary',
      icon: '💍',
      name: 'Golden / Wedding Anniversary',
      description: 'Celebrating years of marriage',
      lyricInstruction: 'romantic milestone anthem, celebrating golden anniversary or years of marriage together',
    },
    {
      id: 'birthday',
      icon: '🎂',
      name: 'Birthday Milestone',
      description: 'Celebrating a special birthday',
      lyricInstruction: 'celebratory happy birthday theme, making the recipient feel loved, cherished, and honored',
    },
    {
      id: 'retirement_tribute',
      icon: '🎉',
      name: 'Retirement & New Chapter',
      description: 'Honoring a lifetime of hard work',
      lyricInstruction: 'celebrating retirement, freedom, lifetime achievements, and starting a relaxed new chapter',
    },
    {
      id: 'holidays_christmas',
      icon: '🎄',
      name: 'Christmas & Holidays',
      description: 'Cozy holiday gathering theme',
      lyricInstruction: 'cozy winter holiday spirit, festive family warmth, Christmas togetherness and blessings',
    },
    {
      id: 'just_because',
      icon: '💌',
      name: 'Everyday Love Note / Just Because',
      description: 'A surprise gift out of love',
      lyricInstruction: 'intimate, personal letter style song, celebrating simple everyday moments of love',
    },
  ],
};

/**
 * 全部维度配置（兜底用，真实数据以数据库为准）
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


export enum DesignStyle {
  THREE_D = '3D',
  INFOGRAPHIC = 'إنفوجرافيك',
  ILLUSTRATION = 'رسم توضيحي',
  REALISTIC = 'واقعي',
  MODERN_FLAT = 'مسطح حديث'
}

export enum AspectRatio {
  SQUARE = '1:1',
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
  WIDE = '4:3',
  TALL = '3:4'
}

export interface GroundingLink {
  title: string;
  uri: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  style: DesignStyle;
  ratio: AspectRatio;
  groundingLinks?: GroundingLink[];
}

export interface GenerationConfig {
  prompt: string;
  style: DesignStyle;
  ratio: AspectRatio;
  highQuality: boolean;
  variations: number;
  useMaps: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface QuestResult {
  id: string;
  timestamp: number;
  title: string;
  explanation: string; // Markdown
  videoPrompt: string; // Used to generate the video
  visualData: ChartDataPoint[];
  visualType: 'bar' | 'pie' | 'line';
  visualTitle: string;
  quiz: QuizQuestion[];
  nextQuestSuggestions: string[];
  reasoningSummary: string; // The "Thinking" output
  citations: string[];
  confidenceScore: number;
  // New Features
  searchData?: {
    summary: string;
    sources: GroundingSource[];
  };
  mapData?: {
    summary: string;
    links: GroundingSource[];
  };
}

export interface QuestSession {
  id: string;
  inputs: {
    text?: string;
    image?: string; // base64
    audio?: string; // base64
    hypothesis?: string;
  };
  result?: QuestResult;
  // Veo Config & Result
  videoConfig?: {
    prompt: string;
    aspectRatio: '16:9' | '9:16';
    useInputImage: boolean;
  };
  generatedVideoUrl?: string; // The Veo output
  generatedAudioUrl?: string; // The TTS output
  generatedViralClipUrl?: string; // Vertical video
  
  // Loading States
  isVideoLoading: boolean;
  isViralLoading: boolean;
  isSearchLoading?: boolean;
  isMapLoading?: boolean;
  
  userScore?: number; // Quiz score
  chatHistory?: { role: 'user' | 'model'; text: string }[];
}

export interface UserProfile {
  xp: number;
  level: number;
  badges: string[];
  streak: number;
}

export interface AccessibilitySettings {
  dyslexicFont: boolean;
  readingRuler: boolean;
  aslAvatar: boolean;
  highContrast: boolean;
}

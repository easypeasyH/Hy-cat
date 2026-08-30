// Global type for Electron IPC exposed via preload
interface ElectronAPI {
  setIgnoreMouse: (ignore: boolean) => void;
  getConfig: () => Promise<AppConfig>;
  saveConfig: (cfg: Partial<AppConfig>) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  getTopics: () => Promise<Topic[]>;
  createTopic: (data: { id: string; name: string }) => Promise<Topic>;
  renameTopic: (data: { id: string; name: string }) => Promise<boolean>;
  deleteTopic: (id: string) => Promise<boolean>;
  reorderTopics: (orderedIds: string[]) => Promise<boolean>;
  getMessages: (topicId: string) => Promise<DBMessage[]>;
  saveMessage: (data: SaveMessageData) => Promise<DBMessage>;
  sendMessage: (data: SendMessageRequest) => Promise<AIResponse>;
}

interface ModelPreset {
  id: string;
  label: string;
  provider: 'gemini' | 'openai';
  model: string;
  apiKey: string;
  baseUrl?: string;
}

interface AppConfig {
  models: ModelPreset[];
  activeModelId: string;
  petSize: number;
  petOpacity: number;
  floorOffset: number; // 작업표시줄 위로 얼마나 띄울지 (px), 0 = 바로 붙음
}

interface Topic {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface DBMessage {
  id: string;
  topic_id: string;
  role: string;
  content: string;
  attachments: string;
  created_at: string;
}

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  mimeType?: string;
  data?: string;
  textContent?: string;
  previewUrl?: string;
  size: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  timestamp: string;
}

interface SaveMessageData {
  id: string;
  topicId: string;
  role: string;
  content: string;
  attachments?: Attachment[];
}

interface SendMessageRequest {
  messages: ChatMessage[];
  newMessage: string;
  attachments?: Attachment[];
  model: ModelPreset;
}

interface AIResponse {
  text?: string;
  files?: { mimeType: string; data: string }[];
  error?: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
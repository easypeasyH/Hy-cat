// Global type for Electron IPC exposed via preload
interface ElectronAPI {
  setIgnoreMouse: (ignore: boolean) => void;
  getConfig: () => Promise<AppConfig>;
  saveConfig: (cfg: Partial<AppConfig>) => Promise<boolean>;
  getTopics: () => Promise<Topic[]>;
  createTopic: (data: { id: string; name: string }) => Promise<Topic>;
  renameTopic: (data: { id: string; name: string }) => Promise<boolean>;
  deleteTopic: (id: string) => Promise<boolean>;
  reorderTopics: (orderedIds: string[]) => Promise<boolean>;
  getMessages: (topicId: string) => Promise<DBMessage[]>;
  saveMessage: (data: SaveMessageData) => Promise<DBMessage>;
  sendToGemini: (data: GeminiRequest) => Promise<GeminiResponse>;
}

interface AppConfig {
  apiKey: string;
  modelName: string;
  petSize: number;
  petOpacity: number;
  firstRun: boolean;
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
  data?: string; // base64 for images
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

interface GeminiRequest {
  messages: ChatMessage[];
  newMessage: string;
  attachments?: Attachment[];
  apiKey: string;
  modelName: string;
}

interface GeminiResponse {
  text?: string;
  images?: { mimeType: string; data: string }[];
  error?: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};


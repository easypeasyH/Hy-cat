export interface ModelPreset {
  id: string;
  label: string;
  provider: 'gemini' | 'openai';
  model: string;
  apiKey: string;
  baseUrl?: string; // openai 호환 모델(DeepSeek/Qwen/HCX 등)용, 진짜 OpenAI면 비워둠
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  mimeType?: string;
  data?: string;
  textContent?: string;
  previewUrl?: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  timestamp: string;
}

interface TopicChatState {
  messages: ChatMessage[];
  loaded: boolean;
  loading: boolean;
  completedUnseen: boolean;
  error: string;
}

export function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function mimeToExt(mimeType: string): string {
  const known: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.ms-excel': 'xls',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json',
    'application/zip': 'zip',
  };
  if (known[mimeType]) return known[mimeType];
  const sub = (mimeType.split('/')[1] || 'bin').split('+')[0].split(';')[0];
  return sub;
}

class ChatStore {
  private topics = new Map<string, TopicChatState>();
  // 삭제된 토픽의 id. 백그라운드에서 돌던 send()가 나중에 끝나도 여기 있으면
  // 상태를 되살리지 않는다 (그렇지 않으면 "!" 표시를 지울 방법이 없는 유령 토픽이 생김).
  private discarded = new Set<string>();
  private listeners = new Set<() => void>();
  private indicatorSnapshot = { loading: false, unseen: false };

  private notify() {
    const loading = Array.from(this.topics.values()).some(s => s.loading);
    const unseen = Array.from(this.topics.values()).some(s => s.completedUnseen);
    if (loading !== this.indicatorSnapshot.loading || unseen !== this.indicatorSnapshot.unseen) {
      this.indicatorSnapshot = { loading, unseen };
    }
    this.listeners.forEach(fn => fn());
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getIndicatorSnapshot = () => this.indicatorSnapshot;

  private ensure(topicId: string): TopicChatState {
    let s = this.topics.get(topicId);
    if (!s) {
      s = { messages: [], loaded: false, loading: false, completedUnseen: false, error: '' };
      this.topics.set(topicId, s);
    }
    return s;
  }

  // 상태를 항상 "새 객체"로 교체한다. useSyncExternalStore는 getSnapshot()이 돌려주는
  // 참조가 바뀌어야만 리렌더링하므로, 기존 객체를 직접 mutate하면 실제로 값이 바뀌어도
  // 화면이 갱신되지 않는다 (채팅방을 나갔다 들어와야만 보이던 버그의 원인).
  private patch(topicId: string, partial: Partial<TopicChatState>): TopicChatState {
    const next = { ...this.ensure(topicId), ...partial };
    this.topics.set(topicId, next);
    return next;
  }

  getTopicSnapshot = (topicId: string) => this.ensure(topicId);

  async ensureLoaded(topicId: string) {
    const s = this.ensure(topicId);
    if (s.loaded) return;
    const dbMsgs = (await window.electronAPI?.getMessages(topicId)) || [];
    if (this.discarded.has(topicId)) return;
    this.patch(topicId, {
      messages: dbMsgs.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        attachments: JSON.parse(m.attachments || '[]'),
        timestamp: m.created_at,
      })),
      loaded: true,
    });
    this.notify();
  }

  // 그 토픽의 채팅창을 열어봤다는 뜻 — "!" 표시 해제
  markSeen(topicId: string) {
    const s = this.ensure(topicId);
    if (s.completedUnseen) {
      this.patch(topicId, { completedUnseen: false });
      this.notify();
    }
  }

  // 토픽 삭제 시 호출: 이 토픽의 상태를 완전히 지우고, 이후 send()가 끝나도
  // 되살아나지 않도록 표시해둔다. (버그 2 수정)
  discard(topicId: string) {
    this.discarded.add(topicId);
    if (this.topics.delete(topicId)) {
      this.notify();
    }
  }

  async send(topicId: string, model: ModelPreset | undefined, text: string, attachments: Attachment[]) {
    if (this.discarded.has(topicId)) return;

    const userMsg: ChatMessage = {
      id: genId('msg'),
      role: 'user',
      content: text,
      attachments,
      timestamp: new Date().toISOString(),
    };
    const afterUser = this.patch(topicId, {
      messages: [...this.ensure(topicId).messages, userMsg],
      loading: true,
      error: '',
    });
    this.notify();

    await window.electronAPI?.saveMessage({
      id: userMsg.id,
      topicId,
      role: 'user',
      content: text,
      attachments,
    });

    if (this.discarded.has(topicId)) return;

    if (!model) {
      this.finishWithError(topicId, '⚠️ 사용할 AI 모델이 설정되지 않았습니다. 설정에서 모델을 추가/선택해주세요.');
      return;
    }
    if (!model.apiKey) {
      this.finishWithError(topicId, `⚠️ "${model.label}" 모델의 API Key가 없습니다. 설정에서 입력해주세요.`);
      return;
    }

    const context = afterUser.messages.slice(-20);
    let response: { text?: string; files?: { mimeType: string; data: string }[]; error?: string } | undefined;
    try {
      response = await window.electronAPI?.sendMessage({
        messages: context,
        newMessage: text || '(첨부 파일 참고)',
        attachments,
        model,
      });
    } catch (e) {
      response = { error: 'AI 응답을 가져오지 못했습니다.' };
    }

    if (this.discarded.has(topicId)) return;

    const assistantContent = response?.error || response?.text || 'AI 응답을 받지 못했습니다.';

    // AI가 돌려준 inlineData를 mimeType으로 구분: 이미지는 미리보기, 그 외(PDF/PPT/오디오 등)는
    // 다운로드 가능한 파일 첨부로 처리한다.
    const assistantAttachments: Attachment[] = (response?.files || []).map(f => {
      const isImage = f.mimeType.startsWith('image/');
      const ext = mimeToExt(f.mimeType);
      return {
        id: genId('att'),
        name: isImage ? `generated.${ext || 'png'}` : `generated.${ext}`,
        type: isImage ? 'image' : 'file',
        mimeType: f.mimeType,
        data: f.data,
        previewUrl: isImage ? `data:${f.mimeType};base64,${f.data}` : undefined,
        size: 0,
      };
    });

    const assistantMsg: ChatMessage = {
      id: genId('msg'),
      role: 'assistant',
      content: assistantContent,
      attachments: assistantAttachments.length ? assistantAttachments : undefined,
      timestamp: new Date().toISOString(),
    };

    this.patch(topicId, {
      messages: [...this.ensure(topicId).messages, assistantMsg],
      loading: false,
      error: response?.error || '',
      completedUnseen: true,
    });
    this.notify();

    await window.electronAPI?.saveMessage({
      id: assistantMsg.id,
      topicId,
      role: 'assistant',
      content: assistantContent,
      attachments: assistantAttachments,
    });
  }

  private finishWithError(topicId: string, message: string) {
    if (this.discarded.has(topicId)) return;
    const errMsg: ChatMessage = {
      id: genId('msg'),
      role: 'assistant',
      content: message,
      timestamp: new Date().toISOString(),
    };
    this.patch(topicId, {
      messages: [...this.ensure(topicId).messages, errMsg],
      loading: false,
      completedUnseen: true,
    });
    this.notify();
  }
}

export const chatStore = new ChatStore();
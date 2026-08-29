import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Paperclip, X, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Topic {
  id: string;
  name: string;
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

interface ChatViewProps {
  topic: Topic;
  onBack: () => void;
}

function genId(prefix = 'msg') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

const ChatView: React.FC<ChatViewProps> = ({ topic, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const dbMsgs = await window.electronAPI?.getMessages(topic.id) || [];
      const parsed: ChatMessage[] = dbMsgs.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        attachments: JSON.parse(m.attachments || '[]'),
        timestamp: m.created_at,
      }));
      setMessages(parsed);
    };
    load();
    setIsDraggingOver(false);
  }, [topic.id]);

  useEffect(() => {
    return () => setIsDraggingOver(false);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const base64 = (ev.target?.result as string).split(',')[1];
            const att: Attachment = {
              id: genId('att'),
              name: `clipboard_${Date.now()}.png`,
              type: 'image',
              mimeType: blob.type,
              data: base64,
              previewUrl: ev.target?.result as string,
              size: blob.size,
            };
            setAttachments(prev => [...prev, att]);
          };
          reader.readAsDataURL(blob);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processFile = useCallback((file: File): Promise<Attachment> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      if (file.type.startsWith('image/')) {
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          resolve({
            id: genId('att'),
            name: file.name,
            type: 'image',
            mimeType: file.type,
            data: dataUrl.split(',')[1],
            previewUrl: dataUrl,
            size: file.size,
          });
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (ev) => {
          resolve({
            id: genId('att'),
            name: file.name,
            type: 'file',
            textContent: ev.target?.result as string,
            size: file.size,
          });
        };
        reader.readAsText(file);
      }
    });
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    const processed = await Promise.all(files.map(processFile));
    setAttachments(prev => [...prev, ...processed]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const processed = await Promise.all(files.map(processFile));
    setAttachments(prev => [...prev, ...processed]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text && attachments.length === 0) return;
    if (isLoading) return;

    setError('');

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: text,
      attachments: [...attachments],
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setAttachments([]);
    setIsLoading(true);

    await window.electronAPI?.saveMessage({
      id: userMsg.id,
      topicId: topic.id,
      role: 'user',
      content: text,
      attachments: userMsg.attachments,
    });

    const cfg = await window.electronAPI?.getConfig();
    if (!cfg?.apiKey) {
      const errMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: '⚠️ Gemini API Key가 설정되지 않았습니다. 설정(⚙️)에서 API Key를 입력해주세요.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
      setIsLoading(false);
      return;
    }

    const contextMessages = messages.slice(-20);

    const response = await window.electronAPI?.sendToGemini({
      messages: contextMessages,
      newMessage: text || '(첨부 파일 참고)',
      attachments: userMsg.attachments,
      apiKey: cfg.apiKey,
      modelName: cfg.modelName || 'gemini-3.6-flash',
    });

    const assistantContent = response?.error || response?.text || 'AI 응답을 받지 못했습니다.';

    // If the model returned image parts (only image-capable models like
    // gemini-3.1-flash-image-preview do this), turn them into attachments.
    const assistantAttachments: Attachment[] = (response?.images || []).map(img => ({
      id: genId('att'),
      name: 'generated.png',
      type: 'image',
      mimeType: img.mimeType,
      data: img.data,
      previewUrl: `data:${img.mimeType};base64,${img.data}`,
      size: 0,
    }));

    const assistantMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
      content: assistantContent,
      attachments: assistantAttachments.length > 0 ? assistantAttachments : undefined,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, assistantMsg]);
    setIsLoading(false);

    if (response?.error) {
      setError(response.error);
    }

    await window.electronAPI?.saveMessage({
      id: assistantMsg.id,
      topicId: topic.id,
      role: 'assistant',
      content: assistantContent,
      attachments: assistantAttachments,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className={`flex flex-col h-full ${isDraggingOver ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h2 className="font-bold text-gray-800 flex-1 truncate">{topic.name}</h2>
      </div>

      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-blue-50/90 flex items-center justify-center rounded-xl pointer-events-none">
          <div className="text-center">
            <p className="text-4xl mb-2">📎</p>
            <p className="text-blue-600 font-semibold">파일을 놓으세요</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <p className="text-3xl mb-2">🐱</p>
            <p>안녕하세요! 무엇을 도와드릴까요?</p>
            <p className="text-xs mt-1">텍스트 입력, 파일 드래그, Ctrl+V 이미지 첨부 가능</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1 max-w-[85%]">
                {msg.attachments.map(att => att.type === 'image' && att.previewUrl ? (
                  <img
                    key={att.id}
                    src={att.previewUrl}
                    alt={att.name}
                    className="max-w-[220px] max-h-[220px] rounded-lg object-contain border border-gray-200 bg-white"
                  />
                ) : (
                  <div key={att.id} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
                    📎 {att.name}
                  </div>
                ))}
              </div>
            )}

            {msg.content && (
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-code:text-xs prose-pre:bg-gray-800 prose-pre:text-gray-100 selectable-text">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap selectable-text">{msg.content}</p>
                )}
              </div>
            )}
            <span className="text-xs text-gray-400 mt-0.5 px-1">{formatTime(msg.timestamp)}</span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-sm">AI가 생각 중...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {attachments.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 flex flex-wrap gap-2 flex-shrink-0">
          {attachments.map(att => (
            <div key={att.id} className="relative group">
              {att.type === 'image' && att.previewUrl ? (
                <img
                  src={att.previewUrl}
                  alt={att.name}
                  className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                />
              ) : (
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600 max-w-[120px]">
                  <span className="truncate">📎 {att.name}</span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept="image/*,.txt,.pdf,.md,.js,.ts,.py,.json,.csv" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors mb-0.5"
          >
            <Paperclip size={18} />
          </button>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            rows={1}
            className="flex-1 bg-transparent resize-none focus:outline-none text-sm text-gray-800 placeholder-gray-400 max-h-24 overflow-y-auto"
            style={{ minHeight: '24px' }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 96) + 'px';
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || (!inputText.trim() && attachments.length === 0)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-0.5"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1 text-center">Ctrl+V로 클립보드 이미지 첨부 가능</p>
      </div>
    </div>
  );
};

export default ChatView;
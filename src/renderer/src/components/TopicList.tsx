import React, { useState, useEffect, useRef } from 'react';
import { Plus, MoreVertical, X, Check, Trash2, Edit2, GripVertical } from 'lucide-react';
import appIcon from '../assets/app-icon.png';
import { chatStore } from '../chatStore';

interface Topic {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface TopicListProps {
  onSelectTopic: (topic: Topic) => void;
}

function generateId() {
  return 'topic_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

type DropIndicator = { index: number; edge: 'top' | 'bottom' } | null;

const TopicList: React.FC<TopicListProps> = ({ onSelectTopic }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [menuTopicId, setMenuTopicId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);
  const dragIdRef = useRef<string | null>(null);

  const loadTopics = async () => {
    const list = await window.electronAPI?.getTopics() || [];
    setTopics(list);
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const handleCreate = async () => {
    const name = newTopicName.trim();
    if (!name) { setError('토픽 이름을 입력하세요.'); return; }
    const topic = await window.electronAPI?.createTopic({ id: generateId(), name });
    if (topic) {
      setTopics(prev => [topic, ...prev]);
      setIsCreating(false);
      setNewTopicName('');
      setError('');
    }
  };

  const handleRename = async (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    await window.electronAPI?.renameTopic({ id, name });
    setTopics(prev => prev.map(t => t.id === id ? { ...t, name } : t));
    setRenamingId(null);
    setMenuTopicId(null);
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI?.deleteTopic(id);
    // 아직 AI 응답이 진행 중이던 토픽이었다면 chatStore에서도 완전히 지워서,
    // 나중에 응답이 도착해도 "!" 표시가 되살아나지 않게 한다.
    chatStore.discard(id);
    setTopics(prev => prev.filter(t => t.id !== id));
    setDeleteConfirmId(null);
    setMenuTopicId(null);
  };

  // ── Drag-to-reorder: shows a thin insertion line BETWEEN items instead of
  // highlighting the whole target row, so it's unambiguous where the item will land. ──
  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverRow = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isTopHalf = e.clientY < rect.top + rect.height / 2;
    setDropIndicator({ index, edge: isTopHalf ? 'top' : 'bottom' });
  };

  const handleDragLeaveList = (e: React.DragEvent) => {
    // Only clear if we actually left the whole list container (not just moving between rows)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDropIndicator(null);
    }
  };

  const commitDrop = () => {
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    const indicator = dropIndicator;
    setDropIndicator(null);
    if (!draggedId || !indicator) return;

    setTopics(prev => {
      const next = [...prev];
      const fromIdx = next.findIndex(t => t.id === draggedId);
      if (fromIdx === -1) return prev;
      const [moved] = next.splice(fromIdx, 1);

      let insertAt = indicator.index;
      if (fromIdx < indicator.index) insertAt -= 1;
      if (indicator.edge === 'bottom') insertAt += 1;
      insertAt = Math.max(0, Math.min(insertAt, next.length));

      next.splice(insertAt, 0, moved);
      window.electronAPI?.reorderTopics(next.map(t => t.id));
      return next;
    });
  };

  const handleDragEnd = () => {
    dragIdRef.current = null;
    setDropIndicator(null);
  };

  const isDragDisabled = (id: string) => renamingId === id || deleteConfirmId === id || menuTopicId === id;

  const InsertLine = () => <div className="h-0.5 my-1 mx-2 bg-blue-400 rounded-full" />;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
          <img src={appIcon} alt="" className="w-6 h-6 rounded-full object-cover" />
          Chat Topic
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">토픽을 선택하거나 새로 만드세요! 드래그로 순서 변경</p>
      </div>

      <div
        className="flex-1 overflow-y-auto p-3 space-y-2"
        onDragLeave={handleDragLeaveList}
        onDrop={e => { e.preventDefault(); commitDrop(); }}
      >
        {topics.length === 0 && !isCreating && (
          <div className="text-center py-10 text-gray-400 text-sm">
            <p className="text-3xl mb-2">💬</p>
            <p>아직 대화 주제가 없어요.</p>
            <p>아래 버튼으로 첫 대화를 시작해보세요!</p>
          </div>
        )}

        {topics.map((topic, index) => (
          <React.Fragment key={topic.id}>
            {dropIndicator?.index === index && dropIndicator.edge === 'top' && <InsertLine />}

            <div
              className="relative"
              draggable={!isDragDisabled(topic.id)}
              onDragStart={handleDragStart(topic.id)}
              onDragOver={handleDragOverRow(index)}
            >
              {renamingId === topic.id ? (
                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-xl">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(topic.id); if (e.key === 'Escape') setRenamingId(null); }}
                    className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button onClick={() => handleRename(topic.id)} className="text-green-500 hover:text-green-700"><Check size={16} /></button>
                  <button onClick={() => setRenamingId(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
              ) : deleteConfirmId === topic.id ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm">
                  <p className="text-red-700 font-medium mb-2">"{topic.name}"을 삭제할까요?</p>
                  <p className="text-red-400 text-xs mb-3">대화 내용도 함께 삭제됩니다.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs hover:bg-gray-50">취소</button>
                    <button onClick={() => handleDelete(topic.id)} className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs hover:bg-red-600">삭제</button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center justify-between p-3 bg-white hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl cursor-pointer transition-all group"
                  onClick={() => onSelectTopic(topic)}
                >
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span
                      className="text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                      title="드래그해서 순서 변경"
                    >
                      <GripVertical size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{topic.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(topic.updated_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setMenuTopicId(menuTopicId === topic.id ? null : topic.id); }}
                    className="ml-2 w-7 h-7 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-200 text-gray-400 transition-all"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
              )}

              {menuTopicId === topic.id && renamingId !== topic.id && deleteConfirmId !== topic.id && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[140px]">
                  <button
                    onClick={() => { setRenamingId(topic.id); setRenameValue(topic.name); setMenuTopicId(null); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Edit2 size={14} /> 이름 변경
                  </button>
                  <button
                    onClick={() => { setDeleteConfirmId(topic.id); setMenuTopicId(null); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={14} /> 삭제
                  </button>
                </div>
              )}
            </div>

            {dropIndicator?.index === index && dropIndicator.edge === 'bottom' && <InsertLine />}
          </React.Fragment>
        ))}

        {isCreating && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
            <input
              autoFocus
              value={newTopicName}
              onChange={e => { setNewTopicName(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setIsCreating(false); setError(''); } }}
              placeholder="토픽 이름 입력..."
              className="w-full px-3 py-2 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setIsCreating(false); setError(''); }} className="flex-1 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleCreate} className="flex-1 py-1.5 text-xs rounded-lg bg-blue-500 text-white hover:bg-blue-600">생성</button>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100" onClick={() => setMenuTopicId(null)}>
        <button
          onClick={e => { e.stopPropagation(); setIsCreating(true); setMenuTopicId(null); }}
          className="w-full py-2.5 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all text-sm font-medium"
        >
          <Plus size={16} /> 새 토픽
        </button>
      </div>
    </div>
  );
};

export default React.memo(TopicList);
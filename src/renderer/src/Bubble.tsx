import React, { useState, useRef, useCallback } from 'react';
import { X, Settings, ChevronLeft, Maximize2, Minimize2 } from 'lucide-react';
import TopicList from './components/TopicList';
import ChatView from './components/ChatView';
import SettingsPanel from './components/SettingsPanel';

type BubbleView = 'topics' | 'chat' | 'settings';

interface Topic {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface BubbleProps {
  isVisible: boolean;
  onClose: () => void;
  petPosition: { x: number; y: number };
  petSize: number;
  viewportWidth: number;
  viewportHeight: number;
  onRequestMouseCatch: (catching: boolean) => void;
}

const Bubble: React.FC<BubbleProps> = ({
  isVisible,
  onClose,
  petPosition,
  petSize,
  viewportWidth,
  viewportHeight,
  onRequestMouseCatch,
}) => {
  const [size, setSize] = useState({ width: 360, height: 480 });
  const [isMaximized, setIsMaximized] = useState(false);
  const preMaxSizeRef = useRef({ width: 360, height: 480 });
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [view, setView] = useState<BubbleView>('topics');
  const isInteractingRef = useRef(false);

  // ⚠️ 모든 hook은 early return(아래 `if (!isVisible) return null;`)보다 반드시 먼저 와야 합니다.
  const handleSelectTopic = useCallback((topic: Topic) => {
    setSelectedTopic(topic);
    setView('chat');
  }, []);

  const handleBack = useCallback(() => {
    setView('topics');
    setSelectedTopic(null);
  }, []);

  const handleOpenSettings = useCallback(() => setView('settings'), []);
  const handleCloseSettings = useCallback(() => {
    setView(prev => (prev === 'settings' ? (selectedTopic ? 'chat' : 'topics') : prev));
  }, [selectedTopic]);

  const margin = 8;
  const gap = 16;

  const effWidth = Math.min(size.width, viewportWidth - margin * 2);
  const effHeight = Math.min(size.height, viewportHeight - margin * 2);

  let left = petPosition.x - effWidth / 2 + petSize / 2;
  left = Math.max(margin, Math.min(left, viewportWidth - effWidth - margin));

  let top = petPosition.y - effHeight - gap;
  let placedBelow = false;

  if (top < margin) {
    const belowTop = petPosition.y + petSize + gap;
    if (belowTop + effHeight <= viewportHeight - margin) {
      top = belowTop;
      placedBelow = true;
    } else {
      top = margin;
    }
  }

  const handleMouseEnter = () => onRequestMouseCatch(true);
  const handleMouseLeave = () => {
    if (!isInteractingRef.current) onRequestMouseCatch(false);
  };

  const handleToggleMaximize = () => {
    if (isMaximized) {
      setSize(preMaxSizeRef.current);
      setIsMaximized(false);
    } else {
      preMaxSizeRef.current = size;
      setSize({ width: viewportWidth - margin * 2, height: viewportHeight - margin * 2 });
      setIsMaximized(true);
    }
  };

  type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  const resizeDragRef = useRef({
    isDragging: false,
    edge: 'se' as ResizeEdge,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  const MIN_WIDTH = 280;
  const MIN_HEIGHT = 320;

  const handleResizeStart = (edge: ResizeEdge) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isInteractingRef.current = true;
    onRequestMouseCatch(true);
    if (isMaximized) setIsMaximized(false);
    resizeDragRef.current = {
      isDragging: true,
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };

    const onMove = (mv: MouseEvent) => {
      const drag = resizeDragRef.current;
      if (!drag.isDragging) return;
      const dx = mv.clientX - drag.startX;
      const dy = mv.clientY - drag.startY;
      onRequestMouseCatch(true);

      let widthDelta = 0;
      if (drag.edge.includes('e')) widthDelta = dx;
      else if (drag.edge.includes('w')) widthDelta = -dx;

      let heightDelta = 0;
      if (drag.edge.includes('s')) heightDelta = dy;
      else if (drag.edge.includes('n')) heightDelta = -dy;

      setSize(prev => ({
        width: widthDelta !== 0
          ? Math.min(Math.max(MIN_WIDTH, drag.startWidth + widthDelta), viewportWidth - margin * 2)
          : prev.width,
        height: heightDelta !== 0
          ? Math.min(Math.max(MIN_HEIGHT, drag.startHeight + heightDelta), viewportHeight - margin * 2)
          : prev.height,
      }));
    };

    const onUp = () => {
      resizeDragRef.current.isDragging = false;
      isInteractingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!isVisible) return null;

  const petCenterX = petPosition.x + petSize / 2;
  const tailX = Math.max(16, Math.min(petCenterX - left - 8, effWidth - 32));

  return (
    <div
      className="absolute pointer-events-auto"
      style={{ width: effWidth, height: effHeight, left, top, zIndex: 40 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
        {view !== 'settings' && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-2">
              {view === 'chat' && (
                <button onClick={handleBack} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                  <ChevronLeft size={16} />
                </button>
              )}
              <span className="font-bold text-gray-700 text-sm">
                {view === 'topics' && 'Hy_cat'}
                {view === 'chat' && selectedTopic?.name}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleMaximize}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                title={isMaximized ? '원래 크기로' : '최대화'}
              >
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={handleOpenSettings}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <Settings size={15} />
              </button>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden relative">
          {view === 'topics' && <TopicList onSelectTopic={handleSelectTopic} />}
          {view === 'chat' && selectedTopic && <ChatView topic={selectedTopic} onBack={handleBack} />}
          {view === 'settings' && <SettingsPanel onClose={handleCloseSettings} />}
        </div>
      </div>

      <div className="absolute -top-1 left-0 right-0 h-3 cursor-ns-resize z-30" onMouseDown={handleResizeStart('n')} title="드래그해서 크기 조절" />
      <div className="absolute -bottom-1 left-0 right-0 h-3 cursor-ns-resize z-30" onMouseDown={handleResizeStart('s')} title="드래그해서 크기 조절" />
      <div className="absolute -left-1 top-0 bottom-0 w-3 cursor-ew-resize z-30" onMouseDown={handleResizeStart('w')} title="드래그해서 크기 조절" />
      <div className="absolute -right-1 top-0 bottom-0 w-3 cursor-ew-resize z-30" onMouseDown={handleResizeStart('e')} title="드래그해서 크기 조절" />
      <div className="absolute -top-1 -left-1 w-4 h-4 cursor-nwse-resize z-50" onMouseDown={handleResizeStart('nw')} title="드래그해서 크기 조절" />
      <div className="absolute -top-1 -right-1 w-4 h-4 cursor-nesw-resize z-50" onMouseDown={handleResizeStart('ne')} title="드래그해서 크기 조절" />
      <div className="absolute -bottom-1 -left-1 w-4 h-4 cursor-nesw-resize z-50" onMouseDown={handleResizeStart('sw')} title="드래그해서 크기 조절" />
      <div
        className="absolute -bottom-1 -right-1 w-9 h-9 cursor-nwse-resize z-50 flex items-end justify-end p-2 text-gray-300 hover:text-gray-500"
        onMouseDown={handleResizeStart('se')}
        title="드래그해서 크기 조절"
      >
        <svg viewBox="0 0 10 10" width="12" height="12" fill="currentColor">
          <path d="M0 10 L10 0 L10 10 Z" />
        </svg>
      </div>

      <div
        className={
          placedBelow
            ? 'absolute w-3 h-3 bg-white border-t border-l border-gray-200 transform rotate-45'
            : 'absolute w-3 h-3 bg-white border-b border-r border-gray-200 transform rotate-45'
        }
        style={placedBelow ? { top: -7, left: tailX } : { bottom: -7, left: tailX }}
      />
    </div>
  );
};

export default Bubble;
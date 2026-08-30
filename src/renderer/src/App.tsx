import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import Bubble from './Bubble';
import { chatStore } from './chatStore';
import idleImg from './assets/pet/idle.png';
import sleepingImg from './assets/pet/sleeping.png';
import fallingImg from './assets/pet/falling.png';
import hoverGif from './assets/pet/hover.gif';

type PetState = 'PET_IDLE_MOVING' | 'PET_DRAGGING' | 'PET_FALLING' | 'PET_IDLE_STOPPED';

const App = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [petState, setPetState] = useState<PetState>('PET_IDLE_MOVING');
  const [position, setPosition] = useState({
    x: window.innerWidth - 160,
    y: window.innerHeight - 160,
  });
  const [showBubble, setShowBubble] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  const positionRef = useRef(position);
  const stateRef = useRef(petState);
  const configRef = useRef(config);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const velocityYRef = useRef(0);
  const bubbleOpenRef = useRef(false);
  const mouseCatchRef = useRef(false);
  const lastMouseRef = useRef({ x: -9999, y: -9999 });

  const indicator = useSyncExternalStore(chatStore.subscribe, chatStore.getIndicatorSnapshot);

  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { stateRef.current = petState; }, [petState]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { bubbleOpenRef.current = showBubble; }, [showBubble]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { lastMouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!window.electronAPI) return;
      const cfg = await window.electronAPI.getConfig();
      if (cfg) setConfig(cfg);
    };
    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!window.electronAPI) return;
      const cfg = await window.electronAPI.getConfig();
      if (cfg) setConfig(cfg);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const setMouseCatch = useCallback((catching: boolean) => {
    if (mouseCatchRef.current === catching) return;
    mouseCatchRef.current = catching;
    window.electronAPI?.setIgnoreMouse(!catching);
  }, []);

  useEffect(() => {
    let raf: number;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const state = stateRef.current;
      const pos = { ...positionRef.current };
      const size = configRef.current?.petSize || 96;
      const floorOffset = configRef.current?.floorOffset ?? 0;
      const groundY = window.innerHeight - size - floorOffset;

      if (state === 'PET_FALLING') {
        velocityYRef.current += 900 * dt;
        pos.y += velocityYRef.current * dt;
        if (pos.y >= groundY) {
          pos.y = groundY;
          velocityYRef.current = 0;
          setPetState('PET_IDLE_MOVING');
        }
        setPosition({ ...pos });
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleMouseEnter = () => { setMouseCatch(true); setIsHovering(true); };
  const handleMouseLeave = () => { setMouseCatch(false); setIsHovering(false); };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setPetState('PET_DRAGGING');
    setMouseCatch(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: positionRef.current.x,
      initialY: positionRef.current.y,
    };

    const onMove = (ev: MouseEvent) => {
      const size = configRef.current?.petSize || 96;
      const floorOffset = configRef.current?.floorOffset ?? 0;
      let nx = dragRef.current.initialX + (ev.clientX - dragRef.current.startX);
      let ny = dragRef.current.initialY + (ev.clientY - dragRef.current.startY);
      nx = Math.max(0, Math.min(nx, window.innerWidth - size));
      ny = Math.max(0, Math.min(ny, window.innerHeight - size - floorOffset));
      setPosition({ x: nx, y: ny });
      setMouseCatch(true);
    };

    const onUp = () => {
      velocityYRef.current = 0;
      setPetState('PET_FALLING');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (petState === 'PET_IDLE_STOPPED' && showBubble) {
      closeBubble();
    } else {
      setPetState('PET_IDLE_STOPPED');
      setShowBubble(true);
      setMouseCatch(true);
    }
  };

  const closeBubble = useCallback(() => {
    setShowBubble(false);
    setPetState('PET_IDLE_MOVING');
    const { x, y } = lastMouseRef.current;
    const pos = positionRef.current;
    const size = configRef.current?.petSize || 96;
    const overPet = x >= pos.x && x <= pos.x + size && y >= pos.y && y <= pos.y + size;
    setMouseCatch(overPet);
  }, []);

  if (!config) return null;
  const { petSize, petOpacity } = config;

  const HOVER_SCALE = 1.2;

  const petImage = (() => {
    if (petState === 'PET_IDLE_STOPPED') return sleepingImg;
    if (petState === 'PET_FALLING') return fallingImg;
    return idleImg;
  })();

  const showHoverGif = isHovering && petState === 'PET_IDLE_MOVING';

  const showIndicator = !showBubble && (indicator.loading || indicator.unseen);

  return (
    <div className="w-full h-full relative pointer-events-none overflow-hidden">
      <Bubble
        isVisible={showBubble}
        onClose={closeBubble}
        petPosition={position}
        petSize={petSize}
        viewportWidth={viewport.width}
        viewportHeight={viewport.height}
        onRequestMouseCatch={setMouseCatch}
      />

      <div
        className="absolute cursor-pointer select-none pointer-events-auto"
        style={{
          width: petSize,
          height: petSize,
          left: position.x,
          top: position.y,
          opacity: petOpacity,
          zIndex: 50,
          transition: petState === 'PET_DRAGGING' ? 'none' : undefined,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
        {showIndicator && (
          <div
            className="absolute -top-9 left-1/2 -translate-x-1/2 w-7 h-7 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center"
            style={{ zIndex: 60 }}
          >
            {indicator.loading ? (
              <Loader2 size={14} className="animate-spin text-blue-400" />
            ) : (
              <span className="text-blue-500 font-bold text-sm leading-none">!</span>
            )}
          </div>
        )}

        {showHoverGif ? (
          <div
            className="absolute pointer-events-none"
            style={{
              width: petSize * HOVER_SCALE,
              height: petSize * HOVER_SCALE,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <img src={hoverGif} alt="cat" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <img
              src={petImage}
              alt="cat"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
        )}
        {petState !== 'PET_IDLE_STOPPED' && !showIndicator && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap pointer-events-none">
            우클릭으로 채팅 열기
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
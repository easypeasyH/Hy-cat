import React, { useState, useEffect, useRef, useCallback } from 'react';
import Bubble from './Bubble';
import idleImg from './assets/pet/idle.png';
import sleepingImg from './assets/pet/sleeping.png';
import fallingImg from './assets/pet/falling.png';

type PetState = 'PET_IDLE_MOVING' | 'PET_DRAGGING' | 'PET_FALLING' | 'PET_IDLE_STOPPED';

interface AppConfig {
  apiKey: string;
  modelName: string;
  petSize: number;
  petOpacity: number;
}

const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  modelName: 'gemini-3.6-flash',
  petSize: 96,
  petOpacity: 1.0,
};

const App = () => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [petState, setPetState] = useState<PetState>('PET_IDLE_MOVING');
  const [position, setPosition] = useState({
    x: window.innerWidth - 160,
    y: window.innerHeight - 160,
  });
  const [showBubble, setShowBubble] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  const positionRef = useRef(position);
  const stateRef = useRef(petState);
  const configRef = useRef(config);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const velocityYRef = useRef(0);
  const bubbleOpenRef = useRef(false);
  const mouseCatchRef = useRef(false);

  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { stateRef.current = petState; }, [petState]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { bubbleOpenRef.current = showBubble; }, [showBubble]);

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
      const size = configRef.current.petSize;
      const groundY = window.innerHeight - size - 40;

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

  const handleMouseEnter = () => setMouseCatch(true);
  const handleMouseLeave = () => setMouseCatch(false);

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
      const size = configRef.current.petSize;
      let nx = dragRef.current.initialX + (ev.clientX - dragRef.current.startX);
      let ny = dragRef.current.initialY + (ev.clientY - dragRef.current.startY);
      nx = Math.max(0, Math.min(nx, window.innerWidth - size));
      ny = Math.max(0, Math.min(ny, window.innerHeight - size));
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

  const closeBubble = () => {
    setShowBubble(false);
    setPetState('PET_IDLE_MOVING');
    setMouseCatch(false);
  };

  const { petSize, petOpacity } = config;

  // Pick the sprite for the current state.
  // PET_IDLE_MOVING and PET_DRAGGING both use the default "idle" image —
  // add more imports above + branches here if you want dedicated sprites for those too.
  const petImage = (() => {
    if (petState === 'PET_IDLE_STOPPED') return sleepingImg;
    if (petState === 'PET_FALLING') return fallingImg;
    return idleImg;
  })();

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
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
          <img
            src={petImage}
            alt="cat"
            className="w-full h-full object-contain pointer-events-none"
          />
        </div>
        {petState !== 'PET_IDLE_STOPPED' && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap pointer-events-none">
            우클릭으로 채팅 열기
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
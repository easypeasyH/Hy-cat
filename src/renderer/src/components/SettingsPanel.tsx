import React, { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';

const APP_VERSION = '1.0.0';
const APP_AUTHOR = 'EasyH';
const APP_EMAIL = '8286wlgns@naver.com';
const APP_COMMENT = '개선 요청은 메일문의 부탁드립니다.';

interface SettingsPanelProps {
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('gemini-3.6-flash');
  const [petSize, setPetSize] = useState(96);
  const [petOpacity, setPetOpacity] = useState(1.0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.electronAPI?.getConfig().then(cfg => {
      if (cfg) {
        setApiKey(cfg.apiKey || '');
        setModelName(cfg.modelName || 'gemini-3.6-flash');
        setPetSize(cfg.petSize || 96);
        setPetOpacity(cfg.petOpacity ?? 1.0);
      }
    });
  }, []);

  const handleSave = async () => {
    await window.electronAPI?.saveConfig({ apiKey, modelName, petSize, petOpacity });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-gray-500" />
          <h2 className="font-bold text-gray-800">설정</h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* API Key */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Gemini API Key
          </label>
          <p className="text-xs text-gray-400">Google AI Studio에서 발급받은 API Key를 입력하세요.</p>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="AI model key..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
          {!apiKey && (
            <p className="text-xs text-amber-500">⚠ API Key가 없으면 AI와 대화할 수 없습니다.</p>
          )}
        </div>

        {/* Model Name */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Gemini 모델
          </label>
          <input
            type="text"
            value={modelName}
            onChange={e => setModelName(e.target.value)}
            placeholder="gemini-3.6-flash"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
          <p className="text-xs text-gray-400">예: gemini-3.6-flash, gemini-2.5-pro, gemini-3.1-flash-image-preview</p>
        </div>

        {/* Pet Size */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            고양이 크기: <span className="text-blue-500">{petSize}px</span>
          </label>
          <input
            type="range"
            min={48}
            max={160}
            value={petSize}
            onChange={e => setPetSize(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>작게 (48px)</span>
            <span>크게 (160px)</span>
          </div>
        </div>

        {/* Pet Opacity */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            고양이 불투명도: <span className="text-blue-500">{Math.round(petOpacity * 100)}%</span>
          </label>
          <input
            type="range"
            min={0.2}
            max={1.0}
            step={0.05}
            value={petOpacity}
            onChange={e => setPetOpacity(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>투명 (20%)</span>
            <span>불투명 (100%)</span>
          </div>
        </div>

        {/* App Info */}
        <div className="space-y-1 pt-2">
          <p className="text-sm font-semibold text-gray-400">프로그램 정보</p>
          <div className="text-xs text-gray-300 space-y-0.5">
            <p>버전: {APP_VERSION}</p>
            <p>제작자: {APP_AUTHOR}</p>
            <p>이메일: {APP_EMAIL}</p>
            <p>{APP_COMMENT}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {saved ? '✓ 저장됨!' : '설정 저장'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;

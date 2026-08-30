import React, { useState, useEffect } from 'react';
import { X, Settings, Plus, Trash2, Edit2, Check } from 'lucide-react';

const APP_AUTHOR = 'EasyH';
const APP_EMAIL = '8286wlgns@naver.com';
const APP_COMMENT = '개선 요청은 메일문의 부탁드립니다.';

interface SettingsPanelProps {
  onClose: () => void;
}

function generateModelId() {
  return 'model_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

const emptyForm = { label: '', provider: 'gemini' as 'gemini' | 'openai', model: '', apiKey: '', baseUrl: '' };

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [models, setModels] = useState<ModelPreset[]>([]);
  const [activeModelId, setActiveModelId] = useState('');
  const [petSize, setPetSize] = useState(96);
  const [petOpacity, setPetOpacity] = useState(1.0);
  const [floorOffset, setFloorOffset] = useState(0);
  const [saved, setSaved] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    window.electronAPI?.getConfig().then(cfg => {
      if (cfg) {
        setModels(cfg.models || []);
        setActiveModelId(cfg.activeModelId || (cfg.models?.[0]?.id ?? ''));
        setPetSize(cfg.petSize || 96);
        setPetOpacity(cfg.petOpacity ?? 1.0);
        setFloorOffset(cfg.floorOffset ?? 0);
      }
    });
  }, []);

  useEffect(() => {
    window.electronAPI?.getAppVersion().then(v => setAppVersion(v));
  }, []);

  const persist = async (nextModels: ModelPreset[], nextActiveId: string) => {
    await window.electronAPI?.saveConfig({ models: nextModels, activeModelId: nextActiveId, petSize, petOpacity, floorOffset });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleSave = async () => {
    await window.electronAPI?.saveConfig({ models, activeModelId, petSize, petOpacity, floorOffset });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const openAddForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setIsAdding(true);
    setFormError('');
  };

  const openEditForm = (m: ModelPreset) => {
    setForm({ label: m.label, provider: m.provider, model: m.model, apiKey: m.apiKey, baseUrl: m.baseUrl || '' });
    setEditingId(m.id);
    setIsAdding(true);
    setFormError('');
  };

  const handleFormSave = async () => {
    if (!form.label.trim()) { setFormError('이름(라벨)을 입력하세요.'); return; }
    if (!form.model.trim()) { setFormError('모델명을 입력하세요.'); return; }

    let nextModels: ModelPreset[];
    let nextActiveId = activeModelId;

    if (editingId) {
      nextModels = models.map(m => m.id === editingId
        ? { ...m, label: form.label.trim(), provider: form.provider, model: form.model.trim(), apiKey: form.apiKey, baseUrl: form.baseUrl.trim() }
        : m);
    } else {
      const newModel: ModelPreset = {
        id: generateModelId(),
        label: form.label.trim(),
        provider: form.provider,
        model: form.model.trim(),
        apiKey: form.apiKey,
        baseUrl: form.baseUrl.trim(),
      };
      nextModels = [...models, newModel];
      if (models.length === 0) nextActiveId = newModel.id;
    }

    setModels(nextModels);
    setActiveModelId(nextActiveId);
    setIsAdding(false);
    setEditingId(null);
    await persist(nextModels, nextActiveId);
  };

  const handleDeleteModel = async (id: string) => {
    const nextModels = models.filter(m => m.id !== id);
    let nextActiveId = activeModelId;
    if (activeModelId === id) nextActiveId = nextModels[0]?.id || '';
    setModels(nextModels);
    setActiveModelId(nextActiveId);
    await persist(nextModels, nextActiveId);
  };

  const handleSetActive = async (id: string) => {
    setActiveModelId(id);
    await persist(models, id);
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

        {/* AI Models */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">AI 모델</label>
          <p className="text-xs text-gray-400">사용할 모델을 등록하고, 그중 하나를 현재 모델로 선택하세요.</p>

          <div className="space-y-2">
            {models.map(m => (
              <div
                key={m.id}
                className={`p-3 rounded-xl border flex items-center gap-2 ${
                  activeModelId === m.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  onClick={() => handleSetActive(m.id)}
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    activeModelId === m.id ? 'border-blue-500' : 'border-gray-300'
                  }`}
                  title="이 모델을 현재 모델로 사용"
                >
                  {activeModelId === m.id && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-gray-800 text-sm truncate">{m.label}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                      {m.provider === 'gemini' ? 'Gemini' : 'OpenAI 호환'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{m.model}{m.baseUrl ? ` · ${m.baseUrl}` : ''}</p>
                  {!m.apiKey && <p className="text-xs text-amber-500">⚠ API Key 없음</p>}
                </div>
                <button onClick={() => openEditForm(m)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 flex-shrink-0">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => handleDeleteModel(m.id)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-500 text-gray-400 flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {models.length === 0 && !isAdding && (
              <p className="text-xs text-gray-400 text-center py-3">등록된 모델이 없습니다. 아래에서 추가해주세요.</p>
            )}
          </div>

          {isAdding ? (
            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 space-y-2">
              <input
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="이름 (예: 회사 DeepSeek)"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setForm({ ...form, provider: 'gemini' })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border ${form.provider === 'gemini' ? 'border-blue-400 bg-blue-100 text-blue-700 font-semibold' : 'border-gray-300 text-gray-500'}`}
                >
                  Gemini
                </button>
                <button
                  onClick={() => setForm({ ...form, provider: 'openai' })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border ${form.provider === 'openai' ? 'border-blue-400 bg-blue-100 text-blue-700 font-semibold' : 'border-gray-300 text-gray-500'}`}
                >
                  OpenAI 호환 (DeepSeek/Qwen/HCX 등)
                </button>
              </div>
              <input
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder={form.provider === 'gemini' ? '모델명 (예: gemini-3.6-flash)' : '모델명 (예: deepseek-chat, qwen-max)'}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="password"
                value={form.apiKey}
                onChange={e => setForm({ ...form, apiKey: e.target.value })}
                placeholder="API Key"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {form.provider === 'openai' && (
                <input
                  value={form.baseUrl}
                  onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="Base URL (예: https://api.deepseek.com)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              )}
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setIsAdding(false); setEditingId(null); setFormError(''); }}
                  className="flex-1 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button onClick={handleFormSave} className="flex-1 py-1.5 text-xs rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center justify-center gap-1">
                  <Check size={12} /> {editingId ? '수정 저장' : '추가'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={openAddForm}
              className="w-full py-2 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all text-sm font-medium"
            >
              <Plus size={15} /> 모델 추가
            </button>
          )}
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

        {/* Floor Offset */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            바닥 높이: <span className="text-blue-500">작업표시줄 위 {floorOffset}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={150}
            value={floorOffset}
            onChange={e => setFloorOffset(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>바로 붙임 (0px)</span>
            <span>높이 띄움 (150px)</span>
          </div>
        </div>

        {/* App Info */}
        <div className="space-y-1 pt-2">
          <p className="text-sm font-semibold text-gray-400">프로그램 정보</p>
          <div className="text-xs text-gray-300 space-y-0.5">
            <p>버전: {appVersion || '...'}</p>
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
            saved ? 'bg-green-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {saved ? '✓ 저장됨!' : '설정 저장'}
        </button>
      </div>
    </div>
  );
};

export default React.memo(SettingsPanel);
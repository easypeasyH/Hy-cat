const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Mouse control
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),

  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Topics
  getTopics: () => ipcRenderer.invoke('get-topics'),
  createTopic: (data) => ipcRenderer.invoke('create-topic', data),
  renameTopic: (data) => ipcRenderer.invoke('rename-topic', data),
  deleteTopic: (id) => ipcRenderer.invoke('delete-topic', id),
  reorderTopics: (orderedIds) => ipcRenderer.invoke('reorder-topics', orderedIds),

  // Messages
  getMessages: (topicId) => ipcRenderer.invoke('get-messages', topicId),
  saveMessage: (data) => ipcRenderer.invoke('save-message', data),

  // AI (Gemini / OpenAI-compatible)
  sendMessage: (data) => ipcRenderer.invoke('send-message', data),
});

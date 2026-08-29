const { app, BrowserWindow, ipcMain, screen, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray = null;
let isQuitting = false;

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'chat.db');
const configPath = path.join(userDataPath, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {}
  return { apiKey: '', modelName: 'gemini-3.6-flash', petSize: 96, petOpacity: 1.0 };
}

function saveConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

let db;
function initDb() {
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attachments TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE
      );
    `);
    // Older DBs created before sort_order existed: add it if missing.
    try {
      db.exec('ALTER TABLE topics ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
    } catch (e) {
      // column already exists — ignore
    }
    console.log('Database initialized at', dbPath);
  } catch (e) {
    console.error('DB init error:', e);
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    focusable: true,
    title: 'Cat',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'tray-icon.png')
    : path.join(__dirname, '../../assets/tray-icon.png');

  try {
    tray = new Tray(iconPath);
  } catch (e) {
    console.error('Tray icon load failed:', e);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '고양이 보이기/숨기기',
      click: () => {
        if (mainWindow.isVisible()) mainWindow.hide();
        else mainWindow.show();
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Cat');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
  });
}

ipcMain.on('set-ignore-mouse', (_, ignore) => {
  if (mainWindow) mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('save-config', (_, cfg) => {
  saveConfig(cfg);
  return true;
});

ipcMain.handle('get-topics', () => {
  if (!db) return [];
  return db.prepare('SELECT * FROM topics ORDER BY sort_order ASC, updated_at DESC').all();
});

ipcMain.handle('create-topic', (_, { id, name }) => {
  if (!db) return null;
  const now = new Date().toISOString();
  const row = db.prepare('SELECT MIN(sort_order) as m FROM topics').get();
  const sortOrder = (row?.m ?? 0) - 1; // new topics go to the top
  db.prepare('INSERT INTO topics (id, name, created_at, updated_at, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, now, now, sortOrder);
  return { id, name, created_at: now, updated_at: now, sort_order: sortOrder };
});

ipcMain.handle('rename-topic', (_, { id, name }) => {
  if (!db) return null;
  const now = new Date().toISOString();
  db.prepare('UPDATE topics SET name=?, updated_at=? WHERE id=?').run(name, now, id);
  return true;
});

ipcMain.handle('delete-topic', (_, id) => {
  if (!db) return null;
  db.prepare('DELETE FROM messages WHERE topic_id=?').run(id);
  db.prepare('DELETE FROM topics WHERE id=?').run(id);
  return true;
});

// New: persist manual drag-reorder. `orderedIds` = topic ids in their new top-to-bottom order.
ipcMain.handle('reorder-topics', (_, orderedIds) => {
  if (!db) return null;
  const stmt = db.prepare('UPDATE topics SET sort_order=? WHERE id=?');
  const tx = db.transaction((ids) => {
    ids.forEach((id, index) => stmt.run(index, id));
  });
  tx(orderedIds);
  return true;
});

ipcMain.handle('get-messages', (_, topicId) => {
  if (!db) return [];
  return db.prepare('SELECT * FROM messages WHERE topic_id=? ORDER BY created_at ASC').all(topicId);
});

ipcMain.handle('save-message', (_, { id, topicId, role, content, attachments }) => {
  if (!db) return null;
  const now = new Date().toISOString();
  const att = JSON.stringify(attachments || []);
  db.prepare('INSERT INTO messages (id, topic_id, role, content, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, topicId, role, content, att, now);
  db.prepare('UPDATE topics SET updated_at=? WHERE id=?').run(now, topicId);
  return { id, topic_id: topicId, role, content, attachments: att, created_at: now };
});

ipcMain.handle('send-to-gemini', async (_, { messages, newMessage, attachments, apiKey, modelName }) => {
  try {
    const { GoogleGenAI } = require('@google/genai');
    if (!apiKey) return { error: 'API Key가 설정되지 않았습니다. 설정에서 API Key를 입력해주세요.' };

    const ai = new GoogleGenAI({ apiKey });

    const history = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const parts = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === 'image') {
          parts.push({ inlineData: { mimeType: att.mimeType || 'image/png', data: att.data } });
        } else if (att.type === 'file') {
          parts.push({ text: `[첨부 파일: ${att.name}]\n${att.textContent || ''}` });
        }
      }
    }
    parts.push({ text: newMessage });

    const chat = ai.chats.create({
      model: modelName || 'gemini-3.6-flash',
      history,
    });

    const response = await chat.sendMessage({ message: parts });

    // Extract any image parts the model returned (only image-capable models like
    // gemini-3.1-flash-image-preview actually produce these).
    const candidateParts = response.candidates?.[0]?.content?.parts || [];
    const images = candidateParts
      .filter(p => p.inlineData)
      .map(p => ({ mimeType: p.inlineData.mimeType, data: p.inlineData.data }));

    return { text: response.text, images: images.length > 0 ? images : undefined };
  } catch (e) {
    console.error('Gemini error:', e);
    if (e.message && e.message.includes('API_KEY_INVALID')) {
      return { error: 'API Key가 올바르지 않습니다. 설정에서 확인해주세요.' };
    }
    if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED') {
      return { error: '인터넷 연결을 확인해주세요.' };
    }
    return { error: `AI 응답을 가져오지 못했습니다: ${e.message || '알 수 없는 오류'}` };
  }
});

app.whenReady().then(() => {
  initDb();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', (e) => {
  if (!isQuitting) e?.preventDefault?.();
});

app.on('before-quit', () => {
  isQuitting = true;
});
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.module.css';

interface Settings {
  apiKey: string;
  apiUrl: string;
  model: string;
  confidenceThreshold: number;
  autoAnalyze: boolean;
  suggestionsCooldown: number;
}

interface ApiKeyStatus {
  valid: boolean;
  error?: string;
  checking?: boolean;
}

function App() {
  const [settings, setSettings] = useState<Settings>({
    apiKey: '',
    apiUrl: 'https://llm.api.cloud.ru/v1',
    model: 'zai-org/GLM-4.7',
    confidenceThreshold: 0.6,
    autoAnalyze: true,
    suggestionsCooldown: 5000,
  });

  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({ valid: false });
  const [saved, setSaved] = useState(false);

  // Загружаем настройки при запуске
  useEffect(() => {
    loadSettings();
  }, []);

  // Сохранить настройки
  useEffect(() => {
    if (saved) {
      setTimeout(() => setSaved(false), 2000);
    }
  }, [saved]);

  const loadSettings = async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    setSettings(response);
    if (response.apiKey) {
      checkApiKey(response.apiKey);
    }
  };

  const checkApiKey = async (key: string) => {
    if (!key.trim()) {
      setApiKeyStatus({ valid: false, error: 'API key is required' });
      return;
    }

    setApiKeyStatus({ valid: false, checking: true });

    const result = await chrome.runtime.sendMessage({
      type: 'CHECK_API_KEY',
      data: { apiKey: key }
    });

    setApiKeyStatus({ valid: result.valid, checking: false });
  };

  const handleSave = async () => {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      data: settings
    });
    setSaved(true);
    await checkApiKey(settings.apiKey);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value,
    }));
  };

  return (
    <div className="container">
      <header>
        <h1>🎭 Теневой AI-редактор</h1>
        <p className="subtitle">Невидимый помощник для ваших текстов</p>
      </header>

      <main>
        <section className="section">
          <h2>🔑 Настройки API</h2>

          <div className="formGroup">
            <label htmlFor="apiKey">API Key Cloud.ru</label>
            <input
              type="password"
              id="apiKey"
              name="apiKey"
              value={settings.apiKey}
              onChange={handleChange}
              placeholder="Введите API ключ..."
              className={apiKeyStatus.valid ? 'valid' : apiKeyStatus.error ? 'invalid' : ''}
            />

            {apiKeyStatus.checking && <span className="status checking">Проверка...</span>}
            {apiKeyStatus.valid && <span className="status valid">✓ Ключ действителен</span>}
            {apiKeyStatus.error && <span className="status invalid">{apiKeyStatus.error}</span>}

            <button
              type="button"
              onClick={() => checkApiKey(settings.apiKey)}
              disabled={apiKeyStatus.checking}
            >
              Проверить ключ
            </button>
          </div>

          <div className="formGroup">
            <label htmlFor="apiUrl">API URL</label>
            <input
              type="text"
              id="apiUrl"
              name="apiUrl"
              value={settings.apiUrl}
              onChange={handleChange}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="model">Модель</label>
            <select id="model" name="model" value={settings.model} onChange={handleChange}>
              <option value="zai-org/GLM-4.7">GLM-4.7</option>
              <option value="zai-org/GLM-4.7-Flash">GLM-4.7 Flash</option>
            </select>
          </div>
        </section>

        <section className="section">
          <h2>⚙️ Настройки анализа</h2>

          <div className="formGroup">
            <label htmlFor="confidenceThreshold">
              Минимальная уверенность: {Math.round(settings.confidenceThreshold * 100)}%
            </label>
            <input
              type="range"
              id="confidenceThreshold"
              name="confidenceThreshold"
              min="0"
              max="1"
              step="0.1"
              value={settings.confidenceThreshold}
              onChange={handleChange}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="suggestionsCooldown">
              Задержка между предложениями:
            </label>
            <input
              type="number"
              id="suggestionsCooldown"
              name="suggestionsCooldown"
              min="1000"
              max="30000"
              step="1000"
              value={settings.suggestionsCooldown}
              onChange={handleChange}
            />
            {settings.suggestionsCooldown >= 1000 && (
              <span className="small">{Math.round(settings.suggestionsCooldown / 1000)} сек</span>
            )}
          </div>

          <div className="formGroup checkbox">
            <input
              type="checkbox"
              id="autoAnalyze"
              name="autoAnalyze"
              checked={settings.autoAnalyze}
              onChange={handleChange}
            />
            <label htmlFor="autoAnalyze">Автоматический анализ текста</label>
          </div>
        </section>

        <div className="actions">
          <button
            type="button"
            onClick={handleSave}
            className="primary"
            disabled={apiKeyStatus.checking}
          >
            {saved ? '✓ Сохранено' : 'Сохранить'}
          </button>
        </div>
      </main>

      <footer>
        <p>
          Вариант А: Инлайн редактирование
        </p>
        <p className="version">v0.1.0</p>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
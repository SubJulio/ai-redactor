/**
 * Background Service Worker
 *
 * Обрабатывает:
 * - Анализ текста через Cloud.ru LLM API
 * - Хранение настроек
 * - Управление состоянием
 */

// API ключи и настройки (в MVP - в storage)
const DEFAULT_SETTINGS = {
  apiKey: '',
  apiUrl: 'https://llm.api.cloud.ru/v1',
  model: 'zai-org/GLM-4.7',
  confidenceThreshold: 0.6,
  autoAnalyze: true,
  suggestionsCooldown: 5000, // ms между предложениями
};

// Кэш для анализа (чтобы не дергать API на каждое изменение)
const analysisCache = new Map<string, { result: any, timestamp: number }>();
const CACHE_TTL = 30000; // 30 секунд кэша

// Интерфейсы для API
interface TextAnalysisRequest {
  text: string;
  context?: string;
  tone?: 'formal' | 'friendly' | 'persuasive' | 'neutral';
}

interface TextAnalysisResponse {
  original: string;
  improved?: string;
  suggestions: string[]; // Обязательное поле
  confidence: number;
  issues_found?: string[];
}

/**
 * Инициализация extension
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Shadow Editor] Extension installed');
    // Устанавливаем дефолтные настройки
    chrome.storage.local.set(DEFAULT_SETTINGS);
  } else if (details.reason === 'update') {
    console.log('[Shadow Editor] Extension updated');
  }
});

/**
 * Message Handler
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Shadow Editor] Received message:', message.type);

  switch (message.type) {
    case 'ANALYZE_TEXT':
      handleAnalyzeText(message.data)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true; // Асинхронный ответ

    case 'GET_SETTINGS':
      getSettings().then(sendResponse);
      return true;

    case 'UPDATE_SETTINGS':
      updateSettings(message.data).then(sendResponse);
      return true;

    case 'CHECK_API_KEY':
      checkApiKey(message.data?.apiKey).then(sendResponse);
      return true;

    default:
      console.warn('[Shadow Editor] Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
});

/**
 * Обработчик анализа текста
 */
async function handleAnalyzeText(data: TextAnalysisRequest): Promise<TextAnalysisResponse> {
  const { text, context, tone } = data;

  // Проверка кэша
  const cacheKey = `${text.substring(0, 100)}_${tone}`;
  const cached = analysisCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[Shadow Editor] Using cached result');
    return cached.result;
  }

  // Проверяем длину текста
  if (text.length < 20) {
    return {
      original: text,
      suggestions: [],
      confidence: 0,
    };
  }

  // Получаем настройки
  const settings = await getSettings();

  if (!settings.apiKey) {
    return {
      original: text,
      suggestions: ['Требуется настройка API ключа'],
      confidence: 0,
    };
  }

  try {
    // Делаем запрос к LLM
    const analysis = await analyzeTextWithLLM(text, settings, tone, context);

    // Сохраняем в кэш
    analysisCache.set(cacheKey, {
      result: analysis,
      timestamp: Date.now(),
    });

    // Очистка старого кэша
    if (analysisCache.size > 100) {
      const oldestKey = [...analysisCache.keys()].sort((a, b) => {
        return analysisCache.get(a)!.timestamp - analysisCache.get(b)!.timestamp;
      })[0];
      analysisCache.delete(oldestKey);
    }

    return analysis;
  } catch (error) {
    console.error('[Shadow Editor] Error analyzing text:', error);
    return {
      original: text,
      suggestions: ['Ошибка при анализе текста. Попробуйте позже.'],
      confidence: 0,
    };
  }
}

/**
 * Запрос к Cloud.ru LLM API
 */
async function analyzeTextWithLLM(
  text: string,
  settings: typeof DEFAULT_SETTINGS,
  tone?: string,
  context?: string
): Promise<TextAnalysisResponse> {
  const prompt = buildPrompt(text, tone, context);

  try {
    const response = await fetch(`${settings.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: 'Ты — профессиональный редактор текстов. Твоя задача — улучшить текст, сохранить смысл, сделать его более понятным и убедительным. Отвечай строго в JSON формате.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    // Парсим JSON ответ
    const analysis = parseLLMResponse(content);

    return {
      original: text,
      suggestions: (analysis.suggestions ?? []) as string[],
      confidence: analysis.confidence ?? 0,
      improved: analysis.improved,
      issues_found: analysis.issues_found,
    } as TextAnalysisResponse;
  } catch (error) {
    console.error('[Shadow Editor] LLM API error:', error);
    throw error;
  }
}

/**
 * Построение промпта для LLM
 */
function buildPrompt(text: string, tone?: string, context?: string): string {
  let prompt = `Проанализируй и улучи следующий текст. Верни результат в JSON формате с полями:
{
  "improved": "улучшенная версия текста",
  "suggestions": ["конкретная рекомендация 1", "конкретная рекомендация 2"],
  "confidence": 0.85,
  "issues_found": ["повторяющиеся слова", "длинные предложения"]
}

Исходный текст:
"""
${text}
"""`;

  if (tone) {
    const toneDescriptions: Record<string, string> = {
      formal: 'Формальный деловой стиль',
      friendly: 'Дружелюбный и доступный стиль',
      persuasive: 'Убедительный стиль для продаж и переговоров',
      neutral: 'Нейтральный информативный стиль',
    };
    prompt += `\n\nЖелаемый тон: ${toneDescriptions[tone] || tone}`;
  }

  if (context) {
    prompt += `\n\nКонтекст: ${context}`;
  }

  return prompt;
}

/**
 * Парсинг ответа LLM
 */
function parseLLMResponse(content: string): Partial<TextAnalysisResponse> {
  try {
    // Пытаемся найти JSON в ответе
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Валидируем структуру
    if (!parsed.improved && !parsed.suggestions) {
      throw new Error('Invalid response structure');
    }

    return {
      improved: parsed.improved,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      issues_found: Array.isArray(parsed.issues_found) ? parsed.issues_found : undefined,
    };
  } catch (error) {
    console.error('[Shadow Editor] Error parsing LLM response:', error, content);

    // Если не смогли распарсить, возвращаем дефолт
    return {
      suggestions: ['Анализ временно недоступен'],
      confidence: 0,
    };
  }
}

/**
 * Получить настройки из storage
 */
async function getSettings(): Promise<typeof DEFAULT_SETTINGS> {
  const settings = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...settings };
}

/**
 * Обновить настройки
 */
async function updateSettings(newSettings: Partial<typeof DEFAULT_SETTINGS>): Promise<void> {
  await chrome.storage.local.set(newSettings);
}

/**
 * Проверить валидность API ключа
 */
async function checkApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is empty' };
  }

  try {
    const testResponse = await fetch(`${DEFAULT_SETTINGS.apiUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    return { valid: testResponse.ok };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Очистка кэша каждый час
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      analysisCache.delete(key);
    }
  }
}, 3600000);
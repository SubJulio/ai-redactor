/**
 * Content Script для инлайн AI-редактирования
 *
 * Работает на всех страницах, мониторит изменения в текстовых полях
 * и показывает подсказки по улучшению текста.
 */

// Интерфейс для анализируемого текста
interface TextAnalysis {
  original: string;
  improved?: string;
  suggestions: string[];
  confidence: number;
}

// Состояние
let textElements: Map<Element, TextFieldObserver> = new Map();
let isOverlaysVisible = false;

// Инициализация после загрузки DOM
function init(): void {
  console.log('[Shadow Editor] Content script initialized');

  // Мониторим текстовые поля и contenteditable элементы
  observeTextFields();

  // Отслеживаем динамическое добавление элементов
  observeDynamicContent();

  // Подключаемся к message handler'у расширения
  chrome.runtime.onMessage.addListener(handleMessages);

  // Создаем overlay UI для подсказок
  createOverlayLayer();
}

// Наблюдатель за текстовыми полями
class TextFieldObserver {
  private element: HTMLElement;
  private originalPlaceholder?: string; // Используется в будущих версиях
  private observer: MutationObserver;

  constructor(element: HTMLElement) {
    this.element = element;
    this.originalPlaceholder = element.getAttribute('placeholder') || undefined;
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' || mutation.type === 'childList') {
          this.handleTextChange();
        }
      }
    });

    this.observe();
  }

  private observe(): void {
    this.observer.observe(this.element, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  private handleTextChange(): void {
    const text = this.getText();
    if (text.length < 10) return; // Игнорируем слишком короткий текст

    // Анализируем текст (отправляем в background для обработки)
    analyzeText(text).then(analysis => {
      if (analysis.improved && analysis.confidence > 0.6) {
        showSuggestion(this.element, analysis);
      }
    });
  }

  private getText(): string {
    return this.element.innerText || this.element.textContent || '';
  }

  destroy(): void {
    this.observer.disconnect();
  }
}

// Наблюдатель за динамическим контентом
function observeDynamicContent(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          findAndObserveTextFields(node);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Найти все текстовые поля на странице
function findAndObserveTextFields(root?: HTMLElement): void {
  const selectors = [
    'textarea',
    'input[type="text"]',
    'input[type="email"]',
    '[contenteditable="true"]',
    '[role="textbox"]',
  ];

  const parent = root || document;
  const elements = parent.querySelectorAll(selectors.join(', '));

  elements.forEach(el => {
    if (el instanceof HTMLElement && !textElements.has(el)) {
      // Игнорируем элементы нашего же расширения
      if (el.closest('[data-shadow-editor]')) return;

      const observer = new TextFieldObserver(el);
      textElements.set(el, observer);
    }
  });
}

// Начать наблюдение за текстовыми полями
function observeTextFields(): void {
  // Ждем небольшую задержку, чтобы DOM успел прогрузиться
  setTimeout(() => {
    findAndObserveTextFields();
  }, 500);
}

// Анализ текста через background worker
async function analyzeText(text: string): Promise<TextAnalysis> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_TEXT',
      data: { text }
    });

    return response;
  } catch (error) {
    console.error('[Shadow Editor] Error analyzing text:', error);
    return {
      original: text,
      suggestions: [],
      confidence: 0
    };
  }
}

// Показать подсказку
function showSuggestion(element: HTMLElement, analysis: TextAnalysis): void {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-shadow-editor', 'suggestion');
  overlay.className = 'shadow-editor-suggestion';

  // Находим позицию элемента
  const rect = element.getBoundingClientRect();
  overlay.style.position = 'fixed';
  overlay.style.left = `${rect.right + 10}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.zIndex = '999999';

  overlay.innerHTML = `
    <div class="shadow-editor-tooltip">
      <div class="shadow-editor-arrow"></div>
      <div class="shadow-editor-content">
        <div class="shadow-editor-header">
          <span class="shadow-editor-title">💡 Предложение</span>
          <button class="shadow-editor-close" data-action="close">×</button>
        </div>
        <div class="shadow-editor-suggestion-text">${escapeHtml(analysis.improved || '')}</div>
        <div class="shadow-editor-actions">
          <button class="shadow-editor-btn shadow-editor-btn-apply" data-action="apply">Применить</button>
          <button class="shadow-editor-btn shadow-editor-btn-dismiss" data-action="dismiss">Отклонить</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Обработчики кнопок
  overlay.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
    applySuggestion(element, analysis.improved || '');
    overlay.remove();
  });

  overlay.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
    overlay.remove();
  });

  overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => {
    overlay.remove();
  });

  // Автоматически скрыть через 30 секунд
  setTimeout(() => {
    if (overlay.isConnected) {
      overlay.remove();
    }
  }, 30000);
}

// Применить предложение
function applySuggestion(element: HTMLElement, improvedText: string): void {
  if (element.isContentEditable) {
    // Для contenteditable элементов
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode(improvedText);
      range.deleteContents();
      range.insertNode(textNode);
    }
  } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    // Для input и textarea
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || input.value.length;

    input.value = input.value.substring(0, start) + improvedText + input.value.substring(end);
    input.focus();
    input.setSelectionRange(start + improvedText.length, start + improvedText.length);
  }
}

// Создать overlay layer для стилей
function createOverlayLayer(): void {
  const style = document.createElement('style');
  style.textContent = `
    [data-shadow-editor] {
      all: initial !important;
    }

    .shadow-editor-suggestion {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 400px;
    }

    .shadow-editor-tooltip {
      position: relative;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      overflow: hidden;
    }

    .shadow-editor-arrow {
      position: absolute;
      left: -6px;
      top: 10px;
      width: 0;
      height: 0;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-right: 6px solid #e0e0e0;
    }

    .shadow-editor-arrow::before {
      content: '';
      position: absolute;
      left: 1px;
      top: -5px;
      width: 0;
      height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-right: 5px solid white;
    }

    .shadow-editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #f0f0f0;
    }

    .shadow-editor-title {
      font-weight: 600;
      color: #333;
    }

    .shadow-editor-close {
      background: none;
      border: none;
      font-size: 18px;
      color: #999;
      cursor: pointer;
      padding: 0 4px;
    }

    .shadow-editor-close:hover {
      color: #333;
    }

    .shadow-editor-content {
      padding: 16px;
    }

    .shadow-editor-suggestion-text {
      color: #555;
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .shadow-editor-actions {
      display: flex;
      gap: 8px;
    }

    .shadow-editor-btn {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .shadow-editor-btn-apply {
      background: #4f46e5;
      color: white;
    }

    .shadow-editor-btn-apply:hover {
      background: #4338ca;
    }

    .shadow-editor-btn-dismiss {
      background: #f3f4f6;
      color: #6b7280;
    }

    .shadow-editor-btn-dismiss:hover {
      background: #e5e7eb;
    }
  `;

  document.head.appendChild(style);
}

// Обработчик сообщений от extension
function handleMessages(
  message: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean | void {
  if (message.type === 'TOGGLE_OVERLAYS') {
    isOverlaysVisible = !isOverlaysVisible;
    // TODO: Показать/скрыть все overlays
    sendResponse({ visible: isOverlaysVisible });
  }
}

// Utility: Escape HTML для безопасности
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Запуск
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
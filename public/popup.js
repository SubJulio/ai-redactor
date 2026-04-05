// Теневой AI-редактор - Popup скрипт

document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const apiUrlInput = document.getElementById('apiUrl');
  const modelSelect = document.getElementById('model');
  const saveButton = document.getElementById('save');
  const saveStatus = document.getElementById('saveStatus');

  // Загрузка сохранённых настроек
  chrome.storage.local.get(['apiKey', 'apiUrl', 'model'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    if (result.apiUrl) {
      apiUrlInput.value = result.apiUrl;
    }
    if (result.model) {
      modelSelect.value = result.model;
    }
  });

  // Сохранение настроек
  saveButton.addEventListener('click', function() {
    const settings = {
      apiKey: apiKeyInput.value.trim(),
      apiUrl: apiUrlInput.value.trim(),
      model: modelSelect.value,
    };

    if (!settings.apiKey) {
      saveStatus.textContent = '❌ Введите API ключ';
      saveStatus.style.color = 'red';
      return;
    }

    chrome.storage.local.set(settings, function() {
      saveStatus.textContent = '✅ Сохранено!';
      saveStatus.style.color = 'green';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 2000);
    });
  });
});
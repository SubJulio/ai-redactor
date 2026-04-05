// Simple popup without React
document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const apiUrlInput = document.getElementById('apiUrl') as HTMLInputElement;
  const modelSelect = document.getElementById('model') as HTMLSelectElement;
  const saveButton = document.getElementById('save');
  const saveStatus = document.getElementById('saveStatus') as HTMLSpanElement;
  
  // Load settings
  chrome.storage.local.get(['apiKey', 'apiUrl', 'model'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    if (result.apiUrl) apiUrlInput.value = result.apiUrl;
    if (result.model) modelSelect.value = result.model;
  });

  // Save settings
  saveButton.addEventListener('click', async () => {
    const settings = {
      apiKey: apiKeyInput.value,
      apiUrl: apiUrlInput.value,
      model: modelSelect.value,
    };

    chrome.storage.local.set(settings, () => {
      saveStatus.textContent = '✓ Сохранено!';
      saveStatus.style.color = 'green';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 2000);
    });
  });
});
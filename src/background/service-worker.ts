import { ExtensionMessage } from '../types';
import { routeExtensionMessage } from './message-router';

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_ACTIVE_POST') return false;
  routeExtensionMessage(message)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ ok: false, error: { code: 'UNKNOWN_ERROR', message: String(error), nextStep: 'Reopen popup.' } }));
  return true;
});
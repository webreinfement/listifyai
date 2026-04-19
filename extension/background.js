// Service worker — handles install event and future background tasks
chrome.runtime.onInstalled.addListener(() => {
  console.log('RankifyAI installed.');
});

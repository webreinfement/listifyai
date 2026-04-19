// Etsy selectors
const ETSY = {
  title: 'input[name="title"], #listing-edit-form-title',
  description: 'textarea[name="description"], #listing-edit-form-description',
  category: '[data-region="category"] .wt-text-body-01',
  price: 'input[name="price"]',
  tags: 'input[data-appears-as="tag-input"], input[placeholder*="tag"], input[placeholder*="Tag"]'
};

// eBay selectors
const EBAY = {
  title: '#gh-ac, input[name="item_title"], #s0-1, input[id*="title"]',
  description: '#ItemDescription, textarea[name="item_description"]',
  price: 'input[name="start_price"], input[id*="price"]'
};

function getListingContext() {
  const isEbay = location.hostname.includes('ebay.com');
  const sel = isEbay ? EBAY : ETSY;
  const parts = [];

  const titleEl = document.querySelector(sel.title);
  if (titleEl?.value) parts.push(`Current title: ${titleEl.value}`);

  const categoryEl = !isEbay && document.querySelector(ETSY.category);
  if (categoryEl) parts.push(`Category: ${categoryEl.textContent.trim()}`);

  const priceEl = document.querySelector(sel.price);
  if (priceEl?.value) parts.push(`Price: $${priceEl.value}`);

  const descEl = document.querySelector(sel.description);
  if (descEl?.value) parts.push(`Current description (excerpt): ${descEl.value.slice(0, 200)}`);

  parts.push(`Platform: ${isEbay ? 'eBay' : 'Etsy'}`);
  return parts.join('\n');
}

function fillListing(data) {
  const isEbay = location.hostname.includes('ebay.com');
  const sel = isEbay ? EBAY : ETSY;

  function setNativeValue(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) nativeInputValueSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (data.title) {
    const el = document.querySelector(sel.title);
    if (el) setNativeValue(el, data.title);
  }

  if (data.description) {
    const el = document.querySelector(sel.description);
    if (el) setNativeValue(el, data.description);
  }

  // Fill Etsy tags one by one
  if (data.tags && !isEbay) {
    const tagInputs = document.querySelectorAll(ETSY.tags);
    if (tagInputs.length) {
      data.tags.slice(0, 13).forEach((tag, i) => {
        if (tagInputs[i]) {
          setNativeValue(tagInputs[i], tag);
          tagInputs[i].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
      });
    }
  }

  return true;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_CONTEXT') {
    sendResponse({ context: getListingContext() });
  }
  if (msg.type === 'FILL_LISTING') {
    const result = fillListing(msg.data);
    sendResponse({ success: result });
  }
});

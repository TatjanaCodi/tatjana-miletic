/**
 * Vision in the wild — hotspot popups, variant selection, add to cart
 */
(function () {
  const DEFAULT_COLOR_MAP = {
    black: '#000000',
    white: '#ffffff',
    blue: '#1e4b9b',
    red: '#c41e3a',
    grey: '#9e9e9e',
    gray: '#9e9e9e',
  };

  /**
   * @param {number} cents
   * @returns {string}
   */
  function formatMoney(cents) {
    if (typeof window.Shopify?.formatMoney === 'function') {
      return window.Shopify.formatMoney(cents);
    }
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      style: 'currency',
      currency: window.Shopify?.currency?.active || 'USD',
    }).format(cents / 100);
  }

  /**
   * @param {object} variant
   * @returns {string[]}
   */
  function getVariantOptions(variant) {
    if (!variant) return [];

    if (Array.isArray(variant.options) && variant.options.length > 0) {
      return variant.options.filter((option) => option != null && option !== '');
    }

    return [variant.option1, variant.option2, variant.option3].filter(
      (option) => option != null && option !== ''
    );
  }

  /**
   * @param {object} product
   * @returns {string[]}
   */
  function getEmptySelectedOptions(product) {
    const optionCount = Array.isArray(product?.options) ? product.options.length : 0;
    if (optionCount > 0) return Array(optionCount).fill('');

    const variants = product?.variants;
    if (!Array.isArray(variants) || variants.length === 0) return [];

    return getVariantOptions(variants[0]).map(() => '');
  }

  /**
   * @param {string[]} selectedOptions
   * @returns {boolean}
   */
  function isSelectionComplete(selectedOptions) {
    return selectedOptions.length > 0 && selectedOptions.every((value) => value != null && value !== '');
  }

  /**
   * @param {object} product
   * @param {string[]} selectedOptions
   * @returns {object | undefined}
   */
  function findVariant(product, selectedOptions) {
    const variants = product?.variants;
    if (!Array.isArray(variants)) return undefined;

    const matches = variants.filter((variant) => {
      const options = getVariantOptions(variant);
      return options.every((option, index) => {
        const selected = selectedOptions[index];
        if (selected == null || selected === '') return true;
        return option === selected;
      });
    });

    if (!isSelectionComplete(selectedOptions)) {
      return matches.find((variant) => variant.available) || matches[0];
    }

    return matches.find((variant) => {
      const options = getVariantOptions(variant);
      return options.every((option, index) => option === selectedOptions[index]);
    });
  }

  /**
   * @param {string} value
   * @param {string} [swatchColor]
   * @returns {string}
   */
  function resolveSwatchColor(value, swatchColor) {
    if (swatchColor) return swatchColor;
    const key = value.trim().toLowerCase();
    return DEFAULT_COLOR_MAP[key] || '#cccccc';
  }

  const SIZE_VALUE_GROUPS = [
    ['x-small', 'xs', 'xsmall'],
    ['small', 's'],
    ['medium', 'm', 'med'],
    ['large', 'l'],
    ['x-large', 'xl', 'xlarge'],
  ];

  /**
   * @param {string} value
   * @returns {string}
   */
  function normalizeOptionValue(value) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  /**
   * @param {string} selectedValue
   * @param {string} triggerValue
   * @returns {boolean}
   */
  function optionValuesMatch(selectedValue, triggerValue) {
    const selected = normalizeOptionValue(selectedValue);
    const trigger = normalizeOptionValue(triggerValue);
    if (!selected || !trigger) return false;
    if (selected === trigger) return true;

    for (const group of SIZE_VALUE_GROUPS) {
      if (group.includes(selected) && group.includes(trigger)) return true;
    }

    return false;
  }

  /**
   * @param {HTMLElement} section
   * @param {string[]} optionValues
   * @returns {boolean}
   */
  function shouldAddBundleProduct(section, optionValues) {
    const triggerColor = section.dataset.viwBundleTriggerColor || 'Black';
    const triggerSize = section.dataset.viwBundleTriggerSize || 'Medium';
    const values = (Array.isArray(optionValues) ? optionValues : []).filter(
      (value) => value != null && value !== ''
    );

    const hasColor = values.some((value) => optionValuesMatch(value, triggerColor));
    const hasSize = values.some((value) => optionValuesMatch(value, triggerSize));

    return hasColor && hasSize;
  }

  /**
   * @returns {string}
   */
  function getCartAddUrl() {
    if (typeof Theme !== 'undefined' && Theme.routes?.cart_add_url) {
      return Theme.routes.cart_add_url;
    }
    if (window.Theme?.routes?.cart_add_url) {
      return window.Theme.routes.cart_add_url;
    }
    const root = window.Shopify?.routes?.root || '/';
    return `${root.replace(/\/?$/, '/')}cart/add.js`;
  }

  /**
   * @returns {string}
   */
  function getCartPageUrl() {
    if (typeof Theme !== 'undefined' && Theme.routes?.cart_url) {
      return Theme.routes.cart_url;
    }
    if (window.Theme?.routes?.cart_url) {
      return window.Theme.routes.cart_url;
    }
    const root = window.Shopify?.routes?.root || '/';
    return `${root.replace(/\/?$/, '/')}cart`;
  }

  /**
   * @param {string} cartUrl
   * @param {{ id: number, quantity: number }[]} items
   * @returns {Promise<object>}
   */
  async function addItemsToCart(cartUrl, items) {
    const response = await fetch(cartUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.description || data.message || 'Could not add to cart');
    }

    return data;
  }

  /**
   * @param {HTMLElement} popup
   */
  function openPopup(popup) {
    popup.hidden = false;
    popup.classList.add('is-open');
    document.body.classList.add('viw-popup-open');
    const closeBtn = popup.querySelector('.viw__popup-close');
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
  }

  /**
   * @param {HTMLElement} popup
   * @param {HTMLElement} [returnFocusEl]
   */
  function closePopup(popup, returnFocusEl) {
    popup.hidden = true;
    popup.classList.remove('is-open');
    if (!document.querySelector('.viw__popup.is-open')) {
      document.body.classList.remove('viw-popup-open');
    }
    if (returnFocusEl instanceof HTMLElement) returnFocusEl.focus();
  }

  /**
   * @param {HTMLElement} item
   */
  function initItem(item) {
    if (item.dataset.viwInitialized === 'true') return;

    const section = item.closest('.viw');
    const productJson = item.querySelector('[data-viw-product-json]');
    const popup = item.querySelector('[data-viw-popup]');
    const openTrigger = item.querySelector('[data-viw-open]');

    if (!popup || !openTrigger || !section) return;

    item.dataset.viwInitialized = 'true';

    const closeTriggers = item.querySelectorAll('[data-viw-close]');

    openTrigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPopup(popup);
    });

    closeTriggers.forEach((el) => {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        closePopup(popup, openTrigger);
      });
    });

    popup.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePopup(popup, openTrigger);
    });

    if (!productJson) return;

    const form = item.querySelector('[data-viw-form]');
    const priceEl = item.querySelector('[data-viw-price]');
    const submitBtn = item.querySelector('[data-viw-submit]');
    const submitLabel = item.querySelector('[data-viw-submit-label]');
    const optionButtons = item.querySelectorAll('[data-viw-option]');
    const sizePicker = item.querySelector('[data-viw-size-picker]');
    const sizeTrigger = item.querySelector('[data-viw-size-trigger]');
    const sizeList = item.querySelector('[data-viw-size-list]');
    const sizeDisplay = item.querySelector('[data-viw-size-display]');
    const sizeOptions = item.querySelectorAll('[data-viw-size-option]');

    if (!form) return;

    let product;
    try {
      product = JSON.parse(productJson.textContent);
    } catch {
      return;
    }

    const variants = product?.variants;
    if (!Array.isArray(variants) || variants.length === 0) return;

    const idInput = /** @type {HTMLInputElement} */ (form.querySelector('[name="id"]'));
    const variantsRoot = item.querySelector('.viw__variants');

    if (!variantsRoot) {
      const onlyVariant = variants.find((variant) => variant.available) || variants[0];
      if (idInput && onlyVariant) idInput.value = String(onlyVariant.id);
      if (priceEl && onlyVariant) priceEl.textContent = formatMoney(onlyVariant.price);
      if (submitBtn) submitBtn.disabled = !onlyVariant?.available;
      return;
    }

    const selectedOptions = getEmptySelectedOptions(product);
    const sizeOptionIndex = sizePicker ? Number(sizePicker.dataset.optionIndex) : NaN;

    function closeSizePicker() {
      if (!(sizePicker instanceof HTMLElement) || !(sizeList instanceof HTMLElement)) return;
      sizePicker.classList.remove('is-open');
      sizeList.hidden = true;
      if (sizeTrigger instanceof HTMLElement) {
        sizeTrigger.setAttribute('aria-expanded', 'false');
      }
    }

    function openSizePicker() {
      if (!(sizePicker instanceof HTMLElement) || !(sizeList instanceof HTMLElement)) return;
      sizePicker.classList.add('is-open');
      sizeList.hidden = false;
      if (sizeTrigger instanceof HTMLElement) {
        sizeTrigger.setAttribute('aria-expanded', 'true');
      }
    }

    function updateSizePickerUI() {
      if (!(sizeDisplay instanceof HTMLElement)) return;

      const selectedSize =
        !Number.isNaN(sizeOptionIndex) && selectedOptions[sizeOptionIndex]
          ? selectedOptions[sizeOptionIndex]
          : '';

      if (selectedSize) {
        sizeDisplay.textContent = selectedSize;
        sizeDisplay.classList.remove('is-placeholder');
      } else {
        sizeDisplay.textContent = 'Choose your size';
        sizeDisplay.classList.add('is-placeholder');
      }

      sizeOptions.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const value = button.dataset.value || '';
        const isSelected = selectedSize === value;
        button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        button.classList.toggle('is-selected', isSelected);
      });
    }

    function updateVariantUI(variant) {
      const labelEl = submitLabel || submitBtn;
      const canAddToCart = Boolean(variant && isSelectionComplete(selectedOptions) && variant.available);

      if (priceEl && variant) priceEl.textContent = formatMoney(variant.price);

      if (idInput) {
        idInput.value = canAddToCart ? String(variant.id) : '';
      }

      if (submitBtn) submitBtn.disabled = !canAddToCart;

      if (labelEl) {
        if (!isSelectionComplete(selectedOptions)) {
          labelEl.textContent = submitBtn?.dataset.addLabel || 'ADD TO CART';
        } else if (!variant) {
          labelEl.textContent = submitBtn?.dataset.unavailableLabel || 'Unavailable';
        } else {
          labelEl.textContent = variant.available
            ? submitBtn?.dataset.addLabel || 'ADD TO CART'
            : submitBtn?.dataset.soldOutLabel || 'Sold out';
        }
      }
    }

    /**
     * @param {number} optionIndex
     * @param {string} value
     * @returns {boolean}
     */
    function optionValueExists(optionIndex, value) {
      const trial = [...selectedOptions];
      trial[optionIndex] = value;
      return Boolean(findVariant(product, trial));
    }

    function refreshOptionStates() {
      optionButtons.forEach((button) => {
        const optionIndex = Number(button.dataset.optionIndex);
        const value = button.dataset.value;
        if (Number.isNaN(optionIndex) || !value) return;

        const exists = optionValueExists(optionIndex, value);

        button.disabled = !exists;
        button.classList.toggle('is-selected', selectedOptions[optionIndex] === value);
        button.setAttribute('aria-pressed', selectedOptions[optionIndex] === value ? 'true' : 'false');
        button.setAttribute('aria-disabled', !exists ? 'true' : 'false');
        button.classList.toggle('is-unavailable', !exists);
      });

      sizeOptions.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const optionIndex = Number(button.dataset.optionIndex);
        const value = button.dataset.value;
        if (Number.isNaN(optionIndex) || !value) return;

        const exists = optionValueExists(optionIndex, value);
        button.disabled = !exists;
        button.classList.toggle('is-unavailable', !exists);
      });

      updateSizePickerUI();
    }

    /**
     * @param {number} optionIndex
     * @param {string} value
     */
    function setOptionValue(optionIndex, value) {
      selectedOptions[optionIndex] = value;
      refreshOptionStates();
      updateVariantUI(findVariant(product, selectedOptions));
    }

    item.querySelectorAll('.viw__color-option').forEach((button) => {
      const value = button.dataset.value || '';
      const swatch = button.dataset.swatchColor || '';
      button.style.setProperty('--viw-swatch-color', resolveSwatchColor(value, swatch));
    });

    optionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const optionIndex = Number(button.dataset.optionIndex);
        const value = button.dataset.value;
        if (Number.isNaN(optionIndex) || !value || button.disabled) return;
        setOptionValue(optionIndex, value);
      });
    });

    if (sizeTrigger instanceof HTMLElement) {
      sizeTrigger.addEventListener('click', (event) => {
        event.preventDefault();
        if (sizePicker instanceof HTMLElement && sizePicker.classList.contains('is-open')) {
          closeSizePicker();
        } else {
          openSizePicker();
        }
      });
    }

    sizeOptions.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        if (!(button instanceof HTMLButtonElement) || button.disabled) return;

        const optionIndex = Number(button.dataset.optionIndex);
        const value = button.dataset.value;
        if (Number.isNaN(optionIndex) || !value) return;

        setOptionValue(optionIndex, value);
        closeSizePicker();
      });
    });

    document.addEventListener('click', (event) => {
      if (!(sizePicker instanceof HTMLElement) || !sizePicker.classList.contains('is-open')) return;
      const target = event.target;
      if (target instanceof Node && sizePicker.contains(target)) return;
      closeSizePicker();
    });

    popup.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return;
        if (!(sizePicker instanceof HTMLElement) || !sizePicker.classList.contains('is-open')) return;

        event.stopImmediatePropagation();
        closeSizePicker();
        if (sizeTrigger instanceof HTMLElement) sizeTrigger.focus();
      },
      true
    );

    refreshOptionStates();
    updateVariantUI(findVariant(product, selectedOptions));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!idInput?.value || submitBtn?.disabled) return;

      const cartUrl = getCartAddUrl();
      const addedVariant = variants.find((variant) => String(variant.id) === String(idInput.value));
      const addedOptionValues = getVariantOptions(addedVariant);
      const bundleVariantId = Number(section.dataset.viwBundleVariantId || 0);
      const items = [{ id: Number(idInput.value), quantity: 1 }];

      if (bundleVariantId > 0 && shouldAddBundleProduct(section, addedOptionValues)) {
        items.push({ id: bundleVariantId, quantity: 1 });
      }

      submitBtn.disabled = true;
      const labelEl = submitLabel || submitBtn;
      const previousLabel = labelEl?.textContent || '';

      try {
        const data = await addItemsToCart(cartUrl, items);

        document.dispatchEvent(
          new CustomEvent('cart:update', {
            bubbles: true,
            detail: { resource: data, source: 'vision-in-the-wild' },
          })
        );

        closePopup(popup, openTrigger);
        window.location.assign(getCartPageUrl());
        return;
      } catch (error) {
        if (labelEl) {
          labelEl.textContent = error instanceof Error ? error.message : 'Error';
        }
        setTimeout(() => {
          if (labelEl) labelEl.textContent = previousLabel;
          updateVariantUI(findVariant(product, selectedOptions));
        }, 2500);
      }
    });
  }

  /**
   * @param {ParentNode} root
   */
  function initAll(root) {
    (root || document).querySelectorAll('[data-viw-item]').forEach((item) => {
      if (item instanceof HTMLElement) initItem(item);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAll());
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', (event) => {
    initAll(event.target);
  });
})();

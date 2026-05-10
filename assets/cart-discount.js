class DiscountUpdateEvent extends Event {
  constructor(resource, sourceId) {
    super('discount:update', { bubbles: true });
    
    this.detail = {
      resource,
      sourceId,
    };
  }
}

class CartDiscount extends HTMLElement {
  #activeFetch = null;

  constructor() {
    super();
  }

  connectedCallback() {
    this.querySelector('.cart-discount__form').addEventListener('submit', this.applyDiscount);

    this.querySelectorAll('.cart-discount__pill-remove').forEach((pill) => {
      pill.addEventListener('click', this.removeDiscount);
    });
  }

  applyDiscount = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const discountCode = form.querySelector('input[name="discount"]');
    if (!(discountCode instanceof HTMLInputElement) || typeof this.dataset.sectionId !== 'string') return;

    const discountCodeValue = discountCode.value;
    if (discountCodeValue.length === 0) return;

    const submitButton = form.querySelector('.cart-discount__button');
    const loader = submitButton.querySelector('.loading-overlay__spinner');
    submitButton.setAttribute('disabled', true);
    loader.classList.remove('hidden');

    const cartDiscountError = this.querySelector('.cart-discount__error');
    cartDiscountError.classList.remove('success-color');
    cartDiscountError.classList.add('hidden');

    const abortController = this.#createAbortController();

    try {
      const existingDiscounts = this.getExistingDiscounts();
      if (existingDiscounts.includes(discountCodeValue)) {
        discountCode.value = '';
        this.handleDiscountError('existing_discount_code', discountCodeValue);

        return;
      } 

      const config = this.fetchConfig('json', {
        body: JSON.stringify({
          discount: [...existingDiscounts, discountCodeValue].join(','),
          sections: [this.dataset.sectionId],
        }),
      });

      const response = await fetch(window.routes.cart_update_url, {
        ...config,
        signal: abortController.signal,
      });

      const data = await response.json();

      const isNewDiscountNonApplicable = data.discount_codes.some((discount) => {
        return discount.code === discountCodeValue && discount.applicable === false;
      });
      if (isNewDiscountNonApplicable) {
        discountCode.value = '';
        this.handleDiscountError('discount_code', discountCodeValue);

        return;
      }

      const newHtml = data.sections[this.dataset.sectionId];
      const parsedHtml = new DOMParser().parseFromString(newHtml, 'text/html');
      const section = parsedHtml.getElementById(`shopify-section-${this.dataset.sectionId}`);
      const discountCodes = section?.querySelectorAll('.cart-discount__pill') || [];

      if (section) {
        const codes = Array.from(discountCodes)
          .map((element) => (element instanceof HTMLLIElement ? element.dataset.discountCode : null))
          .filter(Boolean);

        const areDiscountPillsUnchanged = codes.length === existingDiscounts.length && codes.every((code) => existingDiscounts.includes(code));
        const isNewDiscountApplicable = data.discount_codes.some((discount) => {
          return discount.code === discountCodeValue && discount.applicable === true;
        });
        const isShippingDiscount = areDiscountPillsUnchanged && isNewDiscountApplicable;

        if (isShippingDiscount) {
          this.handleDiscountError('shipping', discountCodeValue);
          discountCode.value = '';

          return;
        }
      }

      document.dispatchEvent(new DiscountUpdateEvent(data, this.id));

      if (this.closest('.cart-drawer')) {
        this.morphSection(`CartDrawer`, data.sections[this.dataset.sectionId], '.drawer__inner');
      } else {
        this.morphSection(`shopify-section-${this.dataset.sectionId}`, data.sections[this.dataset.sectionId]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.#activeFetch = null;

      submitButton.removeAttribute('disabled');
      loader.classList.add('hidden');

      const accordionPanel = this.closest('.accordion__panel');
      if (accordionPanel) {
        this.adjustContainerMaxHeight(accordionPanel, cartDiscountError)
      }
    }
  };

  removeDiscount = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const pill = event.target.closest('.cart-discount__pill');
    if (!(pill instanceof HTMLLIElement)) return;

    const discountCode = pill.dataset.discountCode;
    if (!discountCode) return;

    const existingDiscounts = this.getExistingDiscounts();
    const index = existingDiscounts.indexOf(discountCode);
    if (index === -1) return;

    existingDiscounts.splice(index, 1);

    const abortController = this.#createAbortController();

    try {
      const config = this.fetchConfig('json', {
        body: JSON.stringify({ discount: existingDiscounts.join(','), sections: [this.dataset.sectionId] }),
      });

      const response = await fetch(window.routes.cart_update_url, {
        ...config,
        signal: abortController.signal,
      });

      const data = await response.json();

      document.dispatchEvent(new DiscountUpdateEvent(data, this.id));

      if (this.closest('.cart-drawer')) {
        this.morphSection(`CartDrawer`, data.sections[this.dataset.sectionId], '.drawer__inner');
      } else {
        this.morphSection(`shopify-section-${this.dataset.sectionId}`, data.sections[this.dataset.sectionId]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.#activeFetch = null;
    }
  };

  handleDiscountError(type, code) {
    const cartDiscountError = this.querySelector('.cart-discount__error');
    const cartDiscountErrorText = cartDiscountError.querySelector('.cart-discount__error-text');
  
    const errorMessages = {
      existing_discount_code: cartDiscountError.dataset.existingDiscountCodeError,
      shipping: cartDiscountError.dataset.shippingDiscountCodeWarning,
      default: cartDiscountError.dataset.discountCodeError
    };
  
    const errorMessage = errorMessages[type] || errorMessages.default;
  
    cartDiscountErrorText.innerHTML = errorMessage.replace('{{ code }}', code);
    if (type === 'shipping') cartDiscountError.classList.add('success-color');
    cartDiscountError.classList.remove('hidden');
  }

  getExistingDiscounts() {
    const discountCodes = [];
    const discountPills = this.querySelectorAll('.cart-discount__pill');
    
    for (const pill of discountPills) {
      if (pill instanceof HTMLLIElement && typeof pill.dataset.discountCode === 'string') {
        discountCodes.push(pill.dataset.discountCode);
      }
    }

    return discountCodes;
  }

  #createAbortController() {
    if (this.#activeFetch) {   
      this.#activeFetch.abort();
    }

    const abortController = new AbortController();
    this.#activeFetch = abortController;

    return abortController;
  }

  fetchConfig(type = 'json', config = {}) {
    const headers = { 'Content-Type': 'application/json', Accept: `application/${type}`, ...config.headers };
  
    if (type === 'javascript') {
      headers['X-Requested-With'] = 'XMLHttpRequest';
      delete headers['Content-Type'];
    }
  
    return {
      method: 'POST',
      headers: headers,
      body: config.body,
    };
  }

  adjustContainerMaxHeight(container, element) {
    const offset = element?.offsetHeight || 0;
  
    container.style.maxHeight = container.offsetHeight + offset + 'px';
  }

  morphSection(sectionId, html, sectionInnerElementSelector = null) {
    const fragment = new DOMParser().parseFromString(html, 'text/html');
  
    let existingElement = document.getElementById(sectionId);
    let newElement = fragment.getElementById(sectionId);
  
    if (sectionInnerElementSelector) {
      existingElement = existingElement?.querySelector(sectionInnerElementSelector);
      newElement = newElement?.querySelector(sectionInnerElementSelector);
    }
  
    if (!existingElement) {
      throw new Error(`Section ${sectionId} not found`);
    }
  
    if (!newElement) {
      throw new Error(`Section ${sectionId} not found in the section rendering response`);
    }
  
    const accordionToOpen = newElement.querySelector('.accordion-discount-code .accordion-toggle:not(.not_collapsible');
    if (accordionToOpen) accordionToOpen.classList.add('open_collapsible', 'is-open');
  
    existingElement.replaceWith(newElement);
  }
}

if (!customElements.get('cart-discount-component')) {
  customElements.define('cart-discount-component', CartDiscount);
}

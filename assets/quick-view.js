class QuickViewDrawer extends HTMLElement {
    constructor() {
      super();

      this.addEventListener('close', () => {
        const drawerContent = this.querySelector('.quick-view__content');
        drawerContent.innerHTML = '';
        drawerContent.classList.remove('hide-cover');
  
        document.dispatchEvent(new CustomEvent('quickview:close'));
      });
    }
  }
  customElements.define('quick-view-drawer', QuickViewDrawer);
  
  class QuickViewButton extends HTMLElement {
    constructor() {
      super();

      this.quickButton = this.querySelector('.quick') || this.closest('.quick');
      this.cardExtras = this.quickButton?.closest('.card__extras');
    }

    connectedCallback() {
      this._onClick = (event) => {
        if (
          event.target.closest('.card-quick-view') ||
          event.target.closest('.product-slide-caption')
        ) {
          event.preventDefault();
        }
  
        this.quickButton?.classList.add('loading');
        this.closest('body').classList.add('hidden', 'quick-view-open');
  
        const drawer = document.querySelector('quick-view-drawer');
        if (drawer) {
          drawer
            .querySelector('quick-view')
            .setAttribute('data-product-url', `${this.dataset.productVariantUrl}`);
  
          drawer.querySelector('summary').click();
  
          document.dispatchEvent(
            new CustomEvent('quickview:open', {
              detail: {
                productUrl: this.dataset.productUrl
              }
            })
          );
        } else if (this.dataset.productUrl) {
          window.location = this.dataset.productUrl;
        }
      };
  
      this.addEventListener('click', this._onClick);

      if (this.cardExtras) {
        this._onFocus = () => {
          this.cardExtras.style.bottom = '8px';
        };
        this._onBlur = () => {
          this.cardExtras.style.bottom = '-54px';
        };
        this._onQuickViewOpen = () => {
          this.cardExtras.style.bottom = '-54px';
        };
  
        this.quickButton.addEventListener('focus', this._onFocus);
        this.quickButton.addEventListener('blur', this._onBlur);
        this.quickButton.addEventListener('quickview:open', this._onQuickViewOpen);
      }

      this._onQuickviewLoaded = () => {
        this.quickButton?.classList.remove('loading');
      };
  
      this._onQuickviewError = () => {
        this.quickButton?.classList.remove('loading');
      };
  
      document.addEventListener('quickview:loaded', this._onQuickviewLoaded);
      document.addEventListener('quickview:error', this._onQuickviewError);
    }

    disconnectedCallback() {
      if (this._onClick) {
        this.removeEventListener('click', this._onClick);
      }
  
      if (this.cardExtras) {
        if (this._onFocus) {
          this.quickButton.removeEventListener('focus', this._onFocus);
        }
        if (this._onBlur) {
          this.quickButton.removeEventListener('blur', this._onBlur);
        }
        if (this._onQuickViewOpen) {
          this.quickButton.removeEventListener('quickview:open', this._onQuickViewOpen);
        }
      }
  
      if (this._onQuickviewLoaded) {
        document.removeEventListener('quickview:loaded', this._onQuickviewLoaded);
      }
      if (this._onQuickviewError) {
        document.removeEventListener('quickview:error', this._onQuickviewError);
      }
    }
  }
  customElements.define('quick-view-button', QuickViewButton);
  
  class QuickView extends HTMLElement {
    constructor() {
      super();
      this.overlay = document.querySelector('body > .overlay')
      this.quickModal = this.querySelector('.popup-wrapper')
      this.closeButton = this.querySelector('.button-close')
      this.addEventListener('click', (event) => {
        if (!event.target.closest('.popup-wrapper') || event.target.closest('.button-close')) this.closeQuickView()
      })
      document.addEventListener('keyup', (event) => {
        if (event.code && event.code.toUpperCase() === 'ESCAPE' && this.querySelector('.popup-wrapper.open')) this.closeQuickView()
      })
    }
  
    connectedCallback() {
      new IntersectionObserver(this.handleIntersection.bind(this)).observe(this);
    }
  
    handleIntersection(entries, _observer) {
      if (!entries[0].isIntersecting) return;
      const selector = '.quick-view__content';
      const drawerContent = this.querySelector(selector);
      this.productUrl = this.dataset.productUrl
      this.sectionUrl = `${this.productUrl}&view=quick-view`;
      
      fetch(this.sectionUrl)
        .then(response => response.text())
        .then(responseText => {
          setTimeout(() => {
            const responseHTML = new DOMParser().parseFromString(responseText, 'text/html');
            const productElement = responseHTML.querySelector(selector);
            this.setInnerHTML(drawerContent, productElement.innerHTML);
  
            if (window.Shopify && Shopify.PaymentButton) {
              Shopify.PaymentButton.init();
            }
          }, 1);

          document.body.classList.add('quick-view-load')

          setTimeout(() => {
            drawerContent.classList.add('hide-cover');
  
            document.dispatchEvent(new CustomEvent('quickview:loaded', {
              detail: {
                productUrl: this.dataset.productUrl
              }
            }));
          }, 1);
        })
        .catch(e => {
          console.error(e);

          document.dispatchEvent(new CustomEvent('quickview:error', {
            detail: {
              productUrl: this.dataset.productUrl
            }
          }));
        });
    }
  
    setInnerHTML(element, html) {
      element.innerHTML = html;
  
      // Reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
      element.querySelectorAll('script').forEach(oldScriptTag => {
        const newScriptTag = document.createElement('script');
        Array.from(oldScriptTag.attributes).forEach(attribute => {
          newScriptTag.setAttribute(attribute.name, attribute.value)
        });
        newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
        oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
        this.overlay.classList.add('open')
      });
    }

    closeQuickView() {
      const drawerContent = this.querySelector('.quick-view__content');
      drawerContent.innerHTML = '';
      drawerContent.classList.remove('hide-cover');
      this.closest('body').classList.remove('hidden', 'quick-view-open', 'quick-view-load')
      document.dispatchEvent(new CustomEvent('body:visible'));
      document.dispatchEvent(new CustomEvent('quickview:close'));
      this.closest('details').removeAttribute('open')
      this.overlay.classList.remove('open')
    }
  }
  customElements.define('quick-view', QuickView);
  
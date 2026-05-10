class CartNotification extends HTMLElement {
    constructor() {
      super();

      this.overlay = document.querySelector('body > .overlay')
      this.overlay.addEventListener('click', this.close.bind(this));
      this.notification = document.getElementById('cart-notification');
      this.onBodyClick = this.handleBodyClick.bind(this);
  
      this.notification.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
      this.querySelectorAll('button[type="button"]').forEach((closeButton) =>
        closeButton.addEventListener('click', this.close.bind(this))
      );
    }
  
    open() {
      if(document.body.classList.contains('quick-view-open')) {
        document.body.classList.remove('hidden', 'quick-view-open', 'quick-view-load')
        let openedQuickView = document.querySelector('.popup-wrapper__quick-view.open')
        if(openedQuickView) {
          openedQuickView.closest('details').removeAttribute('open')
          openedQuickView.closest('.quick-view__content').classList.remove('hide-cover');
          openedQuickView.classList.remove('open')
          openedQuickView.closest('.quick-view__content').innerHTML = '';
        }
      }

      this.notification.classList.add('open');
      this.overlay.classList.add('open');
  
      this.notification.addEventListener('transitionend', () => {
        this.notification.focus();
        trapFocus(this.notification);
      }, { once: true });
  
      document.body.classList.add('hidden');
      document.body.addEventListener('click', this.onBodyClick);
    }
  
    close() {
      this.notification.classList.remove('open');
      this.overlay.classList.remove('open');
      document.body.classList.remove('hidden');
      document.dispatchEvent(new CustomEvent('body:visible'));
      document.body.removeEventListener('click', this.onBodyClick);
      removeTrapFocus(this.activeElement);
    }
  
    renderContents(parsedState) {
      this.cartItemKey = parsedState.key;
      this.getSectionsToRender().forEach((section => {
          if(section.id == 'cart-drawer') {
            if(document.querySelector(section.selector)) {
              const elementCartDrawer = document.querySelector(section.selector)
              elementCartDrawer.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
            }
            const notificationHTML = 'cart-drawer';
            const elementNotification = `[id="cart-notification-product-${this.cartItemKey}"]`;
            document.getElementById('cart-notification-wrapper').innerHTML =
              this.getSectionInnerHTML(parsedState.sections[notificationHTML], elementNotification);
          } else {
            if(document.querySelector(section.selector)) {
              const elements = document.querySelectorAll(section.selector)
              Array.from(elements).forEach(element => {
                element.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
              })
            }
          }  
      }));
      this.overlay.addEventListener('click', this.close.bind(this));
      this.open();
    }
  
    getSectionsToRender() {
      let arraySections = []
      if (window.innerWidth > 920 && document.querySelector('.header-without-sidebars')) {
        arraySections = [
          {
              id: 'cart-drawer',
              selector: '#CartDrawer'
            },
          {
              id: 'menu-drawer',
              selector: '#cart-icon-bubble-menu-drawer'
            },
            {
              id: 'header',
              selector: '#cart-icon-bubble-header'
            },
            {
              id: 'secondary-sidebar',
              selector: '#cart-icon-bubble-secondary-sidebar'
            },
            {
              id: 'main-sidebar',
              selector: '#cart-icon-bubble-main-sidebar'
            }
        ];
      } else if (window.innerWidth > 920 && document.querySelector('.secondary-header-section')) {
      arraySections = [
        {
              id: 'cart-drawer',
              selector: '#CartDrawer'
            },
          {
              id: 'menu-drawer',
              selector: '#cart-icon-bubble-menu-drawer'
            },
            {
              id: 'secondary-header',
              selector: '#cart-icon-bubble-secondary-header'
            },
            {
              id: 'secondary-sidebar',
              selector: '#cart-icon-bubble-secondary-sidebar'
            },
            {
              id: 'main-sidebar',
              selector: '#cart-icon-bubble-main-sidebar'
            }
      ];
    } else {
        arraySections = [
          {
              id: 'cart-drawer',
              selector: '#CartDrawer'
            },
          {
              id: 'menu-drawer',
              selector: '#cart-icon-bubble-menu-drawer'
            },
            {
              id: 'mobile-header',
              selector: '#cart-icon-bubble-mobile-header'
            }
        ];
      }
      return arraySections
    }
  
    getSectionInnerHTML(html, selector = '.shopify-section') {
      return new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector(selector).innerHTML;
    }
  
    handleBodyClick(evt) {
      const target = evt.target;
      if (target !== this.notification && !target.closest('cart-notification')) {
        const disclosure = target.closest('details-disclosure, header-menu');
        this.activeElement = disclosure ? disclosure.querySelector('summary') : null;
        this.close();
      }
    }
  
    setActiveElement(element) {
      this.activeElement = element;
    }
  }
  
  customElements.define('cart-notification', CartNotification);
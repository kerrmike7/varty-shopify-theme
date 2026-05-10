class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.CartDrawer = document.querySelector('.drawer__inner')
    this.cartLinks = document.querySelectorAll('#cart-link');
    this.overlay = document.querySelector('body > .overlay')
    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.overlay.addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
    document.addEventListener('shopify:section:load', this.setHeaderCartIconAccessibility.bind(this));
    document.querySelector('#shopify-section-cart-drawer').addEventListener('shopify:section:select', this.sectionSelect.bind(this));
    document.querySelector('#shopify-section-cart-drawer').addEventListener('shopify:section:deselect', this.close.bind(this));
  }

  setHeaderCartIconAccessibility() {
    this.cartLinks = document.querySelectorAll('#cart-link');
    Array.from(this.cartLinks).forEach(cartLink => {
      cartLink.setAttribute('role', 'button');
      cartLink.setAttribute('aria-haspopup', 'dialog');
      cartLink.addEventListener('click', (event) => {
        event.preventDefault();
        this.open(cartLink)
      });
      cartLink.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          event.preventDefault();
          this.open(cartLink);
        }
      });
    })
  }

  sectionSelect() {
    this.cartLink = document.querySelector('#cart-link')
    this.open(this.cartLink)
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    if (triggeredBy) this.opener = triggeredBy.querySelector('a.cart');

    if (document.body.classList.contains('quick-view-open')) {
      document.body.classList.remove('hidden', 'quick-view-open', 'quick-view-load')
      let openedQuickView = document.querySelector('.popup-wrapper__quick-view.open')
      if (openedQuickView) {
        openedQuickView.closest('details').removeAttribute('open')
        openedQuickView.closest('.quick-view__content').classList.remove('hide-cover');
        openedQuickView.classList.remove('open')
        openedQuickView.closest('.quick-view__content').innerHTML = '';
      }
    }

    setTimeout(() => { this.classList.add('animate', 'active') });
    this.overlay.classList.add('open');
    document.body.classList.add('hidden');

    const focusTarget =
      this.CartDrawer.querySelector(
        'a[href], button:enabled, input:not([type=hidden]):enabled, select:enabled, textarea:enabled'
      ) ||
      this.querySelector('.drawer__close') ||
      this.CartDrawer;
    setTimeout(() => trapFocus(this, focusTarget), 10);

    if (document.querySelector('#shopify-section-menu-drawer .menu-drawer.open') || document.querySelector('#shopify-section-mega-menu-drawer .menu-drawer.open')) {
      document.querySelector('.menu-drawer').setAttribute('hidden', 'true')
      document.querySelector('.menu-drawer').classList.remove('open')
    }

    document.dispatchEvent(new CustomEvent('cart-drawer:open'));
  }

  close() {
    this.classList.remove('active');
    this.overlay.classList.remove('open')

    removeTrapFocus(this.opener);

    document.body.classList.remove('hidden')
    document.dispatchEvent(new CustomEvent('body:visible'));
  }

  renderContents(parsedState) {
    this.querySelector('.drawer__inner').classList.contains('is-empty') && this.querySelector('.drawer__inner').classList.remove('is-empty');
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section => {
      const sectionElements = document.querySelectorAll(section.selector);
      if(sectionElements) {
        Array.from(sectionElements).forEach(sectionElement => {
          sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
        })
      } 
    }));

    if(this.className.includes('open-after-adding')) {
      setTimeout(() => {
        document.querySelector('body > .overlay').addEventListener('click', this.close.bind(this));
        this.open();
      });
    }
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
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

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

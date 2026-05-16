class MenuDrawer extends HTMLElement {
    constructor() {
      super();

      this.elements = {
        sidebarDrawer: this.querySelector('.menu-drawer'),
        overlay:  document.querySelector('body > .overlay'),
        sidebarDrawerButton: this.querySelectorAll('.button-close'),
        shopifySection: document.querySelector('#shopify-section-menu-drawer') || document.querySelector('#shopify-section-mega-menu-drawer')
      };

      document.querySelectorAll('.burger-menu').forEach((item) =>
        item.addEventListener('click', (event) => this.openDrawer(event))
      );

      document.querySelectorAll('.burger-menu').forEach((item) => {
        item.addEventListener('keydown', (event) => {
          if (event.code.toUpperCase() === 'ENTER') {
            item.dataset.menuDrawerEnterArmed = '1';
          }
        });

        item.addEventListener('keyup', (event) => {
          if (event.code.toUpperCase() !== 'ENTER') return;
          if (item.dataset.menuDrawerEnterArmed !== '1') return;

          delete item.dataset.menuDrawerEnterArmed;
          this.openDrawer(event);
        });

        item.addEventListener('blur', () => {
          delete item.dataset.menuDrawerEnterArmed;
        });
      });

      if (Shopify.designMode) {
        this.elements.shopifySection.addEventListener('shopify:section:select', this.openDrawer.bind(this));
        this.elements.shopifySection.addEventListener('shopify:section:deselect', this.closeDrawer.bind(this));
        this.elements.shopifySection.addEventListener('shopify:section:unload', this.openDrawer.bind(this))
        window.addEventListener('shopify:section:load', () => document.querySelectorAll('.burger-menu').forEach(item => item.addEventListener('click', this.openDrawer.bind(this))))
      }

      this.elements.sidebarDrawerButton.forEach(item => item.addEventListener('click', this.closeDrawer.bind(this)));

      document.addEventListener('keyup', (event) => {
        if (event.code?.toUpperCase() === 'ESCAPE' && this.elements.sidebarDrawer.classList.contains('open')) this.closeDrawer()
      })
      if (this.elements.overlay) this.elements.overlay.addEventListener('click', this.closeDrawer.bind(this));
      window.addEventListener('resize', this.offsetHeight.bind(this))
    }

    openDrawer(event) {
      const trigger = event?.currentTarget;
      this.drawerOpener = trigger?.matches?.('.burger-menu') ? trigger : document.querySelector('.burger-menu');

      const drawer = this.elements.sidebarDrawer;
      drawer.removeAttribute('hidden');

      this.allFocusableElements = getMenuDrawerFocusableElements(drawer, false);
      this.allFirstLevelFocusableElements = getMenuDrawerFocusableElements(drawer, false, ['.nested-submenu-second-level', '.nested-submenu-third-level']);
    
      requestAnimationFrame(() => {
        drawer.classList.add('open');

        document.body.classList.add('hidden');
        if (document.querySelector('#shopify-section-mega-menu-drawer')) {
          this.elements.overlay?.classList.add('open');
        }
    
        requestAnimationFrame(() => {
          this.updatePinnedHeight();
          trapFocus(drawer);
        });
      });
    }
    
    updatePinnedHeight() {
      const pinned = document.querySelector('[id$="menu-drawer"] .pinned-block');
      const nested = document.querySelector('[id$="menu-drawer"] .nested-submenu');
      if (pinned && nested) {
        const bottomPadding = pinned.offsetHeight + 16; 
        this.elements.sidebarDrawer.style.setProperty('--height-pinned-block', `${bottomPadding}px`);
      }
    }

    offsetHeight() {
      if(document.querySelector('[id$="menu-drawer"] .pinned-block') && document.querySelector('[id$="menu-drawer"] .nested-submenu')) {
        let bottomPadding = document.querySelector('[id$="menu-drawer"] .pinned-block').offsetHeight + 16
        this.elements.sidebarDrawer.setAttribute('style', `--height-pinned-block: ${bottomPadding}px`)
      }
    }
  
    closeDrawer() {
      removeTrapFocus(this.drawerOpener);
      this.elements.sidebarDrawer.setAttribute('hidden', 'true')
      this.elements.sidebarDrawer.classList.remove('open')
      if (document.querySelector('#shopify-section-mega-menu-drawer')) this.elements.overlay.classList.remove('open')
      document.body.classList.remove('hidden')
      document.dispatchEvent(new CustomEvent('body:visible'));
    }
  }

  customElements.define('menu-drawer', MenuDrawer);  

class DrawerMenu extends HTMLElement {
  constructor() {
    super();

    this.summaryElement = this.firstElementChild
    this.summaryElementDropdownIcon = this.summaryElement.querySelector('.dropdown-icon')
    this.contentElement = this.summaryElement.nextElementSibling
    this.contentElementFocusableElements = getMenuDrawerFocusableElements(this.contentElement, true);

    this.summaryElement.addEventListener('click', this.onSummaryClicked.bind(this))

    if (this.contentElement) this.button = this.contentElement.querySelector('button')
      
    if (this.button) this.button.addEventListener('click', () => {
      this.isOpen = JSON.parse(this.getAttribute('open'))
      if (this.isOpen) {
        const panel = this.button.closest('.nested-submenu')

        if (!panel) return

        panel.classList.remove('nested-submenu--stagger-in')
        panel.previousElementSibling.setAttribute('open', 'false')
        panel.previousElementSibling.classList.add('closing') 
        this.updateTabIndex(this.contentElement, false)

        setTimeout(() => {
          panel.previousElementSibling.classList.remove('closing')
        }, 400)
      }
    })

    document.addEventListener('body:visible', () => {
      if (!document.querySelector('#shopify-section-menu-drawer .menu-drawer.open') || !document.querySelector('#shopify-section-mega-menu-drawer .menu-drawer.open')) {
        document.querySelectorAll('.nested-submenu').forEach(submenu => {
          if (submenu.previousElementSibling.getAttribute('open') == 'true') {
            submenu.previousElementSibling.setAttribute('open', 'false')
            submenu.previousElementSibling.classList.add('closing')
            this.updateTabIndex(submenu, false)
            setTimeout(() => {
              submenu.previousElementSibling.classList.remove('closing')
            }, 500)
          }
        })
      }
    })

    this.detectClickOutsideListener = this.detectClickOutside.bind(this)
    this.detectEscKeyboardListener = this.detectEscKeyboard.bind(this)
    this.detectFocusOutListener = this.detectFocusOut.bind(this)
    this.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  onSummaryClicked(event) {
    if (event && event.target && event.target.closest('a')) return

    this.isOpen = JSON.parse(this.summaryElement.getAttribute('open'))

    if (this.isOpen) {
      if (this.contentElement) this.contentElement.classList.remove('nested-submenu--stagger-in')
      this.summaryElement.setAttribute('open', 'false')
      this.setAttribute('open', 'false')
      this.updateTabIndex(this.contentElement, false);
    } else {
      this.summaryElement.setAttribute('open', 'true')
      this.setAttribute('open', 'true')

      if (this.contentElement && this.closest('.mega-menu-drawer--animated')) {
        const parentPanel = this.closest('.nested-submenu');
        parentPanel?.classList.remove('nested-submenu--stagger-in');
        
        this.contentElement.classList.add('nested-submenu--stagger-in');

        if (parentPanel) {
          requestAnimationFrame(() => {
            this.contentElement.classList.remove('nested-submenu--stagger-in');

            requestAnimationFrame(() => {
              this.contentElement.classList.add('nested-submenu--stagger-in');
            });
          });
        }
      }

      this.updateTabIndex(this.contentElement, true);
    }
  }

  detectClickOutside(event) {
    if (!this.contains(event.target) && !(event.target.closest('details') instanceof DetailsDropdown)) this.open = false
  }

  detectEscKeyboard(event) {
    if (event.code === 'Escape') {
      const targetMenu = event.target.closest('details[open]')
      if (targetMenu) {
        targetMenu.open = false
      }
    }
  }

  onKeyDown(event) {
    const currentFocus = document.activeElement;

    switch (event.code) {
      case 'Enter':
      case 'Space': {
        const shouldToggleSummary =
          currentFocus &&
          this.summaryElement.contains(currentFocus) &&
          !currentFocus.closest?.('a');

        if (shouldToggleSummary) {
          event.preventDefault();
          this.onSummaryClicked(event);
        }

        break;
      }

      case 'Escape':
        this.updateTabIndex(this.contentElement, false)
        break;
    }
  }

  updateTabIndex(menuElement, shouldAllowTabFocus) {
    if (!menuElement) return;

    const menuDrawer = menuElement.closest('menu-drawer');
    const activeDrawerMenuContent =
      menuDrawer?.querySelector('.second-level-item[open="true"]') ||
      menuDrawer?.querySelector('.top-level-item[open="true"]');

    let activeDrawerMenu;
    if (activeDrawerMenuContent) activeDrawerMenu = activeDrawerMenuContent.closest('drawer-menu');

    if (shouldAllowTabFocus) {
      menuDrawer?.allFocusableElements.forEach(element => {
        element.setAttribute('inert', '')
      });

      this.contentElementFocusableElements.forEach(element => {
        element.removeAttribute('inert')
      });

      let excludedSelectors = [];
      if (menuElement.classList.contains('nested-submenu-second-level')) {
        excludedSelectors = ['.nested-submenu-third-level'];
      } else if (menuElement.classList.contains('nested-submenu-third-level')) {
        excludedSelectors = ['.nested-submenu-fourth-level'];
      } else if (menuElement.classList.contains('menu-drawer__content')) {
        excludedSelectors = ['.nested-submenu-second-level'];
      } 

      trapFocus(menuElement, undefined, excludedSelectors);

      return;
    } 

    this.contentElementFocusableElements.forEach(element => {
      element.setAttribute('inert', '')
    });

    if (activeDrawerMenu) {
      activeDrawerMenu.contentElementFocusableElements.forEach(element => {
        element.removeAttribute('inert')
      });

      trapFocus(activeDrawerMenu.contentElement, this.summaryElementDropdownIcon)
    } else {
      menuDrawer.allFirstLevelFocusableElements.forEach(element => {
        element.removeAttribute('inert')
      });

      trapFocus(menuDrawer.elements.sidebarDrawer, this.summaryElementDropdownIcon)
    }
  }

  detectFocusOut(event) {
    if (event.relatedTarget && !this.contains(event.relatedTarget)) {
      this.open = false
    }
  }

  detectHover(event) {
    if (this.trigger !== 'hover') return;

    if (event.type === 'mouseenter') {
      this.open = true
    }
    else {
      this.open = false
    }
  }
}
customElements.define('drawer-menu', DrawerMenu)

function getMenuDrawerFocusableElements(
  menuElement,
  restrictToDirectChildren = false,
  excludedSelectors = []
) {
  if (!menuElement) return [];

  const scopePrefix = restrictToDirectChildren ? ':scope > ' : '';

  const selectors = [
    `${scopePrefix}ul > li > drawer-menu > summary > .menu__item-title > a[href]`,
    `${scopePrefix}ul > li > drawer-menu > summary > .menu__item-title > button:not([disabled])`,
    `${scopePrefix}.menu-drawer__header button`,
    `${scopePrefix}ul > li > a[href]`,
    `${scopePrefix}a[href]`,
    `${scopePrefix}div > a[href]`
  ];

  const elements = Array.from(
    menuElement.querySelectorAll(selectors.join(', '))
  );

  if (!excludedSelectors.length) {
    return elements;
  }

  return elements.filter((el) => {
    return !excludedSelectors.some((selector) => el.closest(selector));
  });
}
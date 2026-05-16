class OverlapNavigation extends HTMLElement {
  constructor() {
    super();

    this._mounted = false;
    this._inited = false;

    this.firstSec = null;
    this.header = null;
    this.footer = null;
    this.invertedElements = null;
    this.sidebars = null;
    this.announcementBar = null;
    this.announcementBarHeight = 0;
    this.headerGroup = null;
    this.headerGroupSections = null;

    this.headerHeight = 0;
    this.headerGroupHeight = 0;

    this.currentScrollPos = 0;
    this.lastScrollPos = 0;
    this.scrollDelta = false;

    this.themeContentEl = null;

    this._scrollRaf = 0;
    this._handleChangesRaf = 0;

    this._onScrollBound = this._onScrollRaf.bind(this);
    this._onMobileScrollBound = this._onMobileScrollRaf.bind(this);
    this._onResizeBound = this._onResize.bind(this);

    this._sidebarScrollHandlers = new WeakMap();
    this._io = null;
    this._firstIntent = null;
    this._initScheduled = false;

    this._didFirstInvertPass = false;
    this._invertHeaderTimer = 0;

    if (Shopify.designMode) {
      [
        'shopify:section:load',
        'shopify:section:reorder',
        'shopify:section:unload',
        'shopify:section:select',
        'shopify:section:deselect',
      ].forEach((eventName) => {
        document.addEventListener(eventName, () => this._scheduleHandleSectionChanges());
      });
    }

    document.addEventListener('collapsible-menu:opened', () => {
      setTimeout(() => {
        if (this._inited) this._scheduleHandleSectionChanges();
        else this._scheduleInitSoon('menu');
      }, 350);
    });
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    this._armLazyInit();

    this._lastWidth = window.innerWidth;
    window.addEventListener('resize', this._onResizeBound, { passive: true });
  }

  disconnectedCallback() {
    this._mounted = false;

    this._disarmLazyInit();

    if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
    this._scrollRaf = 0;

    if (this._handleChangesRaf) cancelAnimationFrame(this._handleChangesRaf);
    this._handleChangesRaf = 0;

    if (this._invertHeaderTimer) clearTimeout(this._invertHeaderTimer);
    this._invertHeaderTimer = 0;

    window.removeEventListener('resize', this._onResizeBound);

    document.removeEventListener('scroll', this._onScrollBound);
    document.removeEventListener('scroll', this._onMobileScrollBound);

    if (this.sidebars?.length) {
      this.sidebars.forEach((sidebar) => {
        const fn = this._sidebarScrollHandlers.get(sidebar);
        if (fn) sidebar.removeEventListener('scroll', fn);
      });
    }
    this._sidebarScrollHandlers = new WeakMap();

    this._inited = false;
    this._initScheduled = false;
    this._didFirstInvertPass = false;
  }

  _armLazyInit() {
    if (this._io || this._firstIntent) return;

    this._firstIntent = () => this._scheduleInitSoon('intent');
    this.addEventListener('pointerenter', this._firstIntent, { once: true, passive: true });
    this.addEventListener('pointerdown', this._firstIntent, { once: true, passive: true });
    this.addEventListener('focusin', this._firstIntent, { once: true });

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        const e = entries && entries[0];
        if (!e) return;
        if (e.isIntersecting) this._scheduleInitSoon('viewport');
      }, { root: null, rootMargin: '400px 0px', threshold: 0.01 });

      this._io.observe(this);
    } else {
      window.addEventListener('load', () => this._scheduleInitSoon('fallback'), { once: true });
    }
  }

  _disarmLazyInit() {
    if (this._firstIntent) {
      this.removeEventListener('pointerenter', this._firstIntent);
      this.removeEventListener('pointerdown', this._firstIntent);
      this.removeEventListener('focusin', this._firstIntent);
      this._firstIntent = null;
    }
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
  }

  _scheduleInitSoon(reason) {
    if (this._inited || this._initScheduled) return;
    this._initScheduled = true;

    this._disarmLazyInit();

    const run = () => {
      this._initScheduled = false;
      this._initHard();
    };

    requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 1500 });
      } else {
        setTimeout(run, 0);
      }
    });
  }

  _initHard() {
    if (this._inited) return;
    this._inited = true;

    this.init();
    this._bindScrollMode();
    this._updateSectionStyles();
    this._updateHeaderStyles();
    this.classList.add('loaded');
    this._scheduleFirstInvertPass();
  }

  _scheduleFirstInvertPass() {
    if (this._didFirstInvertPass) return;

    const run = () => {
      if (this._didFirstInvertPass) return;
      this._didFirstInvertPass = true;

      this._initInvertedElements();
    };

    requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 2000 });
      } else {
        setTimeout(run, 0);
      }
    });
  }

  _onResize() {
    const currentWidth = window.innerWidth;
    if (currentWidth === this._lastWidth) return;
    this._lastWidth = currentWidth;

    if (!this._inited) return;

    this._bindScrollMode();
    this._scheduleHandleSectionChanges();
  }

  _scheduleHandleSectionChanges() {
    if (!this._inited) return;
    if (this._handleChangesRaf) return;

    this._handleChangesRaf = requestAnimationFrame(() => {
      this._handleChangesRaf = 0;

      if (this._invertHeaderTimer) {
        clearTimeout(this._invertHeaderTimer);
        this._invertHeaderTimer = 0;
      }

      this.init();
      this._updateSectionStyles();
      this._updateHeaderStyles();
      this.classList.add('loaded');

      this._didFirstInvertPass = false;
      this._scheduleFirstInvertPass();

      if (window.innerWidth > 920) this._rebindSidebarScroll();
    });
  }

  _bindScrollMode() {
    document.removeEventListener('scroll', this._onScrollBound);
    document.removeEventListener('scroll', this._onMobileScrollBound);

    this._rebindSidebarScroll(true);

    if (window.innerWidth > 920) {
      document.addEventListener('scroll', this._onScrollBound, { passive: true });
      this._rebindSidebarScroll(false);
    } else {
      document.addEventListener('scroll', this._onMobileScrollBound, { passive: true });
    }
  }

  _rebindSidebarScroll(removeOnly = false) {
    if (this.sidebars?.length) {
      this.sidebars.forEach((sidebar) => {
        const fn = this._sidebarScrollHandlers.get(sidebar);
        if (fn) sidebar.removeEventListener('scroll', fn);
      });
    }
    if (removeOnly) return;

    if (this.sidebars?.length) {
      this.sidebars.forEach((sidebar) => {
        const fn = () => this._onScrollRaf();
        this._sidebarScrollHandlers.set(sidebar, fn);
        sidebar.addEventListener('scroll', fn, { passive: true });
      });
    }
  }

  init() {
    this.firstSec = this.querySelector('main .shopify-section:first-child:has(.overlapping-section)');
    this.header = this.querySelector('.transparent-header');
    this.footer = this.querySelector('.shopify-section-footer');
    this.invertedElements = this.querySelectorAll('.scroll-color');
    this.sidebars = this.querySelectorAll('.transparent-sidebar');
    this.announcementBar = this.querySelector('.announcement-bar-section');

    this.themeContentEl = this.querySelector('.theme-content');

    this.announcementBarHeight = 0;
    if (this.announcementBar) this.announcementBarHeight = this.announcementBar.offsetHeight;

    this.headerGroup = this.querySelector('.header-group');
    this.headerGroupSections = this.headerGroup
      ? this.headerGroup.querySelectorAll('.shopify-section-group-more-header-sections')
      : [];

    this.currentScrollPos = 0;
    this.lastScrollPos = 0;
    this.scrollDelta = false;

    if (window.innerWidth < 920) {
      this.header = this.querySelector('.mobile-header-section.transparent-header');
    }
  }

  _onScrollRaf() {
    if (this._scrollRaf) return;
    this._scrollRaf = requestAnimationFrame(() => {
      this._scrollRaf = 0;
      this._onScroll();
    });
  }

  _onMobileScrollRaf() {
    if (this._scrollRaf) return;
    this._scrollRaf = requestAnimationFrame(() => {
      this._scrollRaf = 0;
      this._onMobileScroll();
    });
  }

  _onScroll() {
    if (!this._didFirstInvertPass) this._scheduleFirstInvertPass();

    if (this.header && !this.header.classList.contains('header--disable-sticky')) {
      this.sidebars.length === 0 ? this.invertHeader() : this.invertHeaderBetweenSidebars();
    }
    this.invertElementsOnScroll();
  }

  _onMobileScroll() {
    if (!this._didFirstInvertPass) this._scheduleFirstInvertPass();

    if (this.header && !this.header.classList.contains('header--disable-sticky')) {
      this.invertHeader();
    }
  }


  _initInvertedElements() {
    const themeContent = this.themeContentEl || this.querySelector('.theme-content');
    if (!themeContent) return;

    const themeTop = themeContent.getBoundingClientRect().top;
    const footerRect = this.footer ? this.footer.getBoundingClientRect() : null;
    const sectionRect = this.firstSec ? this.firstSec.getBoundingClientRect() : null;

    const m = {
      y0: (window.scrollY === 0),
      scrollDelta: this.scrollDelta,
      themeTop,
      footerTop: footerRect ? footerRect.top : null,
      sectionBottom: sectionRect ? sectionRect.bottom : null,
    };

    this.invertedElements.forEach((el) => {
      const r = el.getBoundingClientRect();
      this._invertNavigationColorFast(el, r, m);
    });
  }

  invertElementsOnScroll() {
    if (window.innerWidth < 920) return;

    this.currentScrollPos = window.scrollY;
    this.scrollDelta = (this.lastScrollPos <= this.currentScrollPos);
    this.lastScrollPos = this.currentScrollPos;

    const themeContent = this.themeContentEl || this.querySelector('.theme-content');
    if (!themeContent) return;

    const themeTop = themeContent.getBoundingClientRect().top;
    const footerRect = this.footer ? this.footer.getBoundingClientRect() : null;
    const sectionRect = this.firstSec ? this.firstSec.getBoundingClientRect() : null;

    const m = {
      y0: (window.scrollY === 0),
      scrollDelta: this.scrollDelta,
      themeTop,
      footerTop: footerRect ? footerRect.top : null,
      sectionBottom: sectionRect ? sectionRect.bottom : null,
    };

    for (let i = 0; i < this.invertedElements.length; i++) {
      const el = this.invertedElements[i];
      const r = el.getBoundingClientRect();

      if (r.bottom < -300 || r.top > window.innerHeight + 300) {
        el.classList.remove('section-color', 'footer-color');
        continue;
      }

      this._invertNavigationColorFast(el, r, m);
    }
  }

  _invertNavigationColorFast(el, r, m) {
    el.classList.remove('section-color', 'footer-color');

    const hasFooter = (m.footerTop !== null);
    const hasSection = (m.sectionBottom !== null);

    if (m.y0) {
      if (hasSection && r.top > m.themeTop && r.bottom < m.sectionBottom) el.classList.add('section-color');
      if (hasFooter && r.bottom > m.footerTop) el.classList.add('footer-color');
      return;
    }

    if (m.scrollDelta) {
      if (hasFooter && hasSection) {
        if (r.top > m.themeTop && r.top < m.footerTop && r.bottom < m.sectionBottom) el.classList.add('section-color');
        else if (r.bottom > m.footerTop) el.classList.add('footer-color');
      } else if (!hasFooter && hasSection) {
        (r.top > m.themeTop && r.bottom < m.sectionBottom) ? el.classList.add('section-color') : 0;
      } else if (hasFooter && !hasSection) {
        if (r.bottom > m.footerTop) el.classList.add('footer-color');
      }
    } else {
      if (hasFooter && hasSection) {
        if (r.top > m.themeTop && r.top < m.footerTop && r.top < m.sectionBottom) el.classList.add('section-color');
        else if (r.top > m.footerTop) el.classList.add('footer-color');
      } else if (!hasFooter && hasSection) {
        (r.top > m.themeTop && r.top < m.sectionBottom) ? el.classList.add('section-color') : 0;
      } else if (hasFooter && !hasSection) {
        if (r.top > m.footerTop) el.classList.add('footer-color');
      }
    }
  }

  _updateHeaderStyles() {
    if (!this.header) return;

    if (this.firstSec && this.header.classList.contains('secondary-header-section')) {
      this.header.classList.remove('colored');
    }

    if (this.firstSec) {
      this.header.classList.remove('colored');
      this.header.classList.add('transparent');
    } else {
      this.header.classList.remove('transparent');
      this.header.classList.add('colored');
    }

    if (!this.header.classList.contains('header--disable-sticky')) {
      this.sidebars.length > 0 ? this.invertHeaderBetweenSidebars() : this.invertHeader();
    }
  }

  _updateSectionStyles() {
    if (!this.firstSec) return;

    if (
      (this.announcementBar && this.firstSec.querySelector('.full-height--desktop')) ||
      (this.announcementBar && this.firstSec.querySelector('.full-height--mobile'))
    ) {
      this.firstSec.setAttribute('style', `--announcement-height: ${this.announcementBarHeight}px;`);
    }

    let headerSection;
    if (window.innerWidth < 920) headerSection = this.querySelector('.mobile-header-section');
    else headerSection = this.querySelector('.header-section');

    this.headerHeight = this.header && headerSection ? headerSection.offsetHeight : 0;

    this.headerGroupHeight =
      (this.headerGroupSections?.length > 0 && this.headerGroup)
        ? (this.headerGroup.querySelector('.header-group__sections')?.offsetHeight || 0)
        : 0;

    if (this.headerGroupSections?.length > 0 && this.headerGroup) {
      this.headerGroup.setAttribute('style', `top: ${this.headerHeight}px; z-index: 4;`);

      if (window.innerWidth < 920 && !this.headerGroup.classList.contains('header-group--mobile-overlap-enabled')) {
        this.headerGroupSections.forEach(s => s.classList.remove('transparent'));
      } else {
        this.headerGroupSections.forEach(s => s.classList.add('transparent'));
      }
    }

    const sectionContent = this.firstSec.querySelectorAll('.overlapping-section .overlapping-content-js');
    sectionContent.forEach((content) => {
      content.style.marginTop = (this.headerGroupHeight + this.headerHeight) + 'px';
      content.setAttribute('style', `margin-top: ${this.headerGroupHeight + this.headerHeight}px; --overlap-margin-top: ${this.headerGroupHeight + this.headerHeight}px;`);
      content.nextElementSibling?.classList.contains('section-selected-indicator') ? content.nextElementSibling.setAttribute('style', `--overlap-margin-top: ${this.headerGroupHeight + this.headerHeight}px;`) : 0;
    });
  }

  invertHeader() {
    if (!this.firstSec || !this.header) return;

    if (this.header.querySelector('.header--sticky') && this.header.getBoundingClientRect().top < 0) {
      this.header.classList.replace('transparent', 'colored');
    }

    if (this.header.closest('.shopify-section-header-sticky') || this.header.closest('.shopify-section-mobile-header-sticky')) {
      this.header.classList.replace('transparent', 'colored');
    }

    if (this._invertHeaderTimer) clearTimeout(this._invertHeaderTimer);
    this._invertHeaderTimer = setTimeout(() => {
      this._invertHeaderTimer = 0;
      if (!this.firstSec || !this.header) return;

      if (this.header.querySelector('.header--sticky') && this.header.getBoundingClientRect().top >= 0) {
        this.header.classList.replace('colored', 'transparent');
      }

      if (
        (this.header.closest('.shopify-section-header:not(.shopify-section-header-sticky)') ||
          this.header.closest('.shopify-section-mobile-header:not(.shopify-section-mobile-header-sticky)')) &&
        !this.header.querySelector('.header--sticky')
      ) {
        this.header.classList.replace('colored', 'transparent');
      }
    }, 10);
  }

  invertHeaderBetweenSidebars() {
    if (!this.header || !this.footer) return;
    if (this.header.querySelector('.header--disable-sticky')) return;

    const headerContainer = this.header.closest('.shopify-section-header');
    if (!headerContainer) return;

    headerContainer.classList.remove('header--static');

    let sectionRect;
    if (this.firstSec) sectionRect = this.firstSec.getBoundingClientRect();

    const footerHeight = this.querySelector('.shopify-section-footer')?.getBoundingClientRect().height || 0;
    const footerTop = document.documentElement.offsetHeight - footerHeight;

    const scrolledEnough = (sectionRect && sectionRect.bottom + 500 > 0) || (footerTop < window.pageYOffset + 500);

    scrolledEnough ? headerContainer.classList.add('header--static') : headerContainer.classList.remove('header--static');
    !headerContainer.classList.contains('header--static')
      ? headerContainer.classList.add('sticky')
      : headerContainer.classList.remove('sticky');

    if (sectionRect && !this.header.classList.contains('transparent')) {
      this.header.classList.replace('colored', 'transparent');
    }

    if (sectionRect && sectionRect.bottom > window.pageYOffset || (sectionRect && sectionRect.top == window.pageYOffset - 500)) return;

    if (this.header.querySelector('.header--sticky') && this.header.getBoundingClientRect().top < 0) {
      this.header.classList.replace('transparent', 'colored');
    }

    if (this.header.closest('.shopify-section-header-sticky')) {
      this.header.classList.replace('transparent', 'colored');
    }

    if (this.firstSec && this.header.querySelector('.header--sticky') && this.header.getBoundingClientRect().top >= 0) {
      this.header.classList.replace('colored', 'transparent');
    }

    if (!this.firstSec) this.header.classList.replace('transparent', 'colored');
  }
}

customElements.define("overlap-navigation", OverlapNavigation);
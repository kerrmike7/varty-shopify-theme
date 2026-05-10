class SearchModal extends HTMLElement {
    constructor() {
      super();
      
      if (this.isPredictiveSearchDisabled()) {
        return;
      }

      this.modal = this.querySelector('.search-modal');
      this.detailsContainer = this.querySelector('details');
      this.summaryToggle = this.querySelector('summary');
      this.input = this.querySelector('.search__input')
      this.searchField = this.summaryToggle.querySelector('.search-field__text')
      this.overlay = document.querySelector('body > .overlay')
      this.menuDrawerFocusReturn = null;

      document.addEventListener(
        'keyup',
        (event) => event.code && event.code.toUpperCase() === 'ESCAPE' && this.close()
      );
    
      if (this.searchField) {
        this.summaryToggle.querySelector('.search-field__text').addEventListener('input', (event) => this.open(event));
      } else {
        this.summaryToggle.addEventListener('click', this.onSummaryClick.bind(this));
      }

      if (document.querySelector('.overlay.open')) document.querySelector('.overlay').addEventListener('click', this.close.bind(this))

      document.querySelector('button[type="reset"]').addEventListener(
        'click',
        this.reset.bind(this)
      );
        
      this.summaryToggle.setAttribute('role', 'button');
    }

    isPredictiveSearchDisabled() {
      const shopifyFeatures = document.getElementById("shopify-features");
      const features = shopifyFeatures ? JSON.parse(shopifyFeatures.textContent) : {};
      const isPredictiveSearchSupported = features.predictiveSearch === true;

      /* Check if predictive search is supported via hardcoded array in case API returns 'true' for unsupported language */
      const supportedLanguages = [
        "af",  // Afrikaans
        "sq",  // Albanian
        "hy",  // Armenian
        "bs",  // Bosnian
        "bg",  // Bulgarian
        "ca",  // Catalan
        "hr",  // Croatian
        "cs",  // Czech
        "da",  // Danish
        "nl",  // Dutch
        "en",  // English
        "et",  // Estonian
        "fo",  // Faroese
        "fi",  // Finnish
        "fr",  // French
        "gd",  // Gaelic
        "de",  // German
        "el",  // Greek
        "hu",  // Hungarian
        "is",  // Icelandic
        "id",  // Indonesian
        "it",  // Italian
        "la",  // Latin
        "lv",  // Latvian
        "lt",  // Lithuanian
        "mk",  // Macedonian
        "mo",  // Moldovan
        "no",  // Norwegian
        "nb",  // Norwegian (Bokmål)
        "nn",  // Norwegian (Nynorsk)
        "pl",  // Polish
        "pt-BR",  // Portuguese (Brazil)
        "pt-PT",  // Portuguese (Portugal)
        "ro",  // Romanian
        "ru",  // Russian
        "sr",  // Serbian
        "sh",  // Serbo-Croatian
        "sk",  // Slovak
        "sl",  // Slovenian
        "es",  // Spanish
        "sv",  // Swedish
        "tr",  // Turkish
        "uk",  // Ukrainian
        "vi",  // Vietnamese
        "cy"   // Welsh
      ];
      const currentLanguage = document.documentElement.lang; 

      return !isPredictiveSearchSupported || !supportedLanguages.includes(currentLanguage);
    }

    onSummaryClick(event) {
      event.preventDefault();
      event.target.closest('details').hasAttribute('open')
        ? this.close()
        : this.open(event);
    }
  
    onBodyClick(event) {
      if (event.target.classList.contains('overlay') || event.target.closest('.button-close')) this.close();
    }

    resolveSearchModalOpener(event) {
      if (this.searchField && event?.currentTarget === this.searchField) {
        return this.searchField;
      }

      if (event?.currentTarget === this.summaryToggle) {
        return event.target?.closest?.('a.search, button.search-field__icon') || this.summaryToggle;
      }

      return (
        this.summaryToggle.querySelector('a.search, button.search-field__icon, .search-field__text') ||
        this.summaryToggle
      );
    }
  
    open(event) {
      this.menuDrawerFocusReturn = null;
      this.searchModalOpener = this.resolveSearchModalOpener(event);

      document.body.appendChild(this.modal)
      this.overlay.classList.add('open')

      if (this.searchField) {
        this.input.setAttribute('value', this.searchField.value)
        this.input.value = this.searchField.value
        trapFocus(this.modal, this.input, [], { preventScroll: true });
        this.input.addEventListener('focus', this.input.setSelectionRange(this.searchField.value.length, this.searchField.value.length))
      } else {
        trapFocus(this.modal, this.input, [], { preventScroll: true });
      }

      this.onBodyClickEvent = this.onBodyClickEvent || this.onBodyClick.bind(this);
      this.detailsContainer.setAttribute('open', true);
      document.body.addEventListener('click', this.onBodyClickEvent);
      document.body.classList.add('search-modal--open');
      document.body.classList.add('hidden');
      this.modal.classList.add('open');

      const openMenuDrawer = document.querySelector(
        '#shopify-section-menu-drawer .menu-drawer.open, #shopify-section-mega-menu-drawer .menu-drawer.open'
      );
      if (openMenuDrawer) {
        const menuDrawerRoot = openMenuDrawer.closest('menu-drawer');
        this.menuDrawerFocusReturn = menuDrawerRoot?.drawerOpener || null;
        openMenuDrawer.setAttribute('hidden', 'true');
        openMenuDrawer.classList.remove('open');
      }
    }
  
    close() {
      if (!this.modal.classList.contains('open')) return

      const returnFocusTo = this.menuDrawerFocusReturn || this.searchModalOpener;
      removeTrapFocus(returnFocusTo);

      this.detailsContainer.removeAttribute('open');
      document.body.removeEventListener('click', this.onBodyClickEvent);
      document.body.classList.remove('search-modal--open');
      document.dispatchEvent(new CustomEvent('searchmodal:close'));
      document.body.classList.remove('hidden')
      document.querySelector('.search__button-text').classList.add('hidden')
      this.modal.classList.remove('open')
      if (this.searchField) this.searchField.value = ''
      this.input.value = ''
      if (this.closest('.menu-drawer')) this.closest('.menu-drawer').setAttribute('hidden', 'true')
      document.body.removeChild(this.modal)
      this.overlay.classList.remove('open')
      this.menuDrawerFocusReturn = null;
    }
  
    reset(event) {
      event.preventDefault();
      this.querySelector('input[type="search"]').value = '';
    }
}
    
customElements.define('search-modal', SearchModal);
  
class PredictiveSearch extends HTMLElement {
    constructor() {
      super();

      this.modal = this.closest('.search-modal');
      this.cachedResults = {};
      this.input = this.querySelector('.search__input');
      this.predictiveSearchResults = this.querySelector('[data-predictive-search]');
      this.loadingSpinner = this.querySelector('.loading-overlay__spinner');
      this.abortController = new AbortController();
      this.listboxId = 'predictive-search-results-list';
      this.setupEventListeners();
    }

    linkComboboxToListbox() {
      if (!this.input || !this.predictiveSearchResults) return;
      if (!this.predictiveSearchResults.querySelector('#' + this.listboxId)) return;
      this.input.setAttribute('aria-expanded', 'true');
      this.input.setAttribute('aria-controls', this.listboxId);
      this.input.setAttribute('aria-owns', this.listboxId);
    }

    unlinkComboboxFromListbox() {
      if (!this.input) return;
      this.input.removeAttribute('aria-expanded');
      this.input.removeAttribute('aria-controls');
      this.input.removeAttribute('aria-owns');
      this.input.removeAttribute('aria-activedescendant');
    }

    syncSearchMenuLinksTabindex() {
      if (!this.modal) return;
      
      const menu = this.modal.querySelector('.search__menu');
      if (!menu) return;

      const hideLinks = this.modal.classList.contains('searching');
      menu.querySelectorAll('a[href]').forEach((link) => {
        if (hideLinks) {
          link.setAttribute('tabindex', '-1');
        } else {
          link.removeAttribute('tabindex');
        }
      });
    }

    setupEventListeners() {
      this.querySelector('form.search-modal__form').addEventListener('submit', this.onFormSubmit.bind(this));
      this.querySelector('button[type="reset"]').addEventListener('click', this.clear.bind(this));

      this.input.addEventListener('input', debounce((event) => {
        this.onChange(event);
      }, 500).bind(this));
      this.input.addEventListener('focus', this.onFocus.bind(this));
      this.modal.querySelector('.button-close').addEventListener('click', (event) => {
        this.clear(event);
        this.close(true);
      });
      document.querySelector('body > .overlay').addEventListener('click', (event) => {
        this.clear(event);
        this.close(true);
      });
      this.addEventListener('keyup', this.onKeyup.bind(this));
      this.addEventListener('keydown', this.onKeydown.bind(this));
    }

    getQuery() {
      return this.input.value.trim();
    }

    onChange() {
      const searchTerm = this.getQuery();

      if (searchTerm.length === 0) {
        this.clear();
        return;
      }

      this.getSearchResults(searchTerm);
    }

    onFormSubmit(event) {
      if (!this.getQuery().length || this.querySelector('[aria-selected="true"][role="option"] a')) event.preventDefault();
    }

    onFocus() {
      document.body.classList.add('predictive-search--focus');
      const searchTerm = this.getQuery();

      if (!searchTerm.length) return;

      if (this.getAttribute('results') === 'true') {
        this.open();
      } else {
        this.getSearchResults(searchTerm);
      }
    }

    onFocusOut() {
      setTimeout(() => {
        if (!this.contains(document.activeElement)) this.close();
      });
    }

    onKeyup(event) {
      const skipClearWhenEmpty =
        event.code === 'Tab' ||
        event.code === 'Escape' ||
        event.code === 'ArrowUp' ||
        event.code === 'ArrowDown' ||
        event.code === 'Enter';

      if (event.target === this.input && !this.getQuery().length && !skipClearWhenEmpty) {
        this.clear(event);
      }

      switch (event.code) {
        case 'ArrowUp':
          event.preventDefault();
          this.switchOption('up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.switchOption('down');
          break;
        case 'Enter':
          event.preventDefault();
          this.selectOption();
          break;
      }
    }

    onKeydown(event) {
      if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
      }
    }

    switchOption(direction) {
      if (!this.getAttribute('open')) return;

      const options = Array.from(
        this.querySelectorAll('.predictive-search-results .tab-content-js.active [role="option"]')
      );
      if (!options.length) return;

      const moveUp = direction === 'up';
      const selectedElement = options.find((el) => el.getAttribute('aria-selected') === 'true');
      const idx = selectedElement ? options.indexOf(selectedElement) : -1;

      if (moveUp && !selectedElement) return;

      let nextIndex;
      if (!moveUp) {
        nextIndex = idx < 0 ? 0 : (idx + 1) % options.length;
      } else {
        nextIndex = idx <= 0 ? options.length - 1 : idx - 1;
      }

      const activeElement = options[nextIndex];
      if (!activeElement || activeElement === selectedElement) return;

      if (this.statusElement) this.statusElement.textContent = '';

      activeElement.setAttribute('aria-selected', 'true');
      if (selectedElement) selectedElement.setAttribute('aria-selected', 'false');

      this.setLiveRegionText(activeElement.textContent);
      if (this.input && activeElement.id) {
        this.input.setAttribute('aria-activedescendant', activeElement.id);
      }
    }

    selectOption() {
      const selectedProduct = this.querySelector(
        '[aria-selected="true"][role="option"] a, [aria-selected="true"][role="option"] button'
      );

      if (selectedProduct) selectedProduct.click();
    }

    getSearchResults(searchTerm) {
      const queryKey = searchTerm.replace(' ', '-').toLowerCase();
      this.setLiveRegionLoadingState();

      if (this.cachedResults[queryKey]) {
        this.renderSearchResults(this.cachedResults[queryKey]);
        return;
      }

      fetch(`${window.routes.predictive_search_url}?q=${encodeURIComponent(searchTerm)}&${encodeURIComponent('resources[limit_scope]')}=each&section_id=predictive-search`, {
        signal: this.abortController.signal,
        })
        .then((response) => { 
          if (!response.ok) {
            var error = new Error(response.status);
            this.close();
            throw error;
          }

          return response.text();
        })
        .then((text) => {
          const resultsMarkup = new DOMParser()
            .parseFromString(text, 'text/html')
            .querySelector('#shopify-section-predictive-search').innerHTML;
          this.cachedResults[queryKey] = resultsMarkup;
          this.renderSearchResults(resultsMarkup);
        })
        .catch((error) => {
          this.close();
          throw error;
        });
    }

    setLiveRegionLoadingState() {
      this.loadingSpinner.classList.remove('hidden');
      this.statusElement = this.statusElement || this.querySelector('.predictive-search-status');
      this.loadingText = this.loadingText || this.getAttribute('data-loading-text');
      this.setLiveRegionText(this.loadingText);
      this.setAttribute('loading', true);
      this.querySelector('.search__button-text').classList.add('hidden');
    }

    setLiveRegionText(statusText) {
      this.statusElement.setAttribute('aria-hidden', 'false');
      this.statusElement.textContent = statusText;

      setTimeout(() => {
        this.statusElement.setAttribute('aria-hidden', 'true');
      }, 1000);
    }

    renderSearchResults(resultsMarkup) {
      this.predictiveSearchResults.innerHTML = resultsMarkup;
      this.setAttribute('results', true);
      this.predictiveSearchResults.classList.remove('visually-hidden');
      this.setLiveRegionResults();
      this.open();

      if (this.modal) {
        this.modal.classList.add('searching');
        this.syncSearchMenuLinksTabindex();
        const active = document.activeElement;
        trapFocus(this.modal, this.modal.contains(active) ? active : this.input);
      }
    }

    setLiveRegionResults() {
      this.loadingSpinner.classList.add('hidden');
      this.removeAttribute('loading');
      this.querySelector('.search__button-text').classList.remove('hidden');
      this.setLiveRegionText(this.querySelector('[data-predictive-search-live-region-count-value]').textContent);
    }

    open() {
      this.setAttribute('open', true);
      this.linkComboboxToListbox();
      document.body.classList.add('predictive-search--focus');
    }

    close(clearSearchTerm = false) {
      if (!clearSearchTerm) this.setLiveRegionResults();
      if (clearSearchTerm) {
        this.removeAttribute('results');
        this.input.value = '';
      }
      const selected = this.querySelector('[aria-selected="true"][role="option"]');

      if (selected) selected.setAttribute('aria-selected', false);

      this.unlinkComboboxFromListbox();
      this.removeAttribute('open');
      this.removeAttribute('results');
      this.input.value = '';
      this.predictiveSearchResults.classList.add('visually-hidden');
      document.body.classList.remove('predictive-search--focus');
      if (this.modal) {
        this.modal.classList.remove('searching');
        this.syncSearchMenuLinksTabindex();
      }
    }

    clear(event) {
      event?.preventDefault();
      this.querySelector('.search__button-text').classList.add('hidden');
      this.input.value = '';
      this.removeAttribute('open');
      this.removeAttribute('results');
      const selected = this.querySelector('[aria-selected="true"][role="option"]');
      if (selected) selected.setAttribute('aria-selected', false);
      this.unlinkComboboxFromListbox();
      this.predictiveSearchResults.classList.add('visually-hidden');
      this.input.focus();
      if (this.modal) {
        this.modal.classList.remove('searching');
        this.syncSearchMenuLinksTabindex();
      }
    }
}

customElements.define('predictive-search', PredictiveSearch);

class FacetFiltersForm extends HTMLElement {
  constructor() {
    super();

    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);
    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 500);
    this.querySelector('form').addEventListener('input', this.debouncedOnSubmit.bind(this));
  }

  static setListeners() {
    const onHistoryChange = (event) => {
      const searchParams = event.state ? event.state.searchParams : FacetFiltersForm.searchParamsInitial;
      if (searchParams === FacetFiltersForm.searchParamsPrev) return;
      FacetFiltersForm.renderPage(searchParams, null, false);
    }
    window.addEventListener('popstate', onHistoryChange);
  }

  static showDrawerResultsToastSpinner() {
    document
      .querySelectorAll('.filter-form.popup-wrapper.loading .results-toast--drawer .loading-overlay__spinner')
      .forEach((el) => el.classList.remove('hidden'));
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    let targetSection = event?.target?.closest('.shopify-section');
    if (!targetSection && event?.target?.closest('.filter-form')) {
      targetSection = document.querySelector('.collection-page-section') || document.querySelector('.main-search');
    }
    if (!targetSection) {
      targetSection = document.querySelector('.collection-page-section') || document.querySelector('.main-search');
    }
  
    FacetFiltersForm.searchParamsPrev = searchParams;
    const sections = FacetFiltersForm.getSections(targetSection);
    const facetDrawer = document.getElementById('FacetFiltersFormMobile')?.closest('.popup-wrapper');
    const mobileFacetForm = document.getElementById('FacetFiltersFormMobile')?.closest('facet-filters-form');
    const isInteractionFromMobileDrawer = !!(event?.target && mobileFacetForm?.contains(event.target));

    const countContainer = targetSection.querySelector('[id^="ProductCount--"]');
    targetSection.querySelector('[id^="ProductGridContainer--"]').querySelector('.collection').classList.add('loading');
    if (countContainer) countContainer.classList.add('loading');
    if (facetDrawer && (!event || isInteractionFromMobileDrawer)) {
      facetDrawer.classList.add('loading');
    }
    FacetFiltersForm.showDrawerResultsToastSpinner();

    sections.forEach((section) => {
      const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
      const filterDataUrl = element => element.url === url;

      FacetFiltersForm.filterData.some(filterDataUrl) ?
        FacetFiltersForm.renderSectionFromCache(filterDataUrl, event, targetSection) :
        FacetFiltersForm.renderSectionFromFetch(url, event, targetSection);
    });

    if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);

    document.dispatchEvent(new CustomEvent('page:reloaded'));
  }

  static renderSectionFromFetch(url, event, targetSection) {
    fetch(url)
      .then(response => response.text())
      .then((responseText) => {
        const html = responseText;
        FacetFiltersForm.filterData = [...FacetFiltersForm.filterData, { html, url }];
        FacetFiltersForm.renderFilters(html, event, targetSection);
        FacetFiltersForm.renderProductGridContainer(html, targetSection);
        FacetFiltersForm.renderProductCount(html, targetSection);
      })
      .catch((e) => {
        console.log(e);
        FacetFiltersForm.clearFilterFormLoading();
      });
  }

  static renderSectionFromCache(filterDataUrl, event, targetSection) {
    const html = FacetFiltersForm.filterData.find(filterDataUrl).html;
    FacetFiltersForm.renderFilters(html, event, targetSection);
    FacetFiltersForm.renderProductGridContainer(html, targetSection);
    FacetFiltersForm.renderProductCount(html, targetSection);
  }

  static renderProductGridContainer(html, targetSection) {
    targetSection.querySelector('[id^="ProductGridContainer--"]').innerHTML = new DOMParser().parseFromString(html, 'text/html').querySelector('[id^="ProductGridContainer--"]').innerHTML;
    
    const layoutSwitcher = targetSection.querySelector('#FacetFiltersForm layout-switcher');
    if (layoutSwitcher) layoutSwitcher.onButtonClick(layoutSwitcher.querySelector('.list-view__item--active'));
  }

  static clearFilterFormLoading() {
    document.querySelectorAll('.filter-form.loading').forEach((form) => {
      form.classList.remove('loading');
      form.querySelectorAll('.results-toast .loading-overlay__spinner').forEach((el) => el.classList.add('hidden'));
    });
  }

  static renderProductCount(html, targetSection) {
    const count = new DOMParser().parseFromString(html, 'text/html').querySelector('[id^="ProductCount--"]').innerHTML
    const container = targetSection.querySelector('[id^="ProductCount--"]');

    if (container) {
      container.innerHTML = count;
      container.classList.remove('loading');
    }
    FacetFiltersForm.clearFilterFormLoading();
  }

  static renderFilters(html, event, targetSection) {
    const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
    const facetDetailsElements =
      parsedHTML.querySelectorAll('#FacetFiltersForm .js-filter, #FacetFiltersFormMobile .js-filter, #FacetFiltersForm-2 .js-filter');
    const expandedFiltersIds = FacetFiltersForm.getExpandedFiltersIds();

    const matchesId = (element) => { 
      const jsFilter = event ? event.target.closest('.js-filter') : undefined;
      return jsFilter ? element.id === jsFilter.id : false; 
    }
    const facetsToRender = Array.from(facetDetailsElements).filter(element => !matchesId(element));
    const countsToRender = Array.from(facetDetailsElements).find(matchesId);

    facetsToRender.forEach((element) => {
      document.querySelector(`.js-filter[id="${element.id}"]`).innerHTML = element.innerHTML;
    });

    document.dispatchEvent(new CustomEvent('filters:rerendered'));

    FacetFiltersForm.renderActiveFacets(parsedHTML);
    FacetFiltersForm.renderAdditionalElements(parsedHTML);
    FacetFiltersForm.showDrawerResultsToastSpinner();

    if (countsToRender && event?.target) {
      const closestJSFilterID = event.target.closest('.js-filter')?.id;

      if (closestJSFilterID) {
        FacetFiltersForm.renderCounts(countsToRender, event.target.closest('.js-filter'));
        FacetFiltersForm.renderMobileCounts(countsToRender, document.querySelector(`[id="${closestJSFilterID}"]`));
      }
    }

    if (expandedFiltersIds.length > 0) {
      FacetFiltersForm.expandFilters(expandedFiltersIds);
    }
  }

  static expandFilters(expandedFiltersIds) {
    expandedFiltersIds.forEach(id => {
      const filterElement = document.getElementById(id);

      if (filterElement) {
        const showMoreBtn = filterElement.querySelector('show-more-button');
        if (showMoreBtn) showMoreBtn.toggleShowMore(showMoreBtn.querySelector('.button-show-more'), true);
      }
    });
  }

  static getExpandedFiltersIds() {
    const expandedFiltersIds = [];

    document.querySelectorAll('facet-filters-form show-more-button').forEach(btn => {
      const showMoreLabel = btn.querySelector('.label-show--more');

      if (showMoreLabel && showMoreLabel.classList.contains('hidden')) {
        const parentFilter = btn.closest('.js-filter');
        if (parentFilter) expandedFiltersIds.push(parentFilter.id);
      }
    });

    return expandedFiltersIds;
  }

  static renderActiveFacets(html) {
    const isRTL = document.documentElement.dir === 'rtl';
    const activeFacetElementSelectors = ['.active-facets-mobile', '.active-facets-desktop', '.active-facets-desktop-2', '.active-facets--result', '.active-facets--result-2', '.results-toast--horizontal', '.results-toast--vertical', '.results-toast--drawer'];
    
    activeFacetElementSelectors.forEach((selector) => {
      const activeFacetsElement = html.querySelector(selector);

      if (!activeFacetsElement) return;
      if (selector == '.active-facets-mobile') {
        if (activeFacetsElement.querySelectorAll('.stagger__item').length > 0) {
          activeFacetsElement.querySelectorAll('.stagger__item').forEach((item) => {
            item.classList.remove('stagger__item');
          });
        }
      }

      document.querySelector(selector).innerHTML = activeFacetsElement.innerHTML;
    })
    
    if(window.innerWidth > 768 && document.querySelector('.vertical-filter') || window.innerWidth > 768 && document.querySelector('.horizontal-filter')) {
      const resultsToast = document.querySelector('.results-toast--horizontal') || document.querySelector('.results-toast--vertical')
      if (!resultsToast) return

      resultsToast.style.insetInlineEnd = `50%`
      resultsToast.style.transform = isRTL ? 'translate(-50%, -24px)' : 'translate(50%, -24px)'

      setTimeout(() => {
        resultsToast.style.transform = isRTL ? 'translate(-50%, 100px)' : 'translate(50%, 100px)'
      }, 3000)
    }
  }

  static renderAdditionalElements(html) {
    const mobileElementSelectors = ['.mobile-facets__open', '.facets__open', '.sorting'];

    mobileElementSelectors.forEach((selector) => {
      if (!html.querySelector(selector)) return;
      document.querySelector(selector).innerHTML = html.querySelector(selector).innerHTML;
    });
  }

  static renderCounts(source, target) {
    const targetElement = target.querySelector('.facets__selected');
    const sourceElement = source.querySelector('.facets__selected');
    if (sourceElement && targetElement) {
      target.querySelector('.facets__selected').outerHTML = source.querySelector('.facets__selected').outerHTML;
    }
  }

  static renderMobileCounts(source, target) {
    const targetFacetsList = target.querySelector('.mobile-facets__list');
    const sourceFacetsList = source.querySelector('.mobile-facets__list');

    if (sourceFacetsList && targetFacetsList) {
      targetFacetsList.outerHTML = sourceFacetsList.outerHTML;
    }
  }

  static updateURLHash(searchParams) {
    history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
  }

  static getSections(targetSection = document) {
    return [
      {
        section: targetSection.querySelector('[id^="product-grid--"]').dataset.id,
      }
    ]
  }

  onSubmitHandler(event) {
    event.preventDefault();
    const formData = new FormData(event.target.closest('form'));
    const searchParams = new URLSearchParams(formData).toString();
    FacetFiltersForm.renderPage(searchParams, event);
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    FacetFiltersForm.renderPage(new URL(event.currentTarget.href).searchParams.toString(), event);
  }
}
FacetFiltersForm.filterData = [];
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);
customElements.define('facet-filters-form', FacetFiltersForm);
FacetFiltersForm.setListeners();

function syncFilterDrawerAccordionHeights() {
  const drawer = document.querySelector('.filter-form.popup-wrapper.open');
  if (!drawer) return;

  requestAnimationFrame(() => {
    drawer.querySelectorAll('.js-filter.is-open .accordion__panel').forEach((panel) => {
      panel.style.transitionDuration = '0s';
      const sh = panel.scrollHeight;
      if (sh > 0) {
        panel.style.setProperty('--max-height', `${sh}px`);
        panel.style.maxHeight = `${sh}px`;
      } else {
        panel.style.maxHeight = 'none';
        panel.style.removeProperty('--max-height');
      }
      setTimeout(() => {
        panel.style.transitionDuration = '0.3s';
      }, 100);
    });
  });
}

document.addEventListener('dialog:after-show', syncFilterDrawerAccordionHeights);

function onFacetsSectionLoad(event) {
  const sectionId = event.detail?.sectionId;
  if (!sectionId) return;
  const section = document.getElementById(`shopify-section-${sectionId}`);
  if (!section) return;
  const hasFacets = section.querySelector('#FacetFiltersFormMobile, #FacetFiltersForm, .filter-form, [id^="main-collection-filters"]');
  if (!hasFacets) return;

  FacetFiltersForm.filterData = [];
  FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
  FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);

  const openFacetDrawer = document.body.querySelector('.popup-wrapper.open #FacetFiltersFormMobile');
  if (openFacetDrawer) {
    const oldPopup = openFacetDrawer.closest('.popup-wrapper');
    const isMobile = window.innerWidth <= 920;
    const isStillDrawerStyle = section.querySelector('.drawer-filter');
    const keepDrawerOpen = isMobile || isStillDrawerStyle;
    if (keepDrawerOpen) {
      const newPopup = section.querySelector('#FacetFiltersFormMobile')?.closest('.popup-wrapper');
      if (oldPopup && newPopup) {
        document.body.appendChild(newPopup);
        newPopup.classList.add('open');
        oldPopup.remove();
        syncFilterDrawerAccordionHeights();
      }
    } else {
      if (oldPopup) oldPopup.remove();
      document.body.querySelector('.overlay.open')?.classList.remove('open');
      document.body.classList.remove('hidden');
    }
  }
}

document.addEventListener('shopify:section:load', onFacetsSectionLoad);

class FacetRemove extends HTMLElement {
  constructor() {
    super();

    this.querySelector('a').addEventListener('click', (event) => {
      event.preventDefault();
      const form = this.closest('facet-filters-form') || document.querySelector('facet-filters-form');
      form.onActiveFilterClick(event);
    });
  }
}
customElements.define('facet-remove', FacetRemove);
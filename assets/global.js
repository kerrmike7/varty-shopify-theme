window.theme = window.theme || {};

theme.config = {
  mqlSmall: false,
  mediaQuerySmall: 'screen and (max-width: 749px)',
  isTouch: ('ontouchstart' in window) || window.DocumentTouch && window.document instanceof DocumentTouch || window.navigator.maxTouchPoints || window.navigator.msMaxTouchPoints ? true : false,
  rtl: document.documentElement.getAttribute('dir') === 'rtl' ? true : false
};

const PUB_SUB_EVENTS = {
  cartUpdate: 'cart-update',
  quantityUpdate: 'quantity-update',
  variantChange: 'variant-change',
  cartError: 'cart-error'
};

const SECTION_REFRESH_RESOURCE_TYPE = {
  product: 'product',
};

let subscribers = {}

function subscribe(eventName, callback) {
  if (subscribers[eventName] === undefined) {
    subscribers[eventName] = []
  }

  subscribers[eventName] = [...subscribers[eventName], callback];

  return function unsubscribe() {
    subscribers[eventName] = subscribers[eventName].filter((cb) => {
      return cb !== callback
    });
  }
};

function publish(eventName, data) {
  if (subscribers[eventName]) {
    subscribers[eventName].forEach((callback) => {
      callback(data)
    })
  }
}

if (window.Shopify && window.Shopify.designMode) {
  document.documentElement.style.setProperty(
      "--scrollbar-width",
      `${window.innerWidth - document.documentElement.clientWidth}px`
  );
}

// fade-in animation on load
function nextFrame(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

function runIdle(fn, timeout = 1500) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn, { timeout });
  } else {
    setTimeout(fn, 0);
  }
}

let _fadeInDurationCache;

function getFadeInDurationInlineOnly() {
  const attr = document.documentElement.getAttribute('data-fade-in-duration');
  if (attr && attr.trim()) return attr.trim();
  return null;
}

function getFadeInDurationComputed(cb) {
  if (_fadeInDurationCache !== undefined) return cb(_fadeInDurationCache);

  nextFrame(() => {
    runIdle(() => {
      const duration = (document.documentElement.getAttribute('data-fade-in-duration') || '').trim();

      _fadeInDurationCache = duration || null;
      cb(_fadeInDurationCache);
    }, 2000);
  });
}

let _headerHeightScheduled = false;
let _lastHeaderHeightPx = null;

function updateHeaderGroupHeight() {
  const insideContent = document.querySelector('.inside-content.fade-in--content');
  if (!insideContent) return;

  const insideTop = insideContent.getBoundingClientRect().top;
  const isMobile = window.matchMedia('(max-width: 920px)').matches;

  let valuePx;

  if (isMobile) {
    const main = document.querySelector('main');
    if (!main) return;
    const mainTop = main.getBoundingClientRect().top;
    valuePx = mainTop - insideTop;
  } else {
    const header = document.querySelector('.header-group') || document.querySelector('.header-section');
    if (!header) return;

    const headerBottom = header.getBoundingClientRect().bottom;
    valuePx = headerBottom - insideTop;

    const isFadeIn = document.documentElement.classList.contains('fade-in');
    if (isFadeIn || insideContent) {
      const overlappingFirst = document.querySelector('.overlapping-section--first');
      if (overlappingFirst) {
        const announcementBar = document.querySelector('.announcement-bar-section');
        if (announcementBar) {
          valuePx = announcementBar.getBoundingClientRect().bottom;
        }
      }
    }
  }

  const px = `${Math.round(valuePx)}px`;
  if (_lastHeaderHeightPx === px) return;
  _lastHeaderHeightPx = px;

  document.documentElement.style.setProperty('--header-group-height', px);
}

function scheduleUpdateHeaderGroupHeight() {
  if (_headerHeightScheduled) return;
  _headerHeightScheduled = true;

  requestAnimationFrame(() => {
    runIdle(() => {
      _headerHeightScheduled = false;
      updateHeaderGroupHeight();
    }, 2000);
  });
}

function hideFadeInOverlayAfterDelay(durationSeconds) {
  const s = String(durationSeconds).trim();

  let durationMs = 0;
  if (s.endsWith('ms')) durationMs = parseFloat(s);
  else if (s.endsWith('s')) durationMs = parseFloat(s) * 1000;
  else durationMs = parseFloat(s) * 1000;

  if (!Number.isFinite(durationMs) || durationMs <= 0) return;

  const delay = 400;
  setTimeout(() => {
    document.body.style.setProperty('--fade-in-element-display', 'none');
  }, durationMs + delay);
}

function markOverlappingSectionInEditor_light() {
  const firstSection = document.querySelector('main .shopify-section');
  if (!firstSection) return;
  const overlapping = firstSection.querySelector('.overlapping-section');
  overlapping?.classList.add('overlapping-section--first');
}

function configurePageFadeInOnLoad_deferred() {
  const inline = getFadeInDurationInlineOnly();
  if (inline) {
    hideFadeInOverlayAfterDelay(inline);
  }

  const target = document.querySelector('.inside-content.fade-in--content');
  if (!target) {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const el = document.querySelector('.inside-content.fade-in--content');
      if (el || tries > 20) {
        clearInterval(t);
        if (el) armFadeInFor(el);
      }
    }, 250);
    return;
  }

  armFadeInFor(target);

  function armFadeInFor(el) {
    if (!('IntersectionObserver' in window)) {
      scheduleUpdateHeaderGroupHeight();
      if (!inline) getFadeInDurationComputed((d) => d && hideFadeInOverlayAfterDelay(d));
      attachResizeHandlers();
      if (Shopify.designMode) runIdle(markOverlappingSectionInEditor_light, 2000);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e || !e.isIntersecting) return;

      io.disconnect();
      scheduleUpdateHeaderGroupHeight();
      if (!inline) {
        getFadeInDurationComputed((d) => {
          if (d) hideFadeInOverlayAfterDelay(d);
        });
      }

      if (Shopify.designMode) runIdle(markOverlappingSectionInEditor_light, 2000);

      attachResizeHandlers();
    }, { root: null, rootMargin: '500px 0px', threshold: 0.01 });

    io.observe(el);
  }

  function attachResizeHandlers() {
    window.addEventListener('load', () => scheduleUpdateHeaderGroupHeight(), { once: true });
    window.addEventListener('resize', scheduleUpdateHeaderGroupHeight, { passive: true });
    window.visualViewport?.addEventListener?.('resize', scheduleUpdateHeaderGroupHeight, { passive: true });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('loaded');
  configurePageFadeInOnLoad_deferred();
});

function filterShopifyEvent(event, domElement, callback) {
  let executeCallback = false;
  if (event.type.includes('shopify:section')) {
    if (domElement.hasAttribute('data-section-id') && domElement.getAttribute('data-section-id') === event.detail.sectionId) {
      executeCallback = true;
    }
  }
  else if (event.type.includes('shopify:block') && event.target === domElement) {
    executeCallback = true;
  }
  if (executeCallback) {
    callback(event);
  }
}

function parseNode(nodeString) {
  const tempElement = document.createElement('div');
  tempElement.innerHTML = nodeString;

  return tempElement.firstElementChild;
}

// Init section function when it's visible, then disable observer
theme.initWhenVisible = function(options) {
  const threshold = options.threshold ? options.threshold : 0;

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (typeof options.callback === 'function') {
          options.callback();
          observer.unobserve(entry.target);
        }
      }
    });
  }, {rootMargin: `0px 0px ${threshold}px 0px`});

  observer.observe(options.element);
};

function getFocusableElements(container, excludedSelectors = []) {
  if (!container) return [];

  const tabindexNegative = ":not([tabindex^='-'])";
  const focusableSelector = [
    `summary${tabindexNegative}`,
    `a[href]${tabindexNegative}`,
    `button:enabled${tabindexNegative}`,
    `[tabindex]${tabindexNegative}`,
    `[draggable]${tabindexNegative}`,
    `area${tabindexNegative}`,
    `input:not([type=hidden]):enabled${tabindexNegative}`,
    `select:enabled${tabindexNegative}`,
    `textarea:enabled${tabindexNegative}`,
    `object${tabindexNegative}`,
    `iframe${tabindexNegative}`,
  ].join(', ');

  const elements = Array.from(container.querySelectorAll(focusableSelector));

  if (!excludedSelectors.length) {
    return elements;
  }

  return elements.filter((element) => {
    return !excludedSelectors.some((excludedSelector) => {
      const excludedAncestor = element.closest(excludedSelector);
      return excludedAncestor && container.contains(excludedAncestor) && container.contains(element);
    });
  });
}

class HTMLUpdateUtility {
  #preProcessCallbacks = [];
  #postProcessCallbacks = [];

  constructor() {}

  addPreProcessCallback(callback) {
    this.#preProcessCallbacks.push(callback);
  }

  addPostProcessCallback(callback) {
    this.#postProcessCallbacks.push(callback);
  }

  /**
   * Used to swap an HTML node with a new node.
   * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
   *
   * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  viewTransition(oldNode, newContent) {
    this.#preProcessCallbacks.forEach((callback) => callback(newContent));

    const newNode = oldNode.cloneNode();
    HTMLUpdateUtility.setInnerHTML(newNode, newContent.innerHTML);
    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = 'none';

    this.#postProcessCallbacks.forEach((callback) => callback(newNode));

    setTimeout(() => oldNode.remove(), 1000);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    element.querySelectorAll('script').forEach((oldScriptTag) => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}
  
document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));

  if(summary.nextElementSibling.getAttribute('id')) {
    summary.setAttribute('aria-controls', summary.nextElementSibling.id);
  }

  summary.addEventListener('click', (event) => {
    event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
  });

  if (summary.closest('header-drawer')) return;
  summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});


// Anchor links smooth scroll
(() => {
  const BREAKPOINT = 769;
  const DURATION = 1200;

  function getSetting() {
    return document.documentElement?.dataset?.anchorScroll || '';
  }

  function allowSmooth(setting) {
    if (!setting) return false;
    if (setting === 'disable') return false;

    const desktop = window.matchMedia(`(min-width: ${BREAKPOINT}px)`).matches;

    return (
      setting === 'both' ||
      (setting === 'on_desktop' && desktop) ||
      (setting === 'on_mobile' && !desktop)
    );
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function smoothScrollTo(targetY, duration) {
    const startY = window.pageYOffset;
    const distance = targetY - startY;
    const startTime = performance.now();

    function animation(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      window.scrollTo(0, startY + distance * eased);

      if (progress < 1) {
        requestAnimationFrame(animation);
      }
    }

    requestAnimationFrame(animation);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    if (a.hasAttribute('data-no-smooth')) return;

    const href = a.getAttribute('href') || '';
    if (href.length <= 1) return;

    const setting = getSetting();
    if (!allowSmooth(setting)) return;

    let target;
    try {
      target = document.querySelector(href);
    } catch (_) {
      return;
    }

    if (!target) return;

    e.preventDefault();

    const targetY = target.getBoundingClientRect().top + window.pageYOffset;

    smoothScrollTo(targetY, DURATION);
  });
})();

function simulateHoverOnTouch(elementSelector) {
  function removeActiveByTypeClass(selector) {
    document.querySelectorAll(`${selector}.active-by-tap`).forEach((activeCard) => {
      activeCard.classList.remove("active-by-tap");
    });
  }

  const bannersWithHover = document.querySelectorAll(elementSelector);

  bannersWithHover.forEach((el) => {
    el.addEventListener("click", (event) => {
      if (window.innerWidth <= 1024 || !theme.config.isTouch) return;

      const link = el.closest("a");

      if (!el.classList.contains("active-by-tap")) {
        event.preventDefault(); 

        removeActiveByTypeClass(elementSelector);
        el.classList.add("active-by-tap"); 
      } else if (link) {
        event.preventDefault();  

        link.target === "_blank" ? window.open(link.href, "_blank") : window.open(link.href, "_self");
      }      
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(elementSelector)) {
      removeActiveByTypeClass(elementSelector);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const selectorsOfElementsWithHover = [
    'a.banner__wrapper.hover-content', 
    'a.banner-gallery__card.hover-content', 
    'a.banner-grid__card.hover-content'
  ];

  selectorsOfElementsWithHover.forEach(simulateHoverOnTouch);
});

  const trapFocusHandlers = {};

  function trapFocus(container, elementToFocus, excludedSelectors = [], focusOptions = {}) {
    if (!container) return

    var elements = getFocusableElements(container, excludedSelectors);

    var first = elements[0];
    var last = elements[elements.length - 1];

    removeTrapFocus();
  
    trapFocusHandlers.focusin = (event) => {
      if (
        event.target !== container &&
        event.target !== last &&
        event.target !== first
      )
        return;
  
      document.addEventListener('keydown', trapFocusHandlers.keydown);
    };
  
    trapFocusHandlers.focusout = function() {
      document.removeEventListener('keydown', trapFocusHandlers.keydown);
    };
  
    trapFocusHandlers.keydown = function(event) {
      if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
      // On the last focusable element and tab forward, focus the first element.
      if (event.target === last && !event.shiftKey) {
        event.preventDefault();
        first.focus();
      }
  
      //  On the first focusable element and tab backward, focus the last element.
      if (
        (event.target === container || event.target === first) &&
        event.shiftKey
      ) {
        event.preventDefault();
        last.focus();
      }
    };
  
    document.addEventListener('focusout', trapFocusHandlers.focusout);
    document.addEventListener('focusin', trapFocusHandlers.focusin);
  
    const focusTarget = elementToFocus || first || container;
    focusTarget.focus(focusOptions);
  }

  focusVisiblePolyfill()
  
  // Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
  try {
    document.querySelector(":focus-visible");
  } catch(e) {
    focusVisiblePolyfill();
  }
  
  function focusVisiblePolyfill() {
    const navKeys = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'TAB', 'ENTER', 'SPACE', 'ESCAPE', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN']
    let currentFocusedElement = null;
    let mouseClick = null;
  
    window.addEventListener('keydown', (event) => {
      if(event.code && navKeys.includes(event.code.toUpperCase())) {
        mouseClick = false;
      }
    });
  
    window.addEventListener('mousedown', (event) => {
      mouseClick = true;
    });
  
    window.addEventListener('focus', () => {
      if (currentFocusedElement) currentFocusedElement.classList.remove('focused');
      if (mouseClick) return;
      currentFocusedElement = document.activeElement;
      currentFocusedElement.classList.add('focused');
  
    }, true);
  }

  function getMediaType(media) {
    if (!media) {
      return null;
    }

    const mediaType =
      media.tagName.toUpperCase() === "VIDEO"
        ? "VIDEO"
        : media.tagName.toUpperCase() === "IMG"
        ? "IMAGE"
        : media.classList.contains("js-youtube")
        ? "YOUTUBE"
        : media.classList.contains("js-vimeo")
        ? "VIMEO"
        : media.tagName.toUpperCase() === 'PRODUCT-MODEL'
        ? 'MODEL'
        : null;

    return mediaType;
  }
  
  function pauseAllMedia() {
    document.querySelector('.theme-content').querySelectorAll('.js-youtube').forEach(pauseYoutubeVideo);
    document.querySelector('.theme-content').querySelectorAll('.js-vimeo').forEach(pauseVimeoVideo);
    document.querySelector('.theme-content').querySelectorAll('video').forEach(pauseVideo);
    document.querySelector('.theme-content').querySelectorAll('product-model').forEach(pauseModel);
  }

  function handleMediaAction(media, actions, isAutoplayEnabled = false) {
    if (!media) {
      return;
    }
  
    const mediaType = getMediaType(media);
    const action = actions[mediaType];

    if (action) {
      action(media, isAutoplayEnabled);
    }
  }
  
  function pauseMedia(media, isAutoplayEnabled = false) {
    handleMediaAction(media, {
      'VIDEO': pauseVideo,
      'YOUTUBE': pauseYoutubeVideo,
      'VIMEO': pauseVimeoVideo,
      'MODEL': pauseModel
    }, isAutoplayEnabled);
  }
  
  function playMedia(media, isAutoplayEnabled = false, forcePlay = false) {
    if (!forcePlay && media && media.dataset.pausedByScript === 'false' && isAutoplayEnabled) {
      return;
    }

    handleMediaAction(media, {
      'VIDEO': playVideo,
      'YOUTUBE': playYoutubeVideo,
      'VIMEO': playVimeoVideo,
      'MODEL': playModel
    }, isAutoplayEnabled);
  }

  async function playYoutubeVideo(video, isAutoplayEnabled = false) {
    if (!video || video.tagName !== 'IFRAME') {
      console.warn('Invalid video element provided');
      return;
    }

    try {
      await loadScript('youtube');

      const youtubePlayer = await getYoutubePlayer(video);

      if (isAutoplayEnabled) {
        youtubePlayer.mute();
      }

      youtubePlayer.playVideo();
    } catch (error) {
      console.error('Error handling YouTube video play:', error);
    }
  }

  async function pauseYoutubeVideo(video, isAutoplayEnabled = false) {
    if (!video || video.tagName !== 'IFRAME') {
      console.warn('Invalid video element provided');
      return;
    }
  
    try {
      await loadScript('youtube');
  
      const youtubePlayer = await getYoutubePlayer(video);
      const playerState = youtubePlayer.getPlayerState();
  
      if (playerState === YT.PlayerState.PAUSED) {
        return; 
      }
  
      youtubePlayer.pauseVideo();
  
      if (isAutoplayEnabled) {
        video.setAttribute('data-paused-by-script', 'true');
  
        // Attach a one-time event listener for the play event
        const handleStateChange = (event) => {
          if (event.data === YT.PlayerState.PLAYING) {
            video.setAttribute('data-paused-by-script', 'false');
            youtubePlayer.removeEventListener('onStateChange', handleStateChange);
          }
        };
  
        youtubePlayer.addEventListener('onStateChange', handleStateChange);
      }
    } catch (error) {
      console.error('Error handling YouTube video pause:', error);
    }
  }
  
  function getYoutubePlayer(video) {
    return new Promise((resolve) => {
      window.YT.ready(() => {
        const existingPlayer = YT.get(video.id);

        if (existingPlayer) {
          resolve(existingPlayer);
        } else {
          const playerInstance = new YT.Player(video, {
            events: {
              onReady: (event) => resolve(event.target),
            },
          });
        }
      });
    });
  }

  function removeYoutubePlayer(videoId) {
    const existingPlayer = YT.get(videoId);

    if (existingPlayer) {
      existingPlayer.destroy(); 
    }
  }

  function playVimeoVideo(video, isAutoplayEnabled = false) {
    if (!video || video.tagName !== 'IFRAME') {
      return;
    }

    if (isAutoplayEnabled) {
      video.contentWindow?.postMessage(
        JSON.stringify({ method: 'setVolume', value: 0 }),
        '*'
      );
    }

    video.contentWindow?.postMessage('{"method":"play"}', '*');
  }

  async function pauseVimeoVideo(video, isAutoplayEnabled = false) {
    if (!video || video.tagName !== 'IFRAME') {
      return;
    }

    try {
      await loadScript('vimeo');

      const vimeoPlayer = new Vimeo.Player(video);
      const isPaused = await vimeoPlayer.getPaused();
  
      if (isPaused) {
        return; 
      }
  
      video.contentWindow?.postMessage('{"method":"pause"}', '*');
      
      if (isAutoplayEnabled) { 
        video.setAttribute('data-paused-by-script', 'true');  

        const handlePlay = () => {
          video.setAttribute('data-paused-by-script', 'false');
          vimeoPlayer.off('play', handlePlay);
        };
  
        vimeoPlayer.on('play', handlePlay);
      }
    } catch (error) {
      console.error('Error handling Vimeo video pause:', error);
    }
  }

  function playVideo(video, isAutoplayEnabled = false) {
    if (!video || !(video instanceof HTMLVideoElement)) {
      return;
    }

    if (isAutoplayEnabled) {
      video.muted = true;
    }

    video.play();
  }

  function pauseVideo(video, isAutoplayEnabled = false) {
    if (!video || !(video instanceof HTMLVideoElement)) {
      return;
    }

    if (video.paused) { 
      return;
    } 

    video.pause();
    
    if (isAutoplayEnabled) {  
      video.setAttribute('data-paused-by-script', 'true');  

      video.addEventListener('play', () => { 
        video.setAttribute('data-paused-by-script', 'false');
      }, { once: true })
    }
  }

  function playModel(model) {
    if (model.modelViewerUI) model.modelViewerUI.play();
  }

  function pauseModel(model) {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  }

  function loadScript(mediaType) {
    return new Promise((resolve, reject) => {
      let scriptId;
  
      switch (mediaType) {
        case 'youtube':
          scriptId = 'youtube-iframe-api';
          break;
        case 'vimeo':
          scriptId = 'vimeo-player-api';
          break;
        default:
          reject();
          return;
      }
  
      if (document.getElementById(scriptId)) {
        resolve();

        return;
      }
  
      const script = document.createElement('script');
      script.id = scriptId; 
      document.body.appendChild(script);
  
      script.onload = resolve;
      script.onerror = reject;
      script.async = true;
  
      switch (mediaType) {
        case 'youtube':
          script.src = 'https://www.youtube.com/iframe_api';
          break;
        case 'vimeo':
          script.src = '//player.vimeo.com/api/player.js';
          break;
        default:
          reject();
          return;
      }
    });
  }
  
  // Play or pause a video/product model if it’s visible or not
  function initViewportMediaAutoplay() {
    const root = document.querySelector('.theme-content');
    if (!root) return;
  
    const SUPPORTS_IO = 'IntersectionObserver' in window;
    const state = new WeakMap();
  
    function canAutoplayVideo(video) {
      return video && !video.closest('.none-autoplay');
    }
  
    function safePlay(video) {
      try {
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
    }
  
    function safePause(video) {
      try { video.pause(); } catch (e) {}
    }
  
    function isSlideshowVideo(video) {
      return !!(video.closest('.slideshow') || video.closest('.shoppable-media-slider'));
    }
  
    function isCurrentSlide(video) {
      return !!(video.closest('.current') || video.closest('.swiper-slide-active'));
    }
  
    function handleVideoVisibility(video, isVisible) {
      if (!canAutoplayVideo(video)) return;
  
      if (isSlideshowVideo(video) && isVisible) {
        if (isCurrentSlide(video)) safePlay(video);
        else safePause(video);
        return;
      }
  
      if (isVisible) safePlay(video);
      else safePause(video);
    }
  
    function handleModelVisibility(model, isVisible) {
      const ui = model?.modelViewerUI;
      if (!ui) return;
      try {
        isVisible ? ui.play() : ui.pause();
      } catch (e) {}
    }
  
    let io = null;
  
    function observeAll() {
      const videos = root.querySelectorAll('video');
      const models = root.querySelectorAll('product-model');
  
      if (!SUPPORTS_IO) {
        setupFallbackScroll(videos, models);
        requestAnimationFrame(() => {
          videos.forEach(v => handleVideoVisibility(v, elemInViewport(v)));
          models.forEach(m => handleModelVisibility(m, elemInViewport(m)));
        });
        return;
      }
  
      if (!io) {
        io = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            const el = entry.target;
            const was = state.get(el);
            const now = entry.isIntersecting;
  
            if (was === now) continue;
            state.set(el, now);
  
            if (el.tagName === 'VIDEO') {
              handleVideoVisibility(el, now);
            } else {
              // product-model
              handleModelVisibility(el, now);
            }
          }
        }, { rootMargin: '300px 0px', threshold: 0.01 });
      }
  
      videos.forEach(v => {
        if (!canAutoplayVideo(v)) return;
        io.observe(v);
      });
  
      models.forEach(m => io.observe(m));
    }
  
    let fallbackInited = false;
  
    function setupFallbackScroll(videos, models) {
      if (fallbackInited) return;
      fallbackInited = true;
  
      let ticking = false;
  
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
  
        requestAnimationFrame(() => {
          ticking = false;
  
          videos.forEach(v => {
            if (!canAutoplayVideo(v)) return;
            handleVideoVisibility(v, elemInViewport(v));
          });
  
          models.forEach(m => handleModelVisibility(m, elemInViewport(m)));
        });
      };
  
      document.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    }
  
    function rescan() {
      if (io) {
        try { io.disconnect(); } catch (e) {}
        io = null;
      }
      observeAll();
    }
  
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => observeAll(), { timeout: 1500 });
    } else {
      setTimeout(() => observeAll(), 0);
    }
  
    if (Shopify.designMode) {
      document.addEventListener('shopify:section:load', () => {
        rescan();
      });
    }
  }
  
  function elemInViewport(elem) {
    const box = elem.getBoundingClientRect();
    const top = box.top;
    const bottom = box.bottom;
    const height = document.documentElement.clientHeight;
    return Math.min(height, bottom) - Math.max(0, top) >= 0;
  }
  
  document.addEventListener('DOMContentLoaded', initViewportMediaAutoplay);
  
  function removeTrapFocus(elementToFocus = null, focusOptions = {}) {
    document.removeEventListener('focusin', trapFocusHandlers.focusin);
    document.removeEventListener('focusout', trapFocusHandlers.focusout);
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  
    if (elementToFocus) elementToFocus.focus(focusOptions);
  }
  
  function onKeyUpEscape(event) {
    if (event.code.toUpperCase() !== 'ESCAPE') return;
  
    const openDetailsElement = event.target.closest('details[open]');
    if (!openDetailsElement) return;
  
    const summaryElement = openDetailsElement.querySelector('summary');
    openDetailsElement.removeAttribute('open');
    summaryElement.setAttribute('aria-expanded', false);
    summaryElement.focus();
  }
  
  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  
  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
  
  function fetchConfig(type = 'json') {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': `application/${type}` }
    };
  }
  
function isStorageSupported (type) {
  // Return false if we are in an iframe without access to sessionStorage
  if (window.self !== window.top) {
    return false;
  }

  const testKey = 'avante-theme:test';
  let storage;
  if (type === 'session') {
    storage = window.sessionStorage;
  }
  if (type === 'local') {
    storage = window.localStorage;
  }

  try {
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  }
  catch (error) {
    // Do nothing, this may happen in Safari in incognito mode
    return false;
  }
}

  /*
    * Shopify Common JS
    */
  if ((typeof window.Shopify) == 'undefined') {
    window.Shopify = {};
  }
  
  Shopify.bind = function(fn, scope) {
    return function() {
      return fn.apply(scope, arguments);
    }
  };
  
  Shopify.setSelectorByValue = function(selector, value) {
    for (var i = 0, count = selector.options.length; i < count; i++) {
      var option = selector.options[i];
      if (value == option.value || value == option.innerHTML) {
        selector.selectedIndex = i;
        return i;
      }
    }
  };
  
  Shopify.addListener = function(target, eventName, callback) {
    target.addEventListener ? target.addEventListener(eventName, callback, false) : target.attachEvent('on'+eventName, callback);
  };
  
  Shopify.postLink = function(path, options) {
    options = options || {};
    var method = options['method'] || 'post';
    var params = options['parameters'] || {};
    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);
  
    for(var key in params) {
      var hiddenField = document.createElement("input");
      hiddenField.setAttribute("type", "hidden");
      hiddenField.setAttribute("name", key);
      hiddenField.setAttribute("value", params[key]);
      form.appendChild(hiddenField);
    }
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };
  
  Shopify.CountryProvinceSelector = function(country_domid, province_domid, options) {
    this.countryEl 
    this.provinceEl
    this.provinceContainer

    if(document.querySelector('#main-cart')) {
      this.shippingCalculators = document.querySelectorAll('shipping-calculator')
      this.shippingCalculators.forEach(shippingCalculator => {
        this.countryEl         = shippingCalculator.querySelector(`#${country_domid}`);
        this.provinceEl        = shippingCalculator.querySelector(`#${province_domid}`);
        this.provinceContainer = shippingCalculator.querySelector(`#${options['hideElement']}` || `#${province_domid}`);

        Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));
    
        this.initCountry();
        this.initProvince();
      })
    } else {
      this.countryEl         = document.getElementById(country_domid);
      this.provinceEl        = document.getElementById(province_domid);
      this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

      Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));

      this.initCountry();
      this.initProvince();
    }
  };

  Shopify.CountryProvinceSelector.prototype = {
    initCountry: function() {
      var value = this.countryEl.getAttribute('data-default');
      Shopify.setSelectorByValue(this.countryEl, value);
      this.countryHandler();
    },
  
    initProvince: function() {
      var value = this.provinceEl.getAttribute('data-default');
      if (value && this.provinceEl.options.length > 0) {
        Shopify.setSelectorByValue(this.provinceEl, value);
      }
    },
  
    countryHandler: function(e) {
      var opt       = this.countryEl.options[this.countryEl.selectedIndex];
      var raw       = opt.getAttribute('data-provinces');
      var provinces = JSON.parse(raw);
  
      this.clearOptions(this.provinceEl);
      if (provinces && provinces.length == 0) {
        this.provinceContainer.style.display = 'none';
      } else {
        for (var i = 0; i < provinces.length; i++) {
          var opt = document.createElement('option');
          opt.value = provinces[i][0];
          opt.innerHTML = provinces[i][1];
          this.provinceEl.appendChild(opt);
        }
        this.provinceContainer.style.display = "";
      }
    },
  
    clearOptions: function(selector) {
      while (selector.firstChild) {
        selector.removeChild(selector.firstChild);
      }
    },
  
    setOptions: function(selector, values) {
      for (var i = 0, count = values.length; i < values.length; i++) {
        var opt = document.createElement('option');
        opt.value = values[i];
        opt.innerHTML = values[i];
        selector.appendChild(opt);
      }
    }
  };

  document.addEventListener('quickview:loaded', () => {
    window.ProductModel = {
      loadShopifyXR() {
        Shopify.loadFeatures([
          {
            name: 'shopify-xr',
            version: '1.0',
            onLoad: this.setupShopifyXR.bind(this),
          },
        ]);
      },
    
      setupShopifyXR(errors) {
        if (errors) return;
    
        if (!window.ShopifyXR) {
          document.addEventListener('shopify_xr_initialized', () =>
            this.setupShopifyXR()
          );
          return;
        }
    
        document.querySelectorAll('[id^="ProductJSON-"]').forEach((modelJSON) => {
          window.ShopifyXR.addModels(JSON.parse(modelJSON.textContent));
          modelJSON.remove();
        });
        window.ShopifyXR.setupXRElements();
      },
    };
    if (window.ProductModel) {
        window.ProductModel.loadShopifyXR();
    }
  });

  class Breadcrumbs extends HTMLElement {
    constructor() {
      super();
  
      this.template = this.dataset.currentTemplate;
      if (this.template != 'product' && this.template != 'collection') return;
  
      this.cookieName = 'avante-theme:active-category';
      this.cookieUrl  = 'avante-theme:active-category-url';
  
      this.storageItem    = this.querySelector('.breadcrumbs__item--storage');
      this.metafieldItem  = this.querySelector('.breadcrumbs__item--metafield');
      this.collectionItem = this.querySelector('.breadcrumbs__item--collection');
  
      this._storageLink   = this.storageItem?.querySelector('a') || null;
      this._metafieldLink = this.metafieldItem?.querySelector('a') || null;
      this._collectionLink = this.collectionItem?.querySelector('a') || null;
  
      this.menuItems = document.querySelectorAll('.menu__list a');
  
      this.tagItems = null;
      if (this.metafieldItem && this.metafieldItem.dataset.tags) {
        this.tagItems = this.metafieldItem.dataset.tags.split(',');
      }
  
      this.setMetafieldLink();
      this.setStorageCategory();
  
      const onSectionLoad = () => {
        this.menuItems = document.querySelectorAll('.menu__list a');
        this.setMetafieldLink();
      };
  
      document.addEventListener('shopify:section-load', onSectionLoad);
      document.addEventListener('shopify:section:load', onSectionLoad);
    }
  
    setMetafieldLink() {
      if (!this._metafieldLink) return;
  
      const metafieldText = this._metafieldLink.innerHTML;
      let tagSet = null;
      if (this.tagItems && this.tagItems.length > 0) {
        tagSet = new Set(
          this.tagItems
            .map(t => (t ?? '').trim())
            .filter(Boolean)
        );
      }
  
      for (let i = 0; i < this.menuItems.length; i++) {
        const menuItem = this.menuItems[i];
        let dataTitle = menuItem?.dataset?.title;
        const dataTitleLower = dataTitle ? dataTitle.toLowerCase() : '';
  
        if (dataTitle && metafieldText == dataTitle) {
          this._metafieldLink.setAttribute('href', `${menuItem.href}`);
        }
  
        if (tagSet && dataTitle && tagSet.has(dataTitleLower)) {
          this._metafieldLink.setAttribute('href', `${menuItem.href}`);
          this._metafieldLink.innerHTML = dataTitle;
  
          setTimeout(() => {
            if (!this.collectionItem || !this._collectionLink) return;
            if (this._collectionLink.innerHTML == this._metafieldLink.innerHTML) {
              this.collectionItem.style.display = 'none';
            }
          }, 10);
        }
      }
    }
  
    setStorageCategory() {
      if (!this._storageLink) return;
  
      if (isStorageSupported('local')) {
        const activeCategory = window.localStorage.getItem(this.cookieName);
        const activeCategoryUrl = window.localStorage.getItem(this.cookieUrl);
  
        if (this.storageItem && activeCategory && activeCategoryUrl) {
          this._storageLink.setAttribute('href', `${activeCategoryUrl}`);
          this._storageLink.innerHTML = `${activeCategory}`;
  
          if (this.collectionItem && this._collectionLink && this._collectionLink.innerHTML == activeCategory) {
            this.collectionItem.style.display = 'none';
          }
        }
      }
    }
  }
  
  customElements.define('breadcrumbs-component', Breadcrumbs);

  function validateFormInput (inputElement) {
    const inputType = inputElement.getAttribute('type');
    let isValid = false;
  
    switch (inputType) {
      case 'checkbox':
        const fieldWrapper = inputElement.closest('label');
        if (fieldWrapper.dataset.group) {
          const groupWrapper = fieldWrapper.parentElement;
          const minSelection = parseInt(groupWrapper.dataset.min) > 0 ? parseInt(groupWrapper.dataset.min) : 1;
          const checkedElms = groupWrapper.querySelectorAll('input[type=checkbox]:checked');
          const errorMessage = groupWrapper.parentElement.querySelector('.input-error-message');
  
          if (checkedElms.length < minSelection) {
            isValid = false;
            if (errorMessage) errorMessage.classList.remove('visually-hidden');
            const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
            const headerOffset = parseInt(headerHeight?.replace('px', '')) || 0;
            const topOffset = errorMessage.closest('.custom-options').getBoundingClientRect().top + window.pageYOffset - headerOffset;
            window.scrollTo({ top: topOffset, behavior: 'smooth' });
  
          } else {
            isValid = true;
            if (errorMessage) errorMessage.classList.add('visually-hidden');
          }
        } else {
          isValid = inputElement.checked;
        }
  
        break;
      case 'file':
        isValid = inputElement.value !== '';
        const dropZone = inputElement.closest('.drop-zone-wrap');
        const errorMessage = dropZone.querySelector('.input-error-message');
  
        if (dropZone && !isValid) {
          dropZone.classList.add('drop-zone-wrap--error');
          if (errorMessage) {
            errorMessage.textContent = window.variantStrings.fileRequiredError;
            errorMessage.classList.remove('visually-hidden');
            const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
            const headerOffset = parseInt(headerHeight?.replace('px', '')) || 0;
            const topOffset = errorMessage.closest('.custom-options').getBoundingClientRect().top + window.pageYOffset - headerOffset;
            window.scrollTo({ top: topOffset, behavior: 'smooth' });
          }
        }
  
        break;
      default:
        isValid = inputElement.value !== '';
  
        if ( inputElement.name === 'address[country]' || inputElement.name === 'country') {
          isValid = inputElement.value !== '---';
        }
    }
  
    if (!isValid) {
      const fieldWrapper = inputElement.parentElement;
      const hasErrorMessage = fieldWrapper.querySelector('.input-error-message');
  
      if (hasErrorMessage) {
        hasErrorMessage.classList.remove('visually-hidden');
        const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
        const headerOffset = parseInt(headerHeight?.replace('px', '')) || 0;
        const topOffset = hasErrorMessage.closest('.custom-options').getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: topOffset, behavior: 'smooth' });
      }
  
      inputElement.classList.add('invalid');
      inputElement.setAttribute('aria_invalid', 'true');
      inputElement.setAttribute('aria_describedby', `${inputElement.id}-error`);
    }
  
    return isValid;
  }
  
  function removeErrorStyle (inputElem) {
    const fieldWrapper = inputElem.parentElement;
    const hasErrorMessage = fieldWrapper.querySelector('.input-error-message');
  
  
    if (hasErrorMessage) {
      hasErrorMessage.classList.add('visually-hidden');
    }
  
    inputElem.classList.remove('invalid');
    inputElem.removeAttribute('aria_invalid');
    inputElem.removeAttribute('aria_describedby');
  }

  class LocalizationForm extends HTMLElement {
    constructor() {
      super();
  
      this._mounted = false;
  
      this._onButtonClick = this.openSelector.bind(this);
      this._onKeyUp = this.onContainerKeyUp.bind(this);
      this._onFocusOut = this.closeSelector.bind(this);
      this._onDocScroll = this.hidePanel.bind(this);
      this._onClickDelegated = this._onClickDelegated.bind(this);
      this._onSectionScroll = this.hidePanel.bind(this);
      this._onDocumentClick = this.onDocumentClick.bind(this);
  
      this._alignPanelSoon = () => this.alignPanel();
  
      this.elements = null;
      this._sectionScrollEl = null;
    }
  
    connectedCallback() {
      if (this._mounted) return;
      this._mounted = true;
  
      this.elements = {
        input: this.querySelector('input[name="locale_code"], input[name="country_code"]'),
        inputLanguage: this.querySelector('input[name="locale_code"]'),
        button: this.querySelector('button'),
        panel: this.querySelector('.disclosure__list-wrapper'),
      };
  
      if (!this.elements.button || !this.elements.panel || !this.elements.input) return;
  
      this.elements.button.addEventListener('click', this._onButtonClick);
      this.addEventListener('keyup', this._onKeyUp);
      this.addEventListener('focusout', this._onFocusOut);
      this.addEventListener('click', this._onClickDelegated);
  
      document.addEventListener('click', this._onDocumentClick);
      document.addEventListener('scroll', this._onDocScroll, { passive: true });
  
      const section = this.elements.button.closest('.shopify-section');
      this._sectionScrollEl = section?.querySelector('div') || null;
      if (this._sectionScrollEl) {
        this._sectionScrollEl.addEventListener('scroll', this._onSectionScroll, { passive: true });
      }
    }
  
    disconnectedCallback() {
      this._mounted = false;
  
      if (!this.elements?.button) return;
  
      this.elements.button.removeEventListener('click', this._onButtonClick);
      this.removeEventListener('keyup', this._onKeyUp);
      this.removeEventListener('focusout', this._onFocusOut);
      this.removeEventListener('click', this._onClickDelegated);
  
      document.removeEventListener('click', this._onDocumentClick);
      document.removeEventListener('scroll', this._onDocScroll);
  
      if (this._sectionScrollEl) {
        this._sectionScrollEl.removeEventListener('scroll', this._onSectionScroll);
        this._sectionScrollEl = null;
      }
    }
  
    _onClickDelegated(event) {
      const link = event.target.closest('a');
      if (!link || !this.contains(link)) return;
      this.onItemClick(event, link);
    }
  
    alignPanel() {
      const isRTL = document.documentElement.dir === 'rtl';
  
      this.elements.panel.style.insetInlineEnd = 'auto';
  
      const buttonRect = this.elements.button.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
  
      this.elements.panel.style.top = buttonRect.bottom + 'px';
  
      const panelRect = this.elements.panel.getBoundingClientRect();
      const elementOverflowsViewport = isRTL
        ? panelRect.left - 16 < 0
        : panelRect.right + 16 > viewportWidth;
  
      if (panelRect.bottom > viewportHeight) {
        this.elements.panel.style.top = buttonRect.top - this.elements.panel.offsetHeight + 'px';
      }
  
      if (elementOverflowsViewport) {
        this.elements.panel.style.insetInlineEnd = '16px';
      }
    }
  
    hidePanel() {
      if (this.elements.panel.hasAttribute('hidden')) return;
      this.elements.button.setAttribute('aria-expanded', 'false');
      this.elements.panel.setAttribute('hidden', true);
      this.elements.button
        .querySelectorAll('.disclosure__button-icon')
        .forEach((item) => item.classList.remove('open'));
    }
  
    onContainerKeyUp(event) {
      if (event.code.toUpperCase() !== 'ESCAPE') return;
      this.hidePanel();
      this.elements.button.focus();
    }
  
    onItemClick(event, linkEl) {
      event.preventDefault();
      const value = linkEl.dataset.value;
      if (!value) return;
  
      const form = this.querySelector('form');
      this.elements.input.value = value;
      if (form) form.submit();
    }
  
    openSelector() {
      this.elements.button.focus();
      this.elements.panel.toggleAttribute('hidden');
  
      const isExpanded = !this.elements.panel.hasAttribute('hidden');
      this.elements.button
        .querySelectorAll('.disclosure__button-icon')
        .forEach((item) => item.classList.toggle('open', isExpanded));
  
      this.elements.button.setAttribute('aria-expanded', isExpanded.toString());
  
      if (isExpanded) {
        setTimeout(this._alignPanelSoon, 20);
      }
    }
  
    closeSelector(event) {
      if (event.relatedTarget && !this.contains(event.relatedTarget)) {
        this.hidePanel();
      }
    }
  
    onDocumentClick(event) {
      if (this.elements.panel.hasAttribute('hidden')) return;
      if (this.contains(event.target)) return;
      this.hidePanel();
    }
  }
  customElements.define('localization-form', LocalizationForm);


  class MenuDropdown extends HTMLElement {
    constructor() {
      super();
    
      this._inited = false;
      this._initScheduled = false;
      this._onKeyup = this._onKeyup?.bind ? this._onKeyup.bind(this) : null;
      this._slideoutScrollHandler = null;
    }

    connectedCallback() {
      if (this._armed) return;
      this._armed = true;
    
      this._firstIntent = (e) => {
        this._disarmFirstIntent();
        this.deferInit();
      };
    
      this._preHover = (e) => {
        const item = e.target?.closest?.('.menu__item-title--first-level.menu__item-title--header');
        if (!item) return;
    
        this._disarmFirstIntent();
        this.deferInit();
    
        const openWhenReady = () => {
          if (!this._inited) {
            requestAnimationFrame(openWhenReady);
            return;
          }
    
          const stillHovering = item.matches(':hover') || !!item.querySelector(':hover');
          if (!stillHovering) return;
    
          this.openHeaderMenu(e, item);
    
          if (this._preHover) {
            this.removeEventListener('pointerover', this._preHover);
            this._preHover = null;
          }
        };
    
        requestAnimationFrame(openWhenReady);
      };
    
      this.addEventListener('pointerover', this._preHover, { passive: true });
      this.addEventListener('pointerenter', this._firstIntent, { once: true, passive: true });
      this.addEventListener('pointerdown',  this._firstIntent, { once: true, passive: true });
      this.addEventListener('focusin',      this._firstIntent, { once: true, passive: true });
    }
    
    _disarmFirstIntent() {
      if (!this._firstIntent) return;
      this.removeEventListener('pointerenter', this._firstIntent);
      this.removeEventListener('pointerdown',  this._firstIntent);
      this.removeEventListener('focusin',      this._firstIntent);
    }

    disconnectedCallback() {
      if (this._armed) {
        this._armed = false;
        this._disarmFirstIntent();
        this._firstIntent = null;
      }

      this.detachSlideoutScroll();
    
      if (this.overlapScrollHandler) {
        window.removeEventListener('scroll', this.overlapScrollHandler);
        this.overlapScrollHandler = null;
      }
    
      if (this._outsideMainSidebarHandler) {
        document.removeEventListener('pointerdown', this._outsideMainSidebarHandler, { capture: true });
        this._outsideMainSidebarHandler = null;
      }

      if (this._outsideClickHandler) {
        document.removeEventListener('click', this._outsideClickHandler, { capture: true });
        this._outsideClickHandler = null;
      }

      if (this._preHover) {
        this.removeEventListener('pointerover', this._preHover);
        this._preHover = null;
      }
    
      this.disableGlobalOutsideClose();
    }

    deferInit() {
      if (this._inited || this._initScheduled) return;
      this._initScheduled = true;
    
      const run = () => {
        this._initScheduled = false;
        this.init();
      };

      setTimeout(() => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(run, { timeout: 1500 });
        } else {
          setTimeout(run, 0);
        }
      }, 0);
    }

    init() {
      if (this._inited) return;
      this._inited = true;
    
      this.elements = {
        firstLevelLinkHeader: this.querySelectorAll('.menu__item-title--header'),
        dropdownFirstLevelLink: this.querySelectorAll('.menu__item-title--simple_slide_out'),
        firstLevelCollapsibleButton: this.querySelectorAll('.menu__item-title--collapsible .dropdown-icon--first-level'),
        secondLevelButton: this.querySelectorAll('.dropdown-icon--second-level'),
        secondLevelLink: this.querySelectorAll('.menu__item-title--second-level'),
        headerDropdownChild: this.querySelectorAll('.menu__item-title--header ~ .menu__dropdown-container'),
        sidebarDropdownChild: this.querySelectorAll('.menu__item-title--simple_slide_out ~ .menu__dropdown-container'),
        sidebarDivider: this.querySelectorAll('.menu__item-title--slide_out ~ .menu-divider'),
        dropdownChildList: this.querySelectorAll('.menu__dropdown-child'),
        navContainer: this.querySelectorAll('.menu__navigation'),
        links: this.querySelectorAll('.menu__list a'),
        secondarySidebar: document.querySelector('.secondary-sidebar-section'),
        overlapFirstLevelLink: this.querySelectorAll('.menu__item-title--overlap_slide_out_first-item'),
        overlapGrandchildContainers: this.querySelectorAll('.menu__dropdown-grandchild-container--overlap_slide_out'),
        sidebarOverlapDropdownChild: this.querySelectorAll('.menu__item-title--overlap_slide_out_first-item ~ .menu__dropdown-container'),
        mainSidebarList: this.querySelector('.menu__list--main-sidebar')
      };
      this.zTimers = new WeakMap();
      this._reopenBlock = new WeakMap();
      this.sidebarWidth = 0
      if (this.elements.secondarySidebar) this.sidebarWidth = this.elements.secondarySidebar.offsetWidth
  
      /* Script for Header menu */
      this.elements.firstLevelLinkHeader.forEach(item => item.addEventListener('mouseenter', (event) => {
        this.openHeaderMenu(event, item)
      }))

      this.elements.firstLevelLinkHeader.forEach(headerItem => {
        const icon = headerItem.querySelector('.dropdown-icon--first-level');
        if (!icon) return;

        icon.addEventListener('keyup', (event) => {
          if (event.code.toUpperCase() !== 'ENTER') return;

          if (!headerItem.classList.contains('open')) {
            this.openHeaderMenu(event, headerItem);
          } else {
            this.elements.headerDropdownChild.forEach(item => item.classList.remove('open'));
            this.elements.firstLevelLinkHeader.forEach(item => item.classList.remove('open'));
            this.closeSecondDropdown(headerItem);
          }
        });

        icon.addEventListener('focusout', (event) => {
          const nextFocused = event.relatedTarget;
          const dropdown = headerItem.nextElementSibling;

          const stillInside =
            nextFocused &&
            (
              icon.contains(nextFocused) ||               
              (dropdown && dropdown.contains(nextFocused)) 
            );

          if (stillInside) return;

          this.closeDropdownMenu(dropdown);
        });
      });
  
      this.elements.firstLevelLinkHeader.forEach(item => item.addEventListener('mouseleave', (event) => {
        if (event.relatedTarget && !event.relatedTarget.closest('.menu__dropdown-container') && !event.relatedTarget.closest('.menu__item')) {
          this.closeDropdownMenu(item);
        }
      }))
  
      this.elements.headerDropdownChild.forEach(item => item.addEventListener('mouseleave', (event) => {
        if (item.classList.contains('mega-menu') && item.classList.contains('mega-menu--wide') && item.closest('.header').offsetWidth > 1024) item.removeAttribute('style')
        if (event.relatedTarget != item.previousElementSibling && !Array.from(item.previousElementSibling.children).includes(event.relatedTarget)) {
          this.elements.firstLevelLinkHeader.forEach(item => item.classList.remove('open'))
          this.closeSecondDropdown(item)
        }
      }))

      this.elements.headerDropdownChild.forEach(dropdown => {
        dropdown.addEventListener('focusout', (event) => {
          const nextFocused = event.relatedTarget;
          const trigger = dropdown.previousElementSibling; 

          const stillInside =
            nextFocused &&
            (
              dropdown.contains(nextFocused) ||
              (trigger && (trigger === nextFocused || trigger.contains(nextFocused)))
            );

          if (stillInside) return;

          this.closeDropdownMenu(dropdown);
        });
      });

      /*Script for Collapsible menu type in Main sidebar and Menu in Menu Drawer section */
      this.elements.firstLevelCollapsibleButton.forEach(item => item.addEventListener('click', () => {
        this.toggleCollapsibleMenu(item)
      }))
  
      this.elements.firstLevelCollapsibleButton.forEach(item => item.addEventListener('keyup', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          this.toggleCollapsibleMenu(item)
        }
      }))

      /* Script for Second level (collapsible children) */
      this.elements.secondLevelButton.forEach(item => item.addEventListener('click', () => {
        this.toggleSecondLevelMenu(item);
      }));
      this.elements.secondLevelButton.forEach(item => item.addEventListener('keyup', (event) => {
        if (event.code.toUpperCase() === 'ENTER') this.toggleSecondLevelMenu(item);
      }));

      /* Script for Slide out menu type in Main Sidebar (simple_slide_out) */
      if (window.theme?.config?.isTouch && this.elements.dropdownFirstLevelLink.length > 0) {
        const ms = this.closest('.main-sidebar');
        if (ms) ms.style.position = 'absolute';
        const list = this.querySelector('.menu__list--main-sidebar');
        if (list) list.style.width = 'calc(100% + 6px)';
      }

      this.elements.dropdownFirstLevelLink.forEach(item => item.addEventListener('mouseenter', () => {
        this.openSlideOutMenu(item);
      }));

      this.elements.dropdownFirstLevelLink.forEach(item => {
        const icon = item.querySelector('.dropdown-icon--first-level');
        if (!icon) return;

        icon.addEventListener('keyup', (event) => {
          if (event.code.toUpperCase() === 'ENTER') {
            if (!item.classList.contains('open')) this.openSlideOutMenu(item);
            else {
              this.elements.dropdownFirstLevelLink.forEach(i => i.classList.remove('open'));
            }
          }
        });
      });

      this.elements.dropdownFirstLevelLink.forEach(item => item.addEventListener('mouseleave', (event) => {
        const rt = event.relatedTarget;
        if (!rt) return;

        if (
          item.classList.contains('open') &&
          !rt.classList.contains('menu-divider') &&
          !rt.classList.contains('menu__dropdown-container') &&
          !Array.from(item.nextElementSibling?.children || []).includes(rt) &&
          !rt.classList.contains('menu__dropdown-child-item-link') &&
          rt !== item.closest('.menu-container')
        ) {
          this.elements.dropdownFirstLevelLink.forEach(i => {
            i.classList.remove('open');
            const section = i.closest('.main-sidebar-section');
            if (section) section.style.zIndex = 20;
          });
        }
      }));

      this.elements.sidebarDropdownChild.forEach(panel => panel.addEventListener('mouseleave', (event) => {
        const rt = event.relatedTarget;
        if (!rt) return;

        if (
          rt !== panel.previousElementSibling &&
          !Array.from(panel.previousElementSibling?.children || []).includes(rt) &&
          !rt.closest('.menu-divider')
        ) {
          this.elements.dropdownFirstLevelLink.forEach(i => {
            i.classList.remove('open');
            const section = i.closest('.main-sidebar-section');
            if (section) section.style.zIndex = 20;
          });
        }
      }));

      document.addEventListener('touchend', (event) => {
        this.elements.dropdownFirstLevelLink.forEach(item => {
          if (item.classList.contains('open') && window.theme?.config?.isTouch) {
            if (
              event.target !== item &&
              !event.target.closest('.menu__dropdown-container') &&
              !event.target.closest('.menu-divider')
            ) {
              this.elements.dropdownFirstLevelLink.forEach(i => {
                i.classList.remove('open');
                const section = i.closest('.main-sidebar-section');
                if (section) section.style.zIndex = 20;
              });
            }
          }
        });
      });

      /* Close parent containers on real link click */
      this.elements.links.forEach(link => {
        link.addEventListener('click', () => {
          if (link.getAttribute('href') === '#') return;
          this.closeParentContainers(link);
        });
      });
  
      this.hoverDelay = 320;   
      this.OVER_Z_DELAY = 800
      this.overlapTrigger = (this.getAttribute('data-overlap-trigger') || 'hover').toLowerCase();

      if (this.overlapTrigger === 'click') {
        this.initOverlapClick();
      } else {
        this.initOverlapHover();
      }
    }

    ensureNoAnimStyle() {
      if (document.getElementById('menu-dropdown-no-anim-style')) return;
      const style = document.createElement('style');
      style.id = 'menu-dropdown-no-anim-style';
      style.textContent = `
        .md-no-anim, .md-no-anim * {
          transition: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    withNoAnim(el, fn) {
      if (!el) { fn(); return; }
      const prevTransition = el.style.transition;
      el.style.transition = 'none';
      fn();
      // eslint-disable-next-line no-unused-expressions
      el.offsetWidth;
      requestAnimationFrame(() => {
        el.style.transition = prevTransition;
      });
    }

    detachSlideoutScroll() {
      if (!this._slideoutScrollHandler) return;
      window.removeEventListener('scroll', this._slideoutScrollHandler);
      this._slideoutScrollHandler = null;
    }

    initOverlapHover() {
      this.elements.overlapFirstLevelLink.forEach(first => {
        first.addEventListener('mouseenter', () => {
          this.elements.overlapFirstLevelLink.forEach(o => {
            if (o !== first && o.classList.contains('open')) this.closeFirst(o);
          });
          this.openOverlapSlideOutMenu(first);
          this.cancelCloseFirst(first);
        });

        first.addEventListener('mouseleave', (e) => {
          const second = first.nextElementSibling;
          const r = e.relatedTarget;

          const intoSecond = !!(r && second && second.contains(r));
          const intoDivider = !!(r && r.classList && r.classList.contains('menu-divider'));
          const stayingOnFirst = !!(r && first.contains(r));
          const intoThird     = !!(r && r.closest('.menu__dropdown-grandchild-container--overlap_slide_out'));

          if (intoSecond || intoDivider || stayingOnFirst || intoThird) {
            this.cancelCloseFirst(first);
            return;
          }
        
          const intoAnyFirst = !!(r && r.closest('.menu__item-title--overlap_slide_out_first'));
          if (intoAnyFirst && !first.contains(r)) {
            this.closeFirst(first);
            return;
          }
        
          this.closeFirst(first);
        });
      });

      this.elements.sidebarOverlapDropdownChild.forEach(second => {
        second.addEventListener('mouseenter', () => {
          const trigger = second.previousElementSibling;
          if (trigger) this.cancelCloseFirst(trigger);
        });

        second.addEventListener('mouseleave', (e) => {
          const trigger = second.previousElementSibling;
          const r = e.relatedTarget;
        
          const backToTrigger = !!(r && r === trigger);
          const intoAnyFirst  = !!(r && r.closest('.menu__item-title--overlap_slide_out_first'));
          const intoOtherFirst = intoAnyFirst && r !== trigger;
          const intoThird = !!(r && r.closest('.menu__dropdown-grandchild-container--overlap_slide_out'));
          const intoDivider = !!(r && r.classList && r.classList.contains('menu-divider'));
          const stillInSecond = !!(r && (r === second || second.contains(r) || r.closest('.menu__dropdown-container') === second));
        
          if (backToTrigger || intoThird || intoDivider || stillInSecond) {
            if (trigger) this.cancelCloseFirst(trigger);
            return;
          }
        
          if (intoOtherFirst || intoAnyFirst) {
            if (trigger) this.closeFirst(trigger);
            return;
          }
        
          if (trigger) this.closeFirst(trigger);
        });
        second.addEventListener('mousemove', (e) => {
          const overThird = e.target.closest('.menu__dropdown-grandchild-container--overlap_slide_out');
          const overThirdTrigger = e.target.closest('.menu__item-title--overlap_slide_out_second');
          if (!overThird && !overThirdTrigger) {
            this.closeAllGrandchildren(second);
          }
        });
      });

      const thirdTriggers = this.querySelectorAll('.menu__dropdown-child .menu__item-title--overlap_slide_out_second');
      thirdTriggers.forEach(t => {
        t.addEventListener('mouseenter', () => this.openThirdNoTransitionOnSwitch(t));
        t.addEventListener('mouseleave', (e) => {
          const trigger = t.previousElementSibling;
          const r = e.relatedTarget;
          const backToTrigger = !!(r && r === trigger);
          const intoSecond    = !!(r && r.closest('.menu__dropdown-container--overlap_slide_out'));
          const intoFirst     = !!(r && r.closest('.menu__item-title--overlap_slide_out_first'));
          const intoThird     = !!(r && r.closest('.menu__dropdown-grandchild-container--overlap_slide_out'));

          if (backToTrigger || intoSecond || intoFirst || intoThird) {
            this.cancelCloseFirst(trigger);
            return;
          }

          if (trigger) this.closeFirst(trigger);
        });

        const thirdContainer = t.nextElementSibling;
        if (thirdContainer) {
          thirdContainer.addEventListener('mouseleave', (e) => {
            const r = e.relatedTarget;
            const backToOwnTrigger = !!(r && r === t);
            const stillInThird = !!(r && thirdContainer.contains(r));
            if (!backToOwnTrigger && !stillInThird) this.closeGrandchild(t);
          });
        }
      });
    }
    openThirdNoTransitionOnSwitch(secondTrigger) {
      const secondWrap  = secondTrigger.closest('.menu__dropdown-container');
      const thirdToOpen = secondTrigger.nextElementSibling;
      if (!secondWrap) return;

      const hasThird = !!(thirdToOpen && thirdToOpen.matches('.menu__dropdown-grandchild-container'));

      if (!hasThird) {
        this.closeOpenGrandchildInSameSecond(secondTrigger, /* animated = */ false);
        return;
      }

      const anyOpen = secondWrap.querySelector('.menu__dropdown-grandchild-container.open, .menu__dropdown-grandchild-container.opened');

      if (!anyOpen) {
        this.closeOpenGrandchildInSameSecond(secondTrigger, /* animated = */ true);
        this.openOverlapSlideOutGrandchildMenu(secondTrigger, { animated: true, seamless: false });
        return;
      }

      this.closeOpenGrandchildInSameSecond(secondTrigger, /* animated = */ false);
      this.openOverlapSlideOutGrandchildMenu(secondTrigger, { animated: false, seamless: true });
    }
    initOverlapClick() {
      this.elements.overlapFirstLevelLink.forEach(first => {
        const hasSecond = !!(first.nextElementSibling && first.nextElementSibling.matches('.menu__dropdown-container'));
        const firstAnchor = first.querySelector('a');
        if (hasSecond && firstAnchor) {
          firstAnchor.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleFirstByClick(first);
          });
        }
        first.addEventListener('keyup', (e) => {
          if (e.code === 'Enter' || e.code === 'Space') {
            const hasSecond = !!(first.nextElementSibling && first.nextElementSibling.matches('.menu__dropdown-container'));
            if (hasSecond) {
              e.preventDefault();
              this.toggleFirstByClick(first);
            }
          }
        });
      });
    
      const secondTriggers = this.querySelectorAll('.menu__item-title--overlap_slide_out_second');
      secondTriggers.forEach(t => {
        const third = t.nextElementSibling;
        const hasThird = !!(third && third.matches('.menu__dropdown-grandchild-container'));
        const link = t.querySelector('a.menu__dropdown-child-item-link');
        if (hasThird && link) {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleThirdByClick(t);
          });
        }
        t.addEventListener('keyup', (e) => {
          if (e.code === 'Enter' || e.code === 'Space') {
            const hasThird = !!(t.nextElementSibling && t.nextElementSibling.matches('.menu__dropdown-grandchild-container'));
            if (hasThird) {
              e.preventDefault();
              this.toggleThirdByClick(t);
            }
          }
        });
      });
    
      this._outsideMainSidebarHandler = (e) => {
        const ms = document.querySelector('.main-sidebar');
        if (!ms) return;
      
        const isInside = ms.contains(e.target);
        if (!isInside) {
          this.closeAllReally();
        }
      };
      
      document.addEventListener('pointerdown', this._outsideMainSidebarHandler, { capture: true });
    }

    toggleFirstByClick(first) {
      const alreadyOpen = first.classList.contains('open') || first.classList.contains('opened');

      this.elements.overlapFirstLevelLink.forEach(o => {
        if (o !== first && (o.classList.contains('open') || o.classList.contains('opened'))) {
          this.closeFirst(o);
        }
      });

      if (alreadyOpen) {
        this.blockReopen(first);
        this.closeFirst(first);
        return;
      }

      if (this.isReopenBlocked(first)) return;

      this.openOverlapSlideOutMenu(first);
    }
    
    toggleThirdByClick(secondTrigger) {
      const third = secondTrigger.nextElementSibling;
      if (!third) return;
    
      const isOpen = third.classList.contains('open');
      if (isOpen) {
        this.closeGrandchild(secondTrigger);
      } else {
       this.openThirdNoTransitionOnSwitch(secondTrigger)
      }
    }

    enableGlobalOutsideClose(currentFirst) {
      if (this.overlapTrigger === 'click') return;
      this.globalOutsideHandler = (e) => {
        const t = e.target;
        const insideFirst  = !!(t && t.closest('.menu__item-title--overlap_slide_out_first'));
        const insideSecond = !!(t && (t.closest('.menu__dropdown-container') || t.closest('.menu-divider')));
        const insideThird  = !!(t && t.closest('.menu__dropdown-grandchild-container--overlap_slide_out'));
    
        if (!insideFirst && !insideSecond && !insideThird) {
          this.closeFirst(currentFirst);
        }
      };
    
      document.addEventListener('mousemove', this.globalOutsideHandler, { passive: true });
    
      this.globalWindowLeaveHandler = () => {
        this.closeFirst(currentFirst);
      };
      window.addEventListener('blur', this.globalWindowLeaveHandler);
      document.addEventListener('mouseleave', this.globalWindowLeaveHandler);
    }

    closeAllGrandchildren(secondWrapper) {
      if (!secondWrapper) return;
      secondWrapper.querySelectorAll('.menu__dropdown-grandchild-container.open').forEach(gc => {
        const trigger = gc.previousElementSibling;
        if (trigger) trigger.classList.remove('open');
        gc.classList.remove('open', 'change-index');
    
        const t = this.zTimers.get(gc);
        if (t) { clearTimeout(t); this.zTimers.delete(gc); }
    
        this.setTabindex(gc, false);
      });
      this.elements.mainSidebarList?.classList.remove('is-open-second', 'is-open-first')
    }
    
    disableGlobalOutsideClose() {
      if (this.globalOutsideHandler) {
        document.removeEventListener('mousemove', this.globalOutsideHandler);
        this.globalOutsideHandler = null;
      }
      if (this.globalWindowLeaveHandler) {
        window.removeEventListener('blur', this.globalWindowLeaveHandler);
        document.removeEventListener('mouseleave', this.globalWindowLeaveHandler);
        this.globalWindowLeaveHandler = null;
      }
    }

    cancelCloseFirst(trigger) {
      if (!this.closeFirstTimers) return;
      const t = this.closeFirstTimers.get(trigger);
      if (t) {
        clearTimeout(t);
        this.closeFirstTimers.delete(trigger);
      }
    }

    isRTL() {
      return document.documentElement.dir === 'rtl' || getComputedStyle(document.documentElement).direction === 'rtl';
    }
  
    openHeaderMenu(event, item) {
      if (event.target.closest('.menu__item-title--first-level.menu__item-title--header')) item.classList.add('open') 
      this.elements.headerDropdownChild.forEach(itemContainer => {
        if (itemContainer.classList.contains('mega-menu') && itemContainer.classList.contains('mega-menu--wide') && itemContainer.closest('.header').offsetWidth > 1024) {
          itemContainer.style.left = - item.getBoundingClientRect().left + itemContainer.closest('.header').getBoundingClientRect().left + 24 + 'px'
          itemContainer.style.width = itemContainer.closest('.header').offsetWidth - 48 + 'px' 
        } else if (itemContainer.classList.contains('mega-menu') && itemContainer.classList.contains('mega-menu--wide') && itemContainer.closest('.header').offsetWidth <= 1024) {
          requestAnimationFrame(() => this.alignDropdown());
        } else if (!itemContainer.classList.contains('mega-menu') || itemContainer.classList.contains('mega-menu') && itemContainer.classList.contains('mega-menu--narrow')) {
          requestAnimationFrame(() => this.alignDropdown());
        }
      })
      if (item.classList.contains('menu__item-title--slide_out')) {
        this.itemCoordinate = item.getBoundingClientRect()   
        this.elements.dropdownChildList.forEach(el => el.style.top = +this.itemCoordinate.top + 'px')
        this.elements.navContainer.forEach(item => {
          this.containerCoordinate = item.getBoundingClientRect()
          this.elements.dropdownChildList.forEach(element => element.style.top = -this.containerCoordinate.top + 'px')
        })
      }
      if (item.classList.contains('open')) {
        if (item.nextElementSibling) item.nextElementSibling.querySelectorAll('.menu__dropdown-child-item-link').forEach(link => link.setAttribute('tabindex', '0'))
      } else {
        if (item.nextElementSibling) item.nextElementSibling.querySelectorAll('.menu__dropdown-child-item-link').forEach(link => link.setAttribute('tabindex', '-1'))
      }  
    }
  
    openSlideOutMenu(item) {
      if (!item.nextElementSibling) return
      item.closest('.main-sidebar-section').style.zIndex = 21
      item.nextElementSibling.style.insetInlineStart = item.closest('.menu__item').offsetWidth - 4 + 'px'
      item.parentElement.querySelector('.menu-divider').style.insetInlineStart = item.closest('.main-sidebar').offsetWidth + 'px'     
      this.itemCoordinate = item.getBoundingClientRect()
      let topMainSidebar = this.closest('.main-sidebar').getBoundingClientRect().top
      this.elements.sidebarDropdownChild.forEach(el => {
        el.style.top = topMainSidebar + 'px'
        el.style.setProperty('--top', `${topMainSidebar}px`);
      })
      this.elements.sidebarDivider.forEach(el => el.style.top = topMainSidebar + 'px')
      if (!this._slideoutScrollHandler) {
        this._slideoutScrollHandler = () => {
          const topMainSidebar = this.closest('.main-sidebar').getBoundingClientRect().top;
      
          this.elements.sidebarDropdownChild.forEach(el => {
            el.style.top = topMainSidebar + 'px';
            el.style.setProperty('--top', `${topMainSidebar}px`);
          });
      
          this.elements.sidebarDivider.forEach(el => el.style.top = topMainSidebar + 'px');
        };
      }
      window.addEventListener('scroll', this._slideoutScrollHandler, { passive: true });
      this._slideoutScrollHandler();
      this.elements.dropdownChildList.forEach(el => el.style.top = +this.itemCoordinate.top - topMainSidebar + 'px')
      let scrollBarWidth = window.innerWidth - document.body.clientWidth
      this.dropdownWidth = item.closest('.main-sidebar').offsetWidth
      item.nextElementSibling.style.width = this.dropdownWidth + scrollBarWidth + 'px'
      item.classList.add('open')
      if (item.classList.contains('open')) {
        item.nextElementSibling.querySelectorAll('.menu__dropdown-child-item-link').forEach(link => link.setAttribute('tabindex', '0'))
      } else {
        panel.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'))
      }
      if (!item.closest('.menu__item-title--collapsible')?.classList.contains('open')) {
        let parentItem = item.closest('.menu__item')
        parentItem.querySelector('.menu__item-title--second-level').classList.remove('open')
        if(parentItem.querySelector('.menu__dropdown-grandchild-container')) parentItem.querySelector('.menu__dropdown-grandchild-container').style.maxHeight = ''
      }
      document.dispatchEvent(new CustomEvent('collapsible-menu:opened'));
  }

    handleScrollUpdate (second, divider) {
      let topMainSidebar = this.closest('.main-sidebar').getBoundingClientRect().top;
    
      second.style.top = topMainSidebar + 'px';
      second.style.setProperty('--top', `${topMainSidebar}px`);
  
      this.elements.sidebarOverlapDropdownChild.forEach(el => {
        el.style.top = topMainSidebar + 'px';
        el.style.setProperty('--top', `${topMainSidebar}px`);
      });
  
      if (divider) divider.style.top = topMainSidebar + 'px';
    }

    openOverlapSlideOutMenu(item) {
      if (this.isReopenBlocked && this.isReopenBlocked(item)) return; 
      const second = item.nextElementSibling;
      if (!second) return;
      setTimeout ( () => {
        const mainSidebar = item.closest('.main-sidebar');
        const section = item.closest('.main-sidebar-section');
        if (mainSidebar) mainSidebar.classList.add('overlap-slide-out-menu-opened');
        if (section) section.style.zIndex = 21;
      
        const cs = window.getComputedStyle(mainSidebar);
        const padding = parseFloat(cs.getPropertyValue('padding-inline-start')) || 0;
        const inset = (item.closest('.menu__item').offsetWidth) + 'px';
        second.style.setProperty('--inset-inline-start', inset);
      
        const divider = item.parentElement.querySelector('.menu__dropdown-container + .menu-divider');
        if (divider) divider.style.insetInlineStart = (item.closest('.menu__item').offsetWidth + padding + 2) + 'px';
      
        let topMainSidebar = this.closest('.main-sidebar').getBoundingClientRect().top;
        this.elements.sidebarOverlapDropdownChild.forEach(el => {
          el.style.top = topMainSidebar + 'px';
          el.style.setProperty('--top', `${topMainSidebar}px`);
        });
        divider.style.top = topMainSidebar + 'px'

        this.overlapScrollHandler = () => this.handleScrollUpdate(second, divider);
        window.addEventListener('scroll', this.overlapScrollHandler, { passive: true });
        this.overlapScrollHandler();
      
        const scrollBarWidth = window.innerWidth - document.body.clientWidth;
        const dropdownWidth = mainSidebar.offsetWidth;
        second.style.width = (dropdownWidth + scrollBarWidth) + 'px';
        item.classList.add('open', 'opened');
        if (!this.elements.mainSidebarList?.className.includes('is-open-first')) this.elements.mainSidebarList?.classList.add('is-open-first')
        second.classList.remove('change-index');
        const timer = setTimeout(() => second.classList.add('change-index'), this.OVER_Z_DELAY);
        this.zTimers.set(second, timer);
      
        this.sizeSlideWidths(mainSidebar, second, null);
        this.setTabindex(second, true);
        if (this.overlapTrigger === 'hover') {
          this.enableGlobalOutsideClose(item);
        }
      }, 50)
    }

    openOverlapSlideOutGrandchildMenu(item, opts = {}) {
    const third = item.nextElementSibling;
    if (!third) return;

    const ms = item.closest('.main-sidebar');
    const secondWrap = item.closest('.menu__dropdown-container');

    if (!opts.seamless) this.closeOpenGrandchildInSameSecond(item, /* animated = */ true);

    const scrollBarWidth = window.innerWidth - document.body.clientWidth;
    const rawW = ms.offsetWidth;
    const padLeft = parseFloat(getComputedStyle(secondWrap).getPropertyValue('padding-inline-start')) || 0;
    const ddWidth = rawW - padLeft;
    third.style.setProperty('--padding-left', `${padLeft}px`);
    third.style.width = (ddWidth + scrollBarWidth) + 'px';

    const rect = secondWrap.getBoundingClientRect();
    const inlineStart = this.isRTL()
      ? (window.innerWidth - rect.left - 1)
      : (rect.right - 1);
    third.style.setProperty('--inset-inline-start-third', `${inlineStart}px`);

    const divider = item.parentElement.querySelector('.menu__dropdown-grandchild-container--overlap_slide_out + .menu-divider');
    if (divider) divider.style.insetInlineStart = (inlineStart + 1) + 'px';

    const doOpen = () => {
      item.classList.add('open', 'opened');
      third.classList.add('open', 'opened');
      if (!this.elements.mainSidebarList?.className.includes('is-open-second')) this.elements.mainSidebarList?.classList.add('is-open-second')
      third.classList.remove('change-index');
      const timer = setTimeout(() => third.classList.add('change-index'), this.OVER_Z_DELAY);
      this.zTimers.set(third, timer);
      this.sizeSlideWidths(ms, secondWrap, third);
      requestAnimationFrame(() => this.setTabindex(third, true));
    };

    if (opts.animated === false) {
      this.withNoAnim(third, () => {
        this.withNoAnim(item, () => {
          doOpen();
        });
      });
    } else {
      doOpen();
    }
  }

    closeFirst(first) {
      setTimeout ( () => {
        first.classList.add('closed');
        first.classList.remove('open');
        this.elements.mainSidebarList?.classList.remove('is-open-first')
        setTimeout(() => {
          first.classList.remove('opened', 'closed');
        }, 200)
        const second = first.nextElementSibling;
        if (second) {
          second.classList.remove('change-index');
          if (first.classList.contains('menu__item-title--slide_out') || first.classList.contains('menu__item-title--simple_slide_out')) {
            this.detachSlideoutScroll();
          }
        
          const t = this.zTimers.get(second);
          if (t) { clearTimeout(t); this.zTimers.delete(second); }
      
          second.querySelectorAll('.menu__item-title--overlap_slide_out_second.open, .menu__dropdown-grandchild-container.open')
            .forEach(el => {
              el.classList.add('closed');
              el.classList.remove('open', 'change-index');
              setTimeout(() => {
                el.classList.remove('opened', 'closed');
              }, 200)
              const tt = this.zTimers.get(el);
              if (tt) { clearTimeout(tt); this.zTimers.delete(el); }
            });
      
          this.setTabindex(second, false);
          if (this.overlapScrollHandler) {
            window.removeEventListener('scroll', this.overlapScrollHandler);
            this.overlapScrollHandler = null;
          }
        }
        this.elements.mainSidebarList?.classList.remove('is-open-second')
        if (this._outsideClickHandler) {
          document.removeEventListener('click', this._outsideClickHandler, { capture: true });
          this._outsideClickHandler = null;
        }
        const ms = first.closest('.main-sidebar');
        if (ms) ms.classList.remove('overlap-slide-out-menu-opened');
        const section = first.closest('.main-sidebar-section');
        if (section) section.style.zIndex = 20;
        this.disableGlobalOutsideClose();
        const anyOpen = Array.from(this.elements.overlapFirstLevelLink).some(el => el.classList.contains('open'));
        if (!anyOpen) {
          if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler, { capture: true });
            this._outsideClickHandler = null;
          }
          if (this._outsideMainSidebarHandler) {
            document.removeEventListener('click', this._outsideMainSidebarHandler, { capture: true });
            this._outsideMainSidebarHandler = null;
          }
        }
      }, 50)
    }

    closeDropdownMenu(dropdown) {
      this.elements.headerDropdownChild.forEach(item => {
        item.classList.remove('open');

        if (item.classList.contains('mega-menu')) item.removeAttribute('style');
      })

      this.elements.firstLevelLinkHeader.forEach(item => item.classList.remove('open'));
      this.closeSecondDropdown(dropdown);
    }
    
    closeGrandchild(secondTrigger) {
      setTimeout ( () => {
        const third = secondTrigger?.nextElementSibling;
        if (!third) return;
        secondTrigger.classList.add('closed');
        secondTrigger.classList.remove('open');
        third.classList.add('closed');
        third.classList.remove('open', 'change-index');
        this.elements.mainSidebarList?.classList.remove('is-open-second')
        setTimeout(() => {
          secondTrigger.classList.remove('opened', 'closed');
          third.classList.remove('opened', 'closed');
        }, 200)
        const t = this.zTimers.get(third);
        if (t) { clearTimeout(t); this.zTimers.delete(third); }
      
        const section = secondTrigger.closest('.main-sidebar-section');
        if (section) section.style.zIndex = 20;
        this.setTabindex(third, false);
      }, 50)
    }

    closeOpenGrandchildInSameSecond(ref, animated = true) {
    const secondWrapper = ref.closest('.menu__dropdown-container');
    if (!secondWrapper) return;

    const toClose = [];
    secondWrapper.querySelectorAll('.menu__dropdown-grandchild-container.open, .menu__dropdown-grandchild-container.opened').forEach(gc => {
      const trigger = gc.previousElementSibling;
      if (!trigger || trigger === ref) return;
      toClose.push({ trigger, gc });
    });

    if (toClose.length === 0) return;

    if (animated) {
      toClose.forEach(({ trigger, gc }) => {
        trigger.classList.add('closed');
        trigger.classList.remove('open');
        gc.classList.add('closed');
        gc.classList.remove('open', 'change-index');
        if (this.elements.mainSidebarList?.className.includes('is-open-second')) this.elements.mainSidebarList?.classList.remove('is-open-second')
        setTimeout(() => {
          trigger.classList.remove('opened', 'closed');
          gc.classList.remove('opened', 'closed');
        }, 200);
        const tt = this.zTimers.get(gc);
        if (tt) { clearTimeout(tt); this.zTimers.delete(gc); }
        this.setTabindex(gc, false);
      });
      return;
    }

    toClose.forEach(({ trigger, gc }) => {
      this.withNoAnim(trigger, () => {
        this.withNoAnim(gc, () => {
          trigger.classList.remove('open', 'opened', 'closed');
          gc.classList.remove('open', 'opened', 'closed', 'change-index');
          if (this.elements.mainSidebarList?.className.includes('is-open-second')) this.elements.mainSidebarList?.classList.remove('is-open-second')
          const tt = this.zTimers.get(gc);
          if (tt) { clearTimeout(tt); this.zTimers.delete(gc); }
          this.setTabindex(gc, false);
        });
      });
    });
  }

    blockReopen(first, ms = 300) {
      if (this._reopenBlock.has(first)) {
        clearTimeout(this._reopenBlock.get(first));
      }
      const tid = setTimeout(() => this._reopenBlock.delete(first), ms);
      this._reopenBlock.set(first, tid);
    }
    
    isReopenBlocked(first) {
      return this._reopenBlock.has(first);
    }

    closeAllReally() {
      this.querySelectorAll(
        '.menu__dropdown-grandchild-container.open, .menu__dropdown-grandchild-container.opened'
      ).forEach(third => {
        const secondTrigger = third.previousElementSibling;
        if (secondTrigger) this.closeGrandchild(secondTrigger);
      });
    
      this.elements.overlapFirstLevelLink.forEach(first => {
        const second = first.nextElementSibling;
    
        const hasOpenInside = !!(second && second.querySelector(
          '.menu__item-title--overlap_slide_out_second.open,' +
          '.menu__item-title--overlap_slide_out_second.opened,' +
          '.menu__dropdown-grandchild-container.open,' +
          '.menu__dropdown-grandchild-container.opened'
        ));
    
        if (
          first.classList.contains('open') ||
          first.classList.contains('opened') ||
          hasOpenInside
        ) {
          this.closeFirst(first);
        }
      });
    }

    sizeSlideWidths(mainSidebar, secondEl, thirdEl) {
      if (!mainSidebar || !secondEl) return;
    
      const viewportW  = window.innerWidth;
      const scrollbarW = window.innerWidth - document.body.clientWidth;
      const firstW     = mainSidebar.offsetWidth;
      const freeW      = Math.max(0, viewportW - firstW - scrollbarW);
    
      const limitBySidebar = Math.min(this.SLIDE_MAX_WIDTH || 400, firstW);
      const MAX_SECOND = limitBySidebar;
      const MAX_THIRD  = limitBySidebar;
    
      if (!thirdEl) {
        const st        = window.getComputedStyle(secondEl);
        const padInline = parseFloat(st.getPropertyValue('padding-inline-start')) || 0;
        const targetContent = Math.min(MAX_SECOND, Math.floor(freeW / 2));
        const secondW       = Math.max(0, targetContent + padInline);
    
        secondEl.style.maxWidth = (MAX_SECOND + padInline) + 'px';
        secondEl.style.width    = secondW + 'px';
        secondEl.dataset.lockedWidth = String(secondW);
        return;
      }
    
      const secondLocked =
        parseFloat(secondEl.dataset.lockedWidth || '') ||
        parseFloat(secondEl.style.width) ||
        secondEl.getBoundingClientRect().width;
    
      const remain = Math.max(0, freeW - secondLocked);
      const thirdW = Math.min(MAX_THIRD, remain);
    
      thirdEl.style.maxWidth = MAX_THIRD + 'px';
      thirdEl.style.width    = thirdW + 'px';
    }

    setTabindex(container, on) {
      if (!container) return;
    
      const focusables = container.querySelectorAll(
        'a, button, input, select, textarea, [tabindex], .menu__dropdown-child-item-link, .menu__dropdown-grandchild-item-link'
      );
    
      focusables.forEach(el => {
        if (on) {
          if (el.hasAttribute('data-prev-tabindex')) {
            const prev = el.getAttribute('data-prev-tabindex');
            if (prev === '' || prev === null) el.removeAttribute('tabindex');
            else el.setAttribute('tabindex', prev);
            el.removeAttribute('data-prev-tabindex');
          } else {
            if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
          }
          el.removeAttribute('aria-hidden');
        } else {
          if (!el.hasAttribute('data-prev-tabindex')) {
            el.setAttribute('data-prev-tabindex', el.getAttribute('tabindex') ?? '');
          }
          el.setAttribute('tabindex', '-1');
          el.setAttribute('aria-hidden', 'true');
        }
      });
    }

    updateCollapsibleFirstLevelLinkTabindex(panel, firstLevelExpanded) {
      if (!panel) return;

      panel.querySelectorAll('a').forEach((link) => {
        const grandchildRoot = link.closest('.menu__dropdown-grandchild-container');
        if (!grandchildRoot) {
          link.setAttribute('tabindex', firstLevelExpanded ? '0' : '-1');
          return;
        }

        const secondLevelTitle = grandchildRoot.previousElementSibling;
        const secondLevelOpen = !!(secondLevelTitle && secondLevelTitle.classList.contains('open'));

        link.setAttribute('tabindex', firstLevelExpanded && secondLevelOpen ? '0' : '-1');
      });
    }
  
    toggleCollapsibleMenu(item) {
      item.closest('.menu__item-title--collapsible').classList.toggle('open')
        if (item.classList.contains('dropdown-icon--plus')) {
          item.setAttribute('tabindex', '-1')
          item.nextElementSibling.setAttribute('tabindex', '0')
        }
        if (item.classList.contains('dropdown-icon--minus')) {
          item.setAttribute('tabindex', '-1')
          item.previousElementSibling.setAttribute('tabindex', '0')
        }
        let panel = item.closest('.menu__item-title--collapsible').nextElementSibling
        panel.style.maxHeight ? panel.style.maxHeight = null : panel.style.maxHeight = panel.scrollHeight + "px"
        const firstOpen = item.closest('.menu__item-title--collapsible').classList.contains('open');
        this.updateCollapsibleFirstLevelLinkTabindex(panel, firstOpen);
        if (!item.closest('.menu__item-title--collapsible').classList.contains('open')) {
          let parentItem = item.closest('.menu__item')
          parentItem.querySelector('.menu__item-title--second-level').classList.remove('open')
          if(parentItem.querySelector('.menu__dropdown-grandchild-container')) parentItem.querySelector('.menu__dropdown-grandchild-container').style.maxHeight = ''
        }
        document.dispatchEvent(new CustomEvent('collapsible-menu:opened'));
    }
  
    toggleSecondLevelMenu(item) {
      item.parentElement.classList.toggle('open')
      let childPanel = item.closest('.menu__item-title--second-level').nextElementSibling
      childPanel.style.maxHeight ? childPanel.style.maxHeight = null : childPanel.style.maxHeight = childPanel.scrollHeight + "px"
      if (item.closest('.menu__item-title--collapsible + .menu__dropdown-container')) {
        let parent = item.closest('.menu__item-title--collapsible + .menu__dropdown-container')
        let parentHeight = parent.offsetHeight
        parent.style.maxHeight = parentHeight + childPanel.scrollHeight + "px"
      }
      let panel = item.closest('.menu__item-title--second-level').nextElementSibling
        if (item.closest('.menu__item-title--second-level').classList.contains('open')) {
          panel.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '0'))
        } else {
          panel.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'))
        }
    }
  
    alignDropdown() {
      const isRTL = document.documentElement.dir === 'rtl';
  
      this.elements.headerDropdownChild.forEach(item => {
        this.itemCoordinate = item.getBoundingClientRect();
        this.viewportHeight = window.innerHeight
        this.viewportWidth = window.innerWidth
        this.header = item.closest('.header') 
        const elementOverflowsViewport = isRTL ? item.closest('.menu__item').getBoundingClientRect().left - item.offsetWidth < 0 : item.closest('.menu__item').getBoundingClientRect().left + item.offsetWidth + this.sidebarWidth > this.viewportWidth;
        
        if (elementOverflowsViewport) {
          item.style.left = isRTL 
            ?  0 - item.closest('.menu__item').getBoundingClientRect().left + 16 + 'px'
            : this.viewportWidth - (item.closest('.menu__item').getBoundingClientRect().left + item.offsetWidth) - 16 - this.sidebarWidth + 'px'
        }
        if (this.itemCoordinate.offsetHeight > this.viewportHeight) item.style.top = - this.itemCoordinate.height + 'px'
      })
    }
    closeParentContainers(link) {
      if (link.closest('.menu-drawer')) {
        link.closest('.menu-drawer').setAttribute('hidden', 'true')
        link.closest('.menu-drawer').classList.remove('open')
        document.body.classList.remove('hidden')
        document.dispatchEvent(new CustomEvent('body:visible'));
      }
      if (link.closest('.menu__list--header')) link.closest('.menu__item-title--header').classList.remove('open')
      if (link.closest('.menu__list--main-sidebar')) link.closest('.menu__item-title--slide_out').classList.remove('open')
    }
  
    closeSecondDropdown(parent) {
      let children = parent.querySelectorAll('.menu__dropdown-child-item')
      children.forEach(item => {
        item.querySelector('.menu__item-title--second-level').classList.remove('open')
        if (item.querySelector('.menu__dropdown-grandchild-container')) item.querySelector('.menu__dropdown-grandchild-container').style.maxHeight = ''
      })
    }
  }
customElements.define('menu-dropdown', MenuDropdown);

class HoverMegaMenu extends HTMLElement {
  constructor() {
    super();

    this._onMouseEnter = (e) => {
      this.openGrandchildMenu(e.currentTarget);
    };

    this._onFocus = (e) => {
      this.openGrandchildMenu(e.currentTarget);
    };

    this._onKeyDownParentItem = (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();

        this.focusFirstGrandchild(e.currentTarget)
      }
    };

    this._onKeyDownGrandchildMenu = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();

        this.focusParentMenuItem(e.currentTarget)
      }
    };
  }

  connectedCallback() {
    this.hoverMenuItems = this.querySelectorAll(`.menu__dropdown-child-item-link`);
    this.grandchildrenMenus = this.querySelectorAll(`.menu__dropdown-grandchild-container--hover`);
    this.megaMenuOpener = this.closest('.menu__item').querySelector('.menu__item-title--header');
    this.banners = this.querySelectorAll(`.hover-mega-menu__item-banners`);

    this.hoverMenuItems.forEach(menu => {
      menu.addEventListener('mouseenter', this._onMouseEnter);
      menu.addEventListener('focus', this._onFocus);
      menu.addEventListener('keydown', this._onKeyDownParentItem);
    });

    this.grandchildrenMenus.forEach(menu => {
      menu.addEventListener('keydown', this._onKeyDownGrandchildMenu);
    });

    this._observer = new MutationObserver(() => {
      if (!this.megaMenuOpener.classList.contains('open')) {
        this.closeAllGrandchildMenus();
      }
    });

    this._observer.observe(this.megaMenuOpener, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  disconnectedCallback() {
    this.hoverMenuItems.forEach(menu => {
      menu.removeEventListener('mouseenter', this._onMouseEnter);
      menu.removeEventListener('focus', this._onFocus);
      menu.removeEventListener('keydown', this._onKeyDownParentItem);
    });

    this.grandchildrenMenus.forEach(menu => {
      menu.removeEventListener('keydown', this._onKeyDownGrandchildMenu);
    });

    this._observer.disconnect();
  }

  getGrandchildMenu(hoverMenuItem) {
    return Array
      .from(this.grandchildrenMenus)
      .find(m => m.dataset.handle === hoverMenuItem.dataset.handle);
  }

  focusFirstGrandchild(hoverMenuItem) {
    const grandchildMenu = this.getGrandchildMenu(hoverMenuItem);

    const firstFocusable = grandchildMenu.querySelector(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );

    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  focusParentMenuItem(grandchildMenuItem) {
    const parentHandle = grandchildMenuItem.dataset.handle;
    const parentItem = Array.from(this.hoverMenuItems)
      .find(i => i.dataset.handle === parentHandle);

    parentItem?.focus();
  }

  openGrandchildMenu(hoverMenuItem) {
    this.closeAllGrandchildMenus();

    const grandchildMenu = this.getGrandchildMenu(hoverMenuItem);
    const banners = Array.from(this.banners);

    let grandchildMenuBanner =
      banners.findLast(b =>
        b.dataset.hoverMenuItemHandle === hoverMenuItem.dataset.handle &&
        b.dataset.parentMenuHandle === this.megaMenuOpener.dataset.handle
      );

    if (!grandchildMenuBanner) {
      grandchildMenuBanner =
        banners.findLast(b =>
          b.dataset.hoverMenuItemHandle === hoverMenuItem.dataset.handle &&
          b.dataset.parentMenuHandle === ''
        );
    }

    grandchildMenu?.classList.add('active');
    grandchildMenuBanner?.classList.add('active');

    const underlineSpan = hoverMenuItem.querySelector('.link-animation--underline span');
    underlineSpan?.classList.add('underline-complete');
  }

  closeAllGrandchildMenus() {
    this.grandchildrenMenus.forEach(menu => menu.classList.remove('active'));
    this.banners.forEach(banner => banner.classList.remove('active'));

    this.hoverMenuItems.forEach(item => {
      const span = item.querySelector('.link-animation--underline span');
      if (span) {
        span.classList.remove('underline-complete');
      }
    });
  }
}

customElements.define('hover-mega-menu', HoverMegaMenu);

class StoreSelectorDrawer extends HTMLElement {
  constructor() {
    super();

    this._mounted = false;

    this.originalParent = null;
    this.originalNextSibling = null;

    this.drawer = null;
    this.overlay = null;

    this.storeCheckboxes = [];
    this.changeStoreButton = null;
    this.currentStore = null;

    this._onKeyUp = (evt) => evt.code === 'Escape' && this.close();
    this._onOverlayClick = () => this.close();

    this._onDocClick = this._onDocClick.bind(this);
    this._onDocKeyDown = this._onDocKeyDown.bind(this);

    this._onSectionLoad = this._onSectionLoad.bind(this);
    this._onSectionUnload = this._onSectionUnload.bind(this);

    this._onSectionSelect = this._onSectionSelect.bind(this);
    this._onSectionDeselect = this.close.bind(this);

    this._onCheckboxChange = this._onCheckboxChange.bind(this);
    this._onChangeStoreClick = this._onChangeStoreClick.bind(this);
    this._onCloseEvent = this._onCloseEvent.bind(this);

    this.activeElement = null;
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    this.originalParent = this.parentElement;
    this.originalNextSibling = this.nextElementSibling;

    this.drawer = document.querySelector('.store-selector-drawer__inner');
    this.overlay = document.querySelector('body > .overlay');
    this.mainSidebar = document.querySelector('.main-sidebar')?.closest('.shopify-section')

    document.addEventListener('click', this._onDocClick, { passive: false });
    document.addEventListener('keydown', this._onDocKeyDown);
    this.addEventListener('keyup', this._onKeyUp);
    if (this.overlay) this.overlay.addEventListener('click', this._onOverlayClick);
    document.addEventListener('shopify:section:load', this._onSectionLoad);
    document.addEventListener('shopify:section:unload', this._onSectionUnload);
    const drawerSection = document.querySelector('.store-selector-drawer');
    if (drawerSection) {
      drawerSection.addEventListener('shopify:section:select', this._onSectionSelect);
      drawerSection.addEventListener('shopify:section:deselect', this._onSectionDeselect);
    }
    document.addEventListener('store-selector-drawer:close', this._onCloseEvent);
    this._refreshControls();
  }

  disconnectedCallback() {
    this._mounted = false;

    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onDocKeyDown);
    document.removeEventListener('shopify:section:load', this._onSectionLoad);
    document.removeEventListener('shopify:section:unload', this._onSectionUnload);
    document.removeEventListener('store-selector-drawer:close', this._onCloseEvent);

    this.removeEventListener('keyup', this._onKeyUp);

    if (this.overlay) this.overlay.removeEventListener('click', this._onOverlayClick);

    const drawerSection = document.querySelector('.store-selector-drawer');
    if (drawerSection) {
      drawerSection.removeEventListener('shopify:section:select', this._onSectionSelect);
      drawerSection.removeEventListener('shopify:section:deselect', this._onSectionDeselect);
    }

    this._unbindControlListeners();
  }

  _onDocClick(event) {
    const opener = event.target.closest('.store-selector-drawer-opener');
    if (!opener) return;

    event.preventDefault();
    this.open(opener);
  }

  _onDocKeyDown(event) {
    if (event.code.toUpperCase() !== 'ENTER') return;

    const opener = event.target.closest('.store-selector-drawer-opener');
    if (!opener) return;

    event.preventDefault();
    this.open(opener);
  }

  _onSectionLoad() {
    this._refreshControls();
  }

  async _onSectionUnload(event) {
    if (event.target.closest('.store-selector-drawer')) {
      await this.resetSavedStore();
    }
  }

  _onSectionSelect() {
    const opener = document.querySelector('.store-selector-drawer-opener');
    this.open(opener);
  }

  _onCloseEvent(e) {
    if (e.detail?.targetTag === 'store-selector-drawer') {
      this.restoreCheckedState();
    }
  }

  _refreshControls() {
    this._unbindControlListeners();

    this.storeCheckboxes = Array.from(document.querySelectorAll('.store-selector-drawer .store-accordion__checkbox'));
    this.changeStoreButton = document.querySelector('.store-selector-drawer .change-store-button');

    this.currentStore = this.storeCheckboxes.find(cb => cb.checked)?.value || null;

    if (!this.currentStore) {
      this.resetSavedStore();
    }

    this.toggleChangeButtonState();
    this._bindControlListeners();
  }

  _bindControlListeners() {
    this.storeCheckboxes.forEach(cb => cb.addEventListener('change', this._onCheckboxChange));
    this.changeStoreButton?.addEventListener('click', this._onChangeStoreClick);
  }

  _unbindControlListeners() {
    if (this.storeCheckboxes?.length) {
      this.storeCheckboxes.forEach(cb => cb.removeEventListener('change', this._onCheckboxChange));
    }
    this.changeStoreButton?.removeEventListener('click', this._onChangeStoreClick);
  }

  _onCheckboxChange(e) {
    const changedCheckbox = e.currentTarget;
    this.handleCheckboxChange(changedCheckbox);
  }

  _onChangeStoreClick() {
    this.handleChangeStore();
  }

  async resetSavedStore() {
    try {
      await this.updateCartAttribute("store", '');

      document.querySelectorAll('.store-selector__text').forEach(el => {
        el.innerHTML = el.dataset.placeholder;
      });

      document.querySelectorAll('.pickup-availability').forEach(el => {
        el.classList.remove('pickup-availability--available');
        el.classList.add('pickup-availability--unavailable');
        const text = el.querySelector('.pickup-availability__text');
        if (text) text.innerHTML = text.dataset.placeholder;
      });
    } catch (error) {
      console.error("Error updating store cart attribute:", error);
    }
  }

  toggleChangeButtonState() {
    if (!this.changeStoreButton) return;
    const hasChecked = this.storeCheckboxes.some(cb => cb.checked);
    this.changeStoreButton.disabled = !hasChecked;
  }

  handleCheckboxChange(changedCheckbox) {
    if (!changedCheckbox) return;

    if (changedCheckbox.checked) {
      this.storeCheckboxes.forEach((cb) => {
        if (cb !== changedCheckbox) {
          cb.checked = false;
          cb.removeAttribute('checked');
        }
      });
      changedCheckbox.setAttribute('checked', 'checked');
      if (this.changeStoreButton) this.changeStoreButton.disabled = false;
    } else {
      changedCheckbox.checked = true;
      changedCheckbox.setAttribute('checked', 'checked');
    }
  }

  async handleChangeStore() {
    const selected = this.storeCheckboxes.find(cb => cb.checked);
    if (!selected) return;

    const storeName = selected.value;
    if (storeName === this.currentStore) {
      this.close();
      return;
    }

    try {
      const loader = this.changeStoreButton?.querySelector('.change-store-button__loader');
      loader?.classList.remove('hidden');

      await this.updateCartAttribute("store", storeName);
      window.location.reload();
    } catch (error) {
      console.error("Error updating store cart attribute:", error);
    } finally {
      const loader = this.changeStoreButton?.querySelector('.change-store-button__loader');
      loader?.classList.add('hidden');
    }
  }

  restoreCheckedState() {
    this.storeCheckboxes.forEach((cb) => {
      const isMatch = cb.value === this.currentStore;
      cb.checked = isMatch;
      cb.toggleAttribute('checked', isMatch);
    });
    this.toggleChangeButtonState();
  }

  updateCartAttribute(attribute, value) {
    return fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributes: { [attribute]: value } }),
    });
  }

  open(triggeredBy) {
    if (!triggeredBy) return;

    const menuDrawer = triggeredBy.closest('.menu-drawer');
    if (menuDrawer) this.closeMenuDrawer(menuDrawer);

    const existing = Array.from(document.body.querySelectorAll('store-selector-drawer')).find(el => el !== this);
    if (existing) {
      existing.classList.remove('active', 'animate');
      if (this.mainSidebar && this.mainSidebar.classList.contains('store-selector-drawer-active')) this.mainSidebar.classList.remove('store-selector-drawer-active')
      existing.remove();
    }

    document.body.appendChild(this);
    this.setActiveElement(triggeredBy);

    if (this.overlay && !this.overlay.classList.contains('open')) this.overlay.classList.add('open');
    requestAnimationFrame(() => {
      this.classList.add('animate', 'active')
      if (this.mainSidebar && !this.mainSidebar.classList.contains('store-selector-drawer-active')) this.mainSidebar.classList.add('store-selector-drawer-active')
    });

    document.body.classList.add('hidden');

    if (this.drawer) {
      this.drawer.setAttribute('tabindex', '0');
      setTimeout(() => trapFocus(triggeredBy, this.drawer.querySelector('a')), 10);
    }
  }

  closeMenuDrawer(menuDrawer) {
    menuDrawer.setAttribute('hidden', 'true');
    menuDrawer.classList.remove('open');
    document.querySelectorAll('.burger-menu').forEach(item => item.blur());
  }

  close() {
    if (this.overlay) this.overlay.classList.remove('open');
    this.classList.remove('active');
    if (this.mainSidebar && this.mainSidebar.classList.contains('store-selector-drawer-active')) this.mainSidebar.classList.remove('store-selector-drawer-active')

    if (this.activeElement) removeTrapFocus(this.activeElement);

    document.body.classList.remove('hidden');

    document.dispatchEvent(new CustomEvent('body:visible', {
      detail: { targetTag: 'store-selector-drawer' }
    }));

    if (this.drawer) this.drawer.setAttribute('tabindex', '-1');

    if (this.originalParent) {
      if (this.originalNextSibling) this.originalParent.insertBefore(this, this.originalNextSibling);
      else this.originalParent.appendChild(this);
    }
  }

  setActiveElement(el) {
    this.activeElement = el;
  }
}

customElements.define('store-selector-drawer', StoreSelectorDrawer);

class NewsDrawer extends HTMLElement {
  constructor() {
    super();

    this._mounted = false;

    this.drawer = null;
    this.overlay = null;

    this.sectionEl = null;
    this.sectionOriginalParent = null;
    this.sectionOriginalNextSibling = null;

    this.storageKey = 'newsDrawerSeenVersion';
    this.currentVersion = '';

    this.activeElement = null;

    this._onKeyUp = (evt) => evt.code === 'Escape' && this.close();
    this._onOverlayClick = () => this.close();

    this._onDocClick = this._onDocClick.bind(this);
    this._onDocKeyDown = this._onDocKeyDown.bind(this);

    this._onSectionLoad = this._onSectionLoad.bind(this);
    this._onSectionSelect = this._onSectionSelect.bind(this);
    this._onSectionDeselect = this.close.bind(this);
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    this.sectionEl = this.closest('.shopify-section') || this;
    this.sectionOriginalParent = this.sectionEl.parentElement;
    this.sectionOriginalNextSibling = this.sectionEl.nextElementSibling;

    this.drawer = this.querySelector('.news-drawer__inner');
    this.overlay = document.querySelector('body > .overlay');

    this.currentVersion = (this.dataset.newsVersion || '').trim();

    this._cleanupOtherNewsDrawers();

    document.addEventListener('click', this._onDocClick, { passive: false });
    document.addEventListener('keydown', this._onDocKeyDown);

    this.addEventListener('keyup', this._onKeyUp);
    this.overlay?.addEventListener('click', this._onOverlayClick);

    document.addEventListener('shopify:section:load', this._onSectionLoad);

    this.sectionEl?.addEventListener('shopify:section:select', this._onSectionSelect);
    this.sectionEl?.addEventListener('shopify:section:deselect', this._onSectionDeselect);

    this.updateUnreadIndicator();
  }

  disconnectedCallback() {
    this._mounted = false;

    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onDocKeyDown);

    document.removeEventListener('shopify:section:load', this._onSectionLoad);

    this.removeEventListener('keyup', this._onKeyUp);
    this.overlay?.removeEventListener('click', this._onOverlayClick);

    this.sectionEl?.removeEventListener('shopify:section:select', this._onSectionSelect);
    this.sectionEl?.removeEventListener('shopify:section:deselect', this._onSectionDeselect);
  }

  _onDocClick(event) {
    const opener = event.target.closest('.news-drawer-opener');
    if (!opener) return;

    event.preventDefault();
    this.open(opener);
  }

  _onDocKeyDown(event) {
    if (event.code.toUpperCase() !== 'ENTER') return;

    const opener = event.target.closest('.news-drawer-opener');
    if (!opener) return;

    event.preventDefault();
    this.open(opener);
  }

  _onSectionLoad(evt) {
    const sectionId = evt?.detail?.sectionId;
    if (!sectionId) return;

    const loaded = document.querySelector(`#shopify-section-${sectionId}`);
    if (!loaded || !loaded.contains(this)) return;

    this.sectionEl = this.closest('.shopify-section') || this;
    this.sectionOriginalParent = this.sectionEl.parentElement;
    this.sectionOriginalNextSibling = this.sectionEl.nextElementSibling;

    this.drawer = this.querySelector('.news-drawer__inner');
    this.overlay = document.querySelector('body > .overlay');
    this.currentVersion = (this.dataset.newsVersion || '').trim();

    this.overlay?.removeEventListener('click', this._onOverlayClick);
    this.overlay?.addEventListener('click', this._onOverlayClick);

    this.updateUnreadIndicator();

    if (Shopify.designMode) document.body.classList.add('disable-scroll-body');

    this.open(this);
  }

  _onSectionSelect() {
    if (Shopify.designMode) document.body.classList.add('disable-scroll-body');
    this.open(this);
  }

  updateUnreadIndicator() {
    try {
      const seen = localStorage.getItem(this.storageKey) || '';
      const hasUnread = !!this.currentVersion && this.currentVersion !== seen;

      document.querySelectorAll('.news-drawer-opener').forEach((btn) => {
        btn.classList.toggle('has-unread', hasUnread);
      });
    } catch (e) {}
  }

  markAsSeen() {
    try {
      if (this.currentVersion) localStorage.setItem(this.storageKey, this.currentVersion);
    } catch (e) {}
    this.updateUnreadIndicator();
  }

  open(triggeredBy) {
    const existing = Array.from(document.body.querySelectorAll('.shopify-section'))
      .find(sec => sec !== this.sectionEl && sec.contains(sec.querySelector('news-drawer')));

    if (existing) {
      const otherDrawer = existing.querySelector('news-drawer');
      if (otherDrawer?.close) {
        try { otherDrawer.close(); } catch(e) {}
      }
    }

    document.body.appendChild(this.sectionEl);
    if (triggeredBy) this.setActiveElement(triggeredBy);

    if (this.overlay && !this.overlay.classList.contains('open')) {
      this.overlay.classList.add('open');
    }

    requestAnimationFrame(() => {
      this.classList.add('animate', 'active');
    });

    document.body.classList.add('hidden');

    if (this.drawer) {
      this.drawer.setAttribute('tabindex', '0');
      const closeButton = this.querySelector('.drawer__close');
      if (triggeredBy) setTimeout(() => trapFocus(triggeredBy, closeButton || this.drawer), 10);
    }

    this.markAsSeen();
  }

  close() {
    if (Shopify.designMode) document.body.classList.remove('disable-scroll-body');

    this.overlay?.classList.remove('open');

    this.classList.remove('active');
    document.body.classList.remove('hidden');

    document.dispatchEvent(new CustomEvent('body:visible', {
      detail: { targetTag: 'news-drawer' }
    }));

    this.drawer?.setAttribute('tabindex', '-1');

    if (this.sectionOriginalParent) {
      if (this.sectionOriginalNextSibling) {
        this.sectionOriginalParent.insertBefore(this.sectionEl, this.sectionOriginalNextSibling);
      } else {
        this.sectionOriginalParent.appendChild(this.sectionEl);
      }
    }
  }

  setActiveElement(element) {
    this.activeElement = element;
  }

  _cleanupOtherNewsDrawers() {
    const all = document.querySelectorAll('news-drawer');
    all.forEach((el) => {
      if (el !== this) {
        el.classList?.remove('active', 'animate');
        const sec = el.closest('.shopify-section');
        if (sec) sec.remove();
        else el.remove();
      }
    });
  }
}
customElements.define('news-drawer', NewsDrawer);

class FormState extends HTMLElement {
  constructor() {
    super();

    this.formInputs = this.querySelectorAll('input.required, select[required]');
    this.form = this.querySelector('form');
    if (this.form) this.buttonSubmit = this.form.querySelector('button[type="submit"]') || this.form.querySelector('.button--submit');

    this.formInputs.forEach((input) => {
      input.addEventListener('input', this.onInputChange.bind(this));
    });
    if (this.buttonSubmit) this.buttonSubmit.addEventListener('click', (event) => {
      this.onSubmitHandler(event);
    })
  }

  onInputChange(event) {
    if(event.target.closest('.invalid')) event.target.classList.remove('invalid');
    event.target.classList.add('valid');
  }

  onSubmitHandler() {
    this.formInputs.forEach((input) => {
      if(input.hasAttribute('type') && input.getAttribute('type') == 'password' || input.hasAttribute('type') && input.getAttribute('type') == 'text') {
        input.value.length == 0 ? this.invalidInput(input) : this.validInput(input)
      }
      if(input.hasAttribute('type') && input.getAttribute('type') == 'email') {
        input.value.includes('@') ? this.validInput(input) : this.invalidInput(input)
      }
      if(!input.hasAttribute('type')) {
        input.value === input.dataset.empty ? this.invalidInput(input) : this.validInput(input)
      }
    });
    if(!this.closest('.section-newsletter')) {
      document.dispatchEvent(new CustomEvent('form:submitted', {
        detail: {
          formID: this.querySelector('form').getAttribute('id')
        }
      }))
    }
  }

  invalidInput(input) {
    if(input.closest('.valid')) input.classList.remove('valid');
    input.classList.add('invalid');
  }

  validInput(input) {
    if(input.closest('.invalid')) input.classList.remove('invalid');
    input.classList.add('valid');
  }
}
customElements.define('form-state', FormState);  

class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    if (!this.input) return;

    this.changeEvent = new Event('change', { bubbles: true });

    this.addEventListener('click', (event) => {
      const btn = event.target.closest('button');
      if (!btn) return;

      const name = btn.name;
      if (name !== 'plus' && name !== 'minus') return;

      event.preventDefault();

      const prev = this.input.value;
      name === 'plus' ? this.input.stepUp() : this.input.stepDown();

      if (prev !== this.input.value) {
        this.input.dispatchEvent(this.changeEvent);
      }
    });
  }
}
customElements.define('quantity-input', QuantityInput);

class ModalDialog extends HTMLElement {
  constructor() {
    super();

    this.elements = {
      body: document.querySelector('body'),
      buttons: this.querySelectorAll('.open-popup'),
      overlay: document.querySelector('body > .overlay'),
      buttonsClose: this.querySelectorAll('.close-popup'),
      filterGroups: this.querySelectorAll('.filter-group')
    };

    this.originalPopupState = new WeakMap();
    this.popup = null;

    this.elements.buttons.forEach(button => {
      const popup = button.parentNode.querySelector('.popup-wrapper');
      if (popup) {
        button.dataset.popupId = this.generatePopupId();
        popup.dataset.popupId = button.dataset.popupId;

        this.originalPopupState.set(popup, {
          parent: popup.parentNode,
          nextSibling: popup.nextSibling
        });
      }

      button.addEventListener('click', (event) => this.openContainer(event));
      button.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') this.openContainer(event);
      });
    });

    if (this.elements.overlay) {
      this.elements.overlay.addEventListener('click', this.closeContainer.bind(this));
    }

    if (this.elements.buttonsClose) {
      this.elements.buttonsClose.forEach(buttonClose =>
        buttonClose.addEventListener('click', this.closeContainer.bind(this))
      );
    }

    document.addEventListener('keyup', (event) => {
      if (event.code && event.code.toUpperCase() === 'ESCAPE' && document.body.querySelector('.popup-wrapper:not(.popup-wrapper--disable-escape).open')) {
        this.closeContainer(event);
      }
    });

    if (this.closest('.only-mobile.snippet-facets')) {
      window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && this.popup && this.popup.classList.contains('open')) {
          this.closeContainer({ target: this.querySelector('.close-popup') });
        }
      });
    }
  }

  generatePopupId() {
    return 'popup-' + Math.random().toString(36).substr(2, 9);
  }

  openContainer(event) {
    const trigger = event.target.closest('.open-popup');
    if (!trigger) return;

    const popupId = trigger.dataset.popupId;
    const popup = document.querySelector(`.popup-wrapper[data-popup-id="${popupId}"]`);
    if (!popup) return;

    this.popup = popup;
    this.popupOpener = trigger;

    if (trigger.closest('.facets__button')) {
      if (this.popup.querySelectorAll('[data-stagger-item]').length > 0) {
        this.popup.querySelectorAll('[data-stagger-item]').forEach((item) => {
          if(!item.classList.contains('stagger__item')) {
            item.classList.add('stagger__item');
          }
        });
      }
    }

    document.body.appendChild(this.popup);
    this.popup.classList.add('open');
    this.elements.overlay.classList.add('open');

    if (this.closest('.container--sticky')) this.closest('.container--sticky').style.position = 'static';
    if (this.popup.closest('.hover-content')) this.popup.closest('.banner__content')?.style.setProperty('opacity', 1, 'important');
    if (this.popup.closest('.slider__grid')) this.popup.closest('.slider__grid').style.overflow = 'visible';

    const inputPassword = this.popup.querySelector('input.enter-using-password');
    if (inputPassword) inputPassword.focus();

    if (!this.elements.body.classList.contains('hidden')) {
      this.elements.body.classList.add('hidden');
    }

    setTimeout(() => {
      const focusables = getFocusableElements(this.popup);
      if (focusables.length === 0) return;

      const elementToFocus = inputPassword || this.popup.querySelector('.close-popup') || focusables[0];
      trapFocus(this.popup, elementToFocus);
    }, 0);

    document.dispatchEvent(new CustomEvent('dialog:after-show'));
  }

  closeContainer(event) {
    const eventTarget = event?.target || event;

    if (eventTarget.closest?.('a.media-with-text__card')) event.preventDefault();
    if (eventTarget.closest?.('.card-quick-view')) {
      event.preventDefault();
      eventTarget.closest('.card-quick-view').classList.remove('no-hover');
    }

    this.popup = document.body.querySelector('.popup-wrapper.open');
    if (!this.popup) return;

    this.popup.classList.remove('open');
    this.elements.overlay.classList.remove('open');

    const original = this.originalPopupState.get(this.popup);
    if (original) {
      original.parent.insertBefore(this.popup, original.nextSibling);
    }

    if (this.closest('.container--sticky')) this.closest('.container--sticky').style.position = 'sticky';
    if (this.popup.closest('.hover-content')) this.popup.closest('.banner__content')?.style.removeProperty('opacity');
    if (this.popup.closest('.slider__grid')) {
      this.popup.closest('.slider__grid').style.overflowX = 'auto';
      this.popup.closest('.slider__grid').style.overflowY = 'hidden';
    }

    if (this.elements.body.classList.contains('hidden')) {
      this.elements.body.classList.remove('hidden');
      document.dispatchEvent(new CustomEvent('body:visible'));
    }

    this.elements.filterGroups.forEach(item => {
      if (item.hasAttribute('open')) item.setAttribute('open', '');
    });

    removeTrapFocus(this.popupOpener);

    document.dispatchEvent(new CustomEvent('dialog:after-hide'));
  }
}

customElements.define('modal-dialog', ModalDialog);

class ModalWindow extends HTMLElement {
  constructor() {
    super();

    this.originalContentParent = null;
    this.contentPlaceholder = document.createComment('modal-content-placeholder');
    this.cookieName = 'avante-theme:form-submitted';
    this.popupContent = null;
    this.openedBy = null;
    this.input = null;

    this.handleCloseClick = this.handleCloseClick.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    document.addEventListener('click', this.handleCloseClick);

    document.querySelector('body > .overlay')?.addEventListener('click', this.handleOverlayClick);

    document.addEventListener('form:submitted', (event) => {
      this.detectSubmittedForm(event.detail?.formID);
    });
  }

  isElement(value) {
    return value instanceof Element;
  }

  isOpenedFromProductOpener(opener) {
    return this.isElement(opener) && !!opener.closest('.product__modal-opener');
  }

  handleCloseClick(event) {
    const closeBtn =
      event.target.closest('.product-popup-modal__content [id^="ModalClose-"]') ||
      event.target.closest('.product-media-modal__dialog [id^="ModalClose-"]');

    if (!closeBtn) return;

    this.hide();

    const modal = closeBtn.closest('.product-media-modal, .product-popup-modal');

    requestAnimationFrame(() => {
      const sliderComponent = modal?.querySelector('slider-component');
      if (!sliderComponent) return;

      sliderComponent.dispatchEvent(
        new CustomEvent('product-modal:close', {
          detail: { modal },
          bubbles: false
        })
      );
    });
  }

  handleOverlayClick() {
    this.hide();
  }

  handleKeyUp(event) {
    if (event.code?.toUpperCase() === 'ESCAPE') {
      this.hide();
    }
  }

  show(opener) {
    this.openedBy = opener;
    this.popupContent = this.querySelector('.product-popup-modal__content');

    if (this.popupContent) {
      this.originalContentParent = this.popupContent.parentNode;

      if (this.originalContentParent) {
        this.originalContentParent.insertBefore(this.contentPlaceholder, this.popupContent);
      }

      document.body.appendChild(this.popupContent);
      this.popupContent.classList.add('open');
    }

    document.body.classList.add('hidden');
    this.setAttribute('open', '');

    if (!this.isOpenedFromProductOpener(opener)) {
      document.querySelector('body > .overlay')?.classList.add('open');
    }

    if (this.classList.contains('product-popup-modal--question')) {
      this.input = this.querySelector('.field.product-url input');
      if (this.input) {
        this.input.value = window.location.href;
      }
    }

    const popup = this.querySelector('.template-popup');
    if (popup && typeof popup.loadContent === 'function') {
      popup.loadContent();
    }

    const focusContainer = this.popupContent || this;
    const firstFocusable = getFocusableElements(focusContainer)[0];
    trapFocus(focusContainer, firstFocusable || focusContainer);
    
    document.addEventListener('keyup', this.handleKeyUp);
  }

  hide() {
    if (this.popupContent && this.originalContentParent) {
      this.popupContent.classList.remove('open');
      this.originalContentParent.insertBefore(this.popupContent, this.contentPlaceholder);
      this.contentPlaceholder.remove();
    }

    this.hideSubmittedForm();
    document.body.classList.remove('hidden');
    document.dispatchEvent(new CustomEvent('body:visible'));
    this.removeAttribute('open');

    if (!this.isOpenedFromProductOpener(this.openedBy)) {
      document.querySelector('body > .overlay')?.classList.remove('open');
    }

    removeTrapFocus(this.isElement(this.openedBy) ? this.openedBy : null);

    this.querySelectorAll('video, .js-youtube, .js-vimeo').forEach((media) => {
      if (typeof window.pauseMedia === 'function') {
        window.pauseMedia(media);
      }

      if (media.tagName === 'VIDEO') {
        media.removeAttribute('autoplay');
        media.pause();
      } else if (media.tagName === 'IFRAME') {
        if (media.src && media.src.includes('autoplay=1')) {
          media.src = media.src.replace('autoplay=1', 'autoplay=0');
        }
      }
    });

    this.popupContent = null;
    this.originalContentParent = null;
    this.openedBy = null;

    document.removeEventListener('keyup', this.handleKeyUp);
  }

  detectSubmittedForm(formID) {
    if (!formID) return;

    if (isStorageSupported('local')) {
      window.localStorage.setItem(this.cookieName, formID);
    }
  }

  hideSubmittedForm() {
    if (isStorageSupported('local')) {
      window.localStorage.removeItem(this.cookieName);
    }

    this.classList.remove('form-submitted');
  }
}

customElements.define('modal-window', ModalWindow);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    this.button = null;

    this.posX1 = 0;
    this.posInit = 0;
    this.posX2 = 0;
    this.posY1 = 0;
    this.posY2 = 0;
    this.posInitY = 0;

    this.cookieName = 'avante-theme:form-submitted';

    this._inited = false;
    this._checkScheduled = false;
    this._checked = false;

    this._onMouseDown = this.mouseDown.bind(this);
    this._onMouseMove = this.mouseMove.bind(this);
    this._onClick = this.mouseUp.bind(this);

    this._onSectionLoad = () => {
      this.button = this.querySelector('button');
      document.body.classList.remove('hidden');
    };

    this._startLazyCheck = this._startLazyCheck.bind(this);
    this._runLazyCheck = this._runLazyCheck.bind(this);
  }

  connectedCallback() {
    if (this._inited) return;
    this._inited = true;

    if (this.classList.contains('zoom-disabled')) return;

    this.button = this.querySelector('button');
    if (!this.button) return;

    this.button.addEventListener('mousedown', this._onMouseDown);
    this.button.addEventListener('mousemove', this._onMouseMove);
    this.button.addEventListener('click', this._onClick);

    document.addEventListener('shopify:section:load', this._onSectionLoad);

    this.addEventListener('pointerenter', this._startLazyCheck, { once: true, passive: true });
    this.addEventListener('pointerdown',  this._startLazyCheck, { once: true, passive: true });
    this.addEventListener('focusin',      this._startLazyCheck, { once: true });

    this._scheduleIdleCheck();
  }

  disconnectedCallback() {
    if (this.button) {
      this.button.removeEventListener('mousedown', this._onMouseDown);
      this.button.removeEventListener('mousemove', this._onMouseMove);
      this.button.removeEventListener('click', this._onClick);
    }

    document.removeEventListener('shopify:section:load', this._onSectionLoad);

    this.removeEventListener('pointerenter', this._startLazyCheck);
    this.removeEventListener('pointerdown',  this._startLazyCheck);
    this.removeEventListener('focusin',      this._startLazyCheck);

    this._inited = false;
  }

  _scheduleIdleCheck() {
    if (this._checkScheduled || this._checked) return;
    this._checkScheduled = true;

    const run = () => {
      this._checkScheduled = false;
      this._runLazyCheck();
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 3000 });
    } else {
      setTimeout(run, 800);
    }
  }

  _startLazyCheck() {
    this._runLazyCheck();
  }

  _runLazyCheck() {
    if (this._checked) return;
    this._checked = true;

    requestAnimationFrame(() => this.checkIfFormSubmitted());
  }

  getEvent(event) {
    return event?.type?.includes('touch') ? event.touches[0] : event;
  }

  mouseDown(event) {
    const evt = this.getEvent(event);
    if (!evt) return;
    this.posInit = this.posX1 = evt.clientX;
    this.posInitY = this.posY1 = evt.clientY;
  }

  mouseMove(event) {
    const evt = this.getEvent(event);
    if (!evt) return;
    this.posX2 = this.posX1 - evt.clientX;
    this.posX1 = evt.clientX;
    this.posY2 = this.posY1 - evt.clientY;
    this.posY1 = evt.clientY;
  }

  mouseUp(event) {
    if (event && event.detail > 0) {
      if (Math.abs(this.posInit - this.posX1) - Math.abs(this.posInitY - this.posY1) > 5) return;
    }

    const modal = document.querySelector(this.getAttribute('data-modal'));
    if (modal) modal.show(this.button);

    if (modal && this.closest('.product__modal-opener')) {
      const mediaId = this.button?.dataset?.mediaId;

      requestAnimationFrame(() => {
        const sliderComponent = modal.querySelector('slider-component');
        if (!sliderComponent) return;

        sliderComponent.dispatchEvent(new CustomEvent('product-modal:open', {
          detail: { mediaId },
          bubbles: false
        }));
      });
    }
  }

  checkIfFormSubmitted() {
    if (!this.button) return;
    if (isStorageSupported('local')) {
      const formSubmitted = window.localStorage.getItem(this.cookieName);
      if (!formSubmitted) return;

      const modal = document.querySelector(this.getAttribute('data-modal'));
      if (modal && modal.querySelector(`[id='${formSubmitted}']`) && this.button.classList.contains('popup-button--form')) {
        modal.classList.add('form-submitted');
        modal.show(this.button);
      }
    }
  }
}

customElements.define('modal-opener', ModalOpener);

class SliderComponent extends HTMLElement {
  constructor() {
    super();

    this._inited = false;

    this.slider = null;
    this.sliderItems = null;
    this.sliderGrid = null;
    this.thumbnails = null;
    this.pages = null;
    this.sliderViewport = null;
    this.currentPageElement = null;
    this.pageTotalElement = null;
    this.prevButton = null;
    this.nextButton = null;
    this.parentContainer = null;

    this.scrollbar = null;
    this.scrollbarTrack = null;
    this.scrollbarThumb = null;

    this.mediaId = null;
    this.hasGlobalMediaSettings = false;

    this.posX1 = null;
    this.posInit = null;
    this.posX2 = null;
    this.posY1 = null;
    this.posY2 = null;
    this.posInitY = null;
    this.widthItem = null;
    this.gapValue = null;
    this.fullWidthItem = null;
    this._activeIndex = 0;
    this._scrollEndTimer = null;

    this.isOnButtonClick = '0';
    this.disableSwipe = false;
    this.linkElem = null;

    this._disableButtonsRaf = 0;
    this._lastDisableState = { prev: null, next: null };

    this._cachedContainer = null;
    this._slidesForNavCache = null;
    this._slidesForNavDirty = true;

    this._activeObserver = null;
    this._pagesResizeObserver = null;

    this._scrollTimer = null;
    this._adaptSlideHeightTimeout = null;

    this._onProductModalClose = this._onProductModalClose.bind(this);
    this._onProductModalOpen = this._onProductModalOpen.bind(this);

    this._onUpdateVariantMedia = this._onUpdateVariantMedia.bind(this);

    this._onWindowResize = this._onWindowResize.bind(this);
    this._onSectionLoad = this._onSectionLoad.bind(this);
    this._onBlockSelect = this._onBlockSelect.bind(this);

    this._onSliderScroll = this._onSliderScroll.bind(this);
    this._onSliderKeyup = this._onSliderKeyup.bind(this);

    this._onPrevClick = this.onButtonClick.bind(this, 'previous', false);
    this._onNextClick = this.onButtonClick.bind(this, 'next', false);

    this._onDocMouseUp = null;
    this._onDocMouseMove = null;
    this._onMouseDown = this.swipeStart.bind(this);
    this._onMouseMove = this.swipeAction.bind(this);
    this._onMouseUp   = this.swipeEnd.bind(this);

    this._onWheelReset = () => { this.isOnButtonClick = 0; };
    this._onTouchReset = () => { this.isOnButtonClick = 0; }; 
    this._onScrollbarScroll = this.updateScrollbarPosition.bind(this);
    this._onScrollbarTrackClick = this.scrollByClick.bind(this);
    this._onScrollbarThumbDown = this.onDragStart.bind(this);

    this._onDocMouseUp = this.onDragEnd.bind(this);
    this._onDocMouseMove = this.onDragMove.bind(this);
    this._resizeRaf = 0;
    this._pendingResizeEl = null;
    this._containerWidth = window.innerWidth;
    this._containerRO = null;
    this._containerWidthDirty = true;  
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    this.addEventListener('product-modal:close', this._onProductModalClose);
    this.addEventListener('product-modal:open', this._onProductModalOpen);

    this._armLazyInit();
  }

  disconnectedCallback() {
    this._disarmLazyInit();
    this._lazyArmed = false;
    this._mounted = false;

    if (this._containerRO) {
      this._containerRO.disconnect();
      this._containerRO = null;
    }

    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
      this._scrollTimer = null;
    }
    if (this._adaptSlideHeightTimeout) {
      clearTimeout(this._adaptSlideHeightTimeout);
      this._adaptSlideHeightTimeout = null;
    }

    if (this._disableButtonsRaf) {
      cancelAnimationFrame(this._disableButtonsRaf);
      this._disableButtonsRaf = 0;
    }

    if (this._activeObserver) {
      this._activeObserver.disconnect();
      this._activeObserver = null;
    }
    if (this._pagesResizeObserver) {
      this._pagesResizeObserver.disconnect();
      this._pagesResizeObserver = null;
    }

    this.removeEventListener('product-modal:close', this._onProductModalClose);
    this.removeEventListener('product-modal:open', this._onProductModalOpen);

    document.removeEventListener('updateVariantMedia', this._onUpdateVariantMedia);

    window.removeEventListener('resize', this._onWindowResize);
    document.removeEventListener('shopify:section:load', this._onSectionLoad);

    if (Shopify.designMode && this.closest('.scroll-to-block')) {
      document.removeEventListener('shopify:block:select', this._onBlockSelect);
    }

    if (this.slider) {
      this.slider.removeEventListener('scroll', this._onSliderScroll);
      this.slider.removeEventListener('keyup', this._onSliderKeyup);
      this.slider.removeEventListener('mousedown', this._onMouseDown);
      this.slider.removeEventListener('mousemove', this._onMouseMove);
      this.slider.removeEventListener('mouseup',   this._onMouseUp);
      this.slider.removeEventListener('wheel', this._onWheelReset);
      this.slider.removeEventListener('touchstart', this._onTouchReset);
      this.slider.removeEventListener('touchmove', this._onTouchReset);
      this.slider.removeEventListener('touchend', this._onTouchReset);
      this.slider.removeEventListener('scroll', this._onScrollbarScroll);
    }
    
    this.scrollbarTrack?.removeEventListener('click', this._onScrollbarTrackClick);
    this.scrollbarThumb?.removeEventListener('mousedown', this._onScrollbarThumbDown);
    
    document.removeEventListener('mouseup', this._onDocMouseUp);
    document.removeEventListener('mousemove', this._onDocMouseMove);

    if (this.prevButton?.length) {
      this.prevButton.forEach(btn => btn.removeEventListener('click', this._onPrevClick));
    }
    if (this.nextButton?.length) {
      this.nextButton.forEach(btn => btn.removeEventListener('click', this._onNextClick));
    }

    this._inited = false;
  }

  _scheduleResizeImage(el) {
    if (!el) return;
    this._pendingResizeEl = el;
  
    if (this._resizeRaf) return;
    this._resizeRaf = requestAnimationFrame(() => {
      this._resizeRaf = 0;
      const target = this._pendingResizeEl;
      this._pendingResizeEl = null;
      if (target) this.resizeImage(target);
    });
  }

  _initHard() {
    if (this._inited) return;
    this._inited = true;

    this.slider = this.querySelector('[id^="Slider-"]');
    if (!this.slider) return;

    this.sliderItems = this.slider.querySelectorAll('[id^="Slide-"]');

    this.sliderGrid = this.querySelector('.slider__grid');
    this.thumbnails = this.querySelector('[id^="Slider-Thumbnails"]');

    this.pages = this.querySelector('.slider-counter');
    this.sliderViewport = this.querySelector('.slider__viewport');
    this.currentPageElement = this.querySelector('.slider-counter--current');
    this.pageTotalElement = this.querySelector('.slider-counter--total');

    this.prevButton = this.querySelectorAll('button[name="previous"]');
    this.nextButton = this.querySelectorAll('button[name="next"]');

    this.parentContainer = this.closest('section') || this;

    this._containerWidth = window.innerWidth;

    if ('ResizeObserver' in window && this.parentContainer) {
      this._containerRO?.disconnect();
      this._containerRO = new ResizeObserver((entries) => {
        const entry = entries && entries[0];
        if (!entry) return;

        const w = entry.contentRect?.width;
        if (w && Number.isFinite(w)) {
          this._containerWidth = w;
        } else {
          this._containerWidth = window.innerWidth;
        }

        this._scheduleDisableButtons();
      });

      this._containerRO.observe(this.parentContainer);
    }

    this.scrollbar = this.querySelector('.slider-scrollbar');
    this.scrollbarTrack = this.querySelector('.slider-scrollbar__track');
    this.scrollbarThumb = this.querySelector('.slider-scrollbar__thumb');

    this.hasGlobalMediaSettings = !!this.querySelector('img.product-modal-image');

    if (this.slider.closest('.product-media-modal')) {
      this.slider.style.scrollBehavior = 'auto';
    }

    document.addEventListener('updateVariantMedia', this._onUpdateVariantMedia);

    window.addEventListener('resize', this._onWindowResize);
    document.addEventListener('shopify:section:load', this._onSectionLoad);

    if (Shopify.designMode && this.closest('.scroll-to-block')) {
      document.addEventListener('shopify:block:select', this._onBlockSelect);
    }

    if (this.closest('.product__media-wrapper') && this.slider.classList.contains('organize_images')) {
      this.initProductGallery();
    }

    this.sliderDataCount = this.slider.getAttribute('data-count');
    this.sliderMobileDataCount = this.slider.getAttribute('data-count-mobile');

    if (this.pages) {
      this.initPages();
      this._pagesResizeObserver = new ResizeObserver(() => this.initPages());
      this._pagesResizeObserver.observe(this.slider);
    }

    if (this.scrollbar) {
      setTimeout(() => this.setScrollBar(), 1);
      this.initEvents();
    }

    if (this.prevButton?.length || this.nextButton?.length) {
      this.prevButton.forEach(btn => btn.addEventListener('click', this._onPrevClick));
      this.nextButton.forEach(btn => btn.addEventListener('click', this._onNextClick));
      this._scheduleDisableButtons();
    }

    requestAnimationFrame(() => this._scheduleResizeImage(this.slider.querySelector('.is-active')));

    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide);
    this.setActiveModel(activeSlideIndex);

    requestAnimationFrame(() => {
      this._initActiveObserver();
      this._syncNavState();
    });

    window.addEventListener('load', () => {
      this._syncNavState();
    }, { once: true });

    if (this.slider.classList.contains('recently-viewed')) {
      this.sliderItems[0]?.classList.add('is-active');
      let lastChildIndex = this.sliderItems.length - 1;

      let dataCount = +this.slider.dataset.count;
      let sliderContainer = this.closest('.slider-container-js');

      if (lastChildIndex + 1 >= dataCount) this.sliderItems[lastChildIndex]?.classList.add('last-desktop');

      if (sliderContainer && sliderContainer.offsetWidth < 769) {
        dataCount = +this.slider.dataset.countMobile;
        if (lastChildIndex + 1 >= dataCount) this.sliderItems[lastChildIndex]?.classList.add('last-mobile');
      }
    }

    const canBeSlider =
      (!this.slider.classList.contains('grid') &&
        (
          (this.closest('.slider-container-js')?.offsetWidth > 768 && this.sliderItems.length > 1) ||
          (this.closest('.slider-container-js')?.offsetWidth <= 768 && this.sliderItems.length > 1)
        )
      );

    if (canBeSlider && !this.slider.classList.contains('thumbnail-list')) {
      this.activeSlide = this.slider.querySelector('.is-active');
      this.slider.addEventListener('scroll', this._onSliderScroll);
    }

    const containerWidth = this.parentContainer?.clientWidth || window.innerWidth;

    const needSwipe =
      (this.sliderItems.length > this.sliderDataCount && containerWidth > 768) ||
      (this.sliderItems.length > this.sliderMobileDataCount && containerWidth <= 768) ||
      (this.sliderItems.length >= this.sliderDataCount && this.sliderDataCount == 5 && containerWidth <= 1024 && containerWidth > 768);

    if (canBeSlider && needSwipe) {
      this.slider.addEventListener('mousedown', this._onMouseDown);
      this.slider.addEventListener('mousemove', this._onMouseMove);
      this.slider.addEventListener('mouseup',   this._onMouseUp);
    }

    this.slider.addEventListener('keyup', this._onSliderKeyup);
    this.slider.addEventListener('wheel', this._onWheelReset, { passive: true });
    this.slider.addEventListener('touchstart', this._onTouchReset, { passive: true });
    this.slider.addEventListener('touchmove', this._onTouchReset, { passive: true });
    this.slider.addEventListener('touchend', this._onTouchReset, { passive: true });
  }

  _applyActiveFromScroll() {
    if (!this.sliderItems?.length || !this.sliderViewport) return;
  
    const viewportLeft = this.sliderViewport.getBoundingClientRect().left;
  
    let bestIdx = -1;
    let bestDist = Infinity;
  
    for (let i = 0; i < this.sliderItems.length; i++) {
      const item = this.sliderItems[i];
      const dist = Math.abs(viewportLeft - item.getBoundingClientRect().left);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  
    if (bestIdx < 0) return;
  
    const best = this.sliderItems[bestIdx];
  
    if (best.classList.contains('is-active')) {
      this._activeIndex = bestIdx;
      return;
    }

    const prev = this.slider.querySelector('.is-active');
    if (prev) prev.classList.remove('is-active');
  
    best.classList.add('is-active');
    this._activeIndex = bestIdx;
  
    this._scheduleResizeImage(best);
  }

  _hasHorizontalScroll() {
    if (!this.slider) return false;
    return (this.slider.scrollWidth - this.slider.clientWidth) > 2;
  }

  _syncScrollableState() {
    if (!this.slider) return;
  
    const hasScroll = this._hasHorizontalScroll();
    const isThumbnailStrip = this.slider.classList.contains('thumbnail-list');
  
    if (hasScroll) {
      if (!this.slider.querySelector('.is-active') && !isThumbnailStrip) {
        this._applyActiveFromScroll();
      }
  
      this.slider.removeEventListener('scroll', this._onSliderScroll);
      if (!isThumbnailStrip) {
        this.slider.addEventListener('scroll', this._onSliderScroll, { passive: true });
      }
  
      this._markSlidesDirty();
      this.update();
      this._lastDisableState = { prev: null, next: null };
      this._scheduleDisableButtons();
    } else {
      this.slider.removeEventListener('scroll', this._onSliderScroll);
    }
  }

  _armLazyInit() {
    if (this._lazyArmed) return;
    this._lazyArmed = true;
  
    this._firstIntent = () => this._startInitSoon('intent');
  
    this.addEventListener('pointerenter', this._firstIntent, { once: true, passive: true });
    this.addEventListener('pointerdown',  this._firstIntent, { once: true, passive: true });
    this.addEventListener('focusin',      this._firstIntent, { once: true, passive: true });
  
    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        if (!entries || !entries[0]) return;
        if (entries[0].isIntersecting) {
          this._startInitSoon('viewport');
        }
      }, {
        root: null,
        rootMargin: '500px 0px',
        threshold: 0.01
      });
  
      this._io.observe(this);
    } else {
      this._startInitSoon('fallback');
    }
  }
  
  _startInitSoon(reason) {
    if (this._inited || this._initScheduled) return;
    this._initScheduled = true;
  
    this._disarmLazyInit();
  
    const run = () => {
      this._initScheduled = false;
      this._initHard();
    };
  
    setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 1500 });
      } else {
        requestAnimationFrame(run);
      }
    }, 0);
  }
  
  _disarmLazyInit() {
    if (this._firstIntent) {
      this.removeEventListener('pointerenter', this._firstIntent);
      this.removeEventListener('pointerdown',  this._firstIntent);
      this.removeEventListener('focusin',      this._firstIntent);
      this._firstIntent = null;
    }
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
  }

  _onProductModalClose(event) {  
    requestAnimationFrame(() => {
      if (!this.slider) return;
  
      if (this.slider.closest('.product-media-modal')) {
        this.slider.style.scrollBehavior = 'unset';
        this.sliderItems?.forEach(item => { item.style.marginTop = ''; });
      }
    });
  }

  _onProductModalOpen(event) {
    const { mediaId } = event.detail || {};
    this.mediaId = mediaId;

    if (!this._inited) this._initHard();

    requestAnimationFrame(() => {
      this._refreshDomRefs();
    
      if (!this.slider) return;
    
      if (this.slider.closest('.product-media-modal')) {
        const modalContent = this.closest('.product-media-modal__content');
        if (modalContent) modalContent.scrollTop = 0;
        this.slider.style.scrollBehavior = 'auto';
      }
    
      if (this.hasGlobalMediaSettings) {
        this.sliderItems?.forEach(item => item.classList.remove('is-active'));
    
        this.sliderItems = this.slider.querySelectorAll('[id^="Slide-"]');
        this.sliderItems = Array.from(this.sliderItems).filter(item => {
          const image = item.querySelector('img.product-modal-image');
          return !image || (
            image.classList.contains('product__media-item--variant--alt') ||
            image.classList.contains('product__media-item--variant-show') ||
            image.classList.contains('product__media-item--show')
          );
        });
    
        this.sliderItems.forEach(item => {
          if (item.querySelector(`[data-media-id="${this.mediaId}"]`)) {
            item.classList.add('is-active');
            return;
          }
        });
    
        this.activeSlide = this.slider.querySelector('.is-active');
        const activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide);
    
        if (this.slider.closest('.product-media-modal')) {
          this.sliderGrid
            ?.style.setProperty('height', this.sliderItems[activeSlideIndex]?.clientHeight + 'px');
        }
      }
    
      if (this.slider.closest('.product-media-modal')) {
        this.sliderItems?.forEach(item => {
          const vvH = window.visualViewport?.height;
          if (!vvH) return;
          if (item.offsetHeight < vvH) {
            item.style.marginTop = `${(vvH - item.offsetHeight) / 2}px`;
          }
        });
      }
    
      this._markSlidesDirty();
      this.update();
      this._lastDisableState = { prev: null, next: null };
      this._scheduleDisableButtons();
      if (this.scrollbar) this._scheduleScrollbarRecalc();
    });
  }

  _refreshDomRefs() {
    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.slider ? this.slider.querySelectorAll('[id^="Slide-"]') : [];
    this.prevButton = this.querySelectorAll('button[name="previous"]');
    this.nextButton = this.querySelectorAll('button[name="next"]');
    this.pages = this.querySelector('.slider-counter');
    this.sliderViewport = this.querySelector('.slider__viewport');
    this.sliderGrid = this.querySelector('.slider__grid');
  
    this.scrollbar = this.querySelector('.slider-scrollbar');
    this.scrollbarTrack = this.querySelector('.slider-scrollbar__track');
    this.scrollbarThumb = this.querySelector('.slider-scrollbar__thumb');
  
    this.hasGlobalMediaSettings = !!this.querySelector('img.product-modal-image');
  }

  _onUpdateVariantMedia() {
    this._markSlidesDirty();
    if (this.pages) this.update();
    this._lastDisableState = { prev: null, next: null };
    this._scheduleDisableButtons();
  }

  _onWindowResize() {
    this._scheduleResizeImage(this.slider?.querySelector('.is-active'));
    this._scheduleDisableButtons();
    this._scheduleScrollbarRecalc();
    requestAnimationFrame(() => {
      this._syncScrollableState();
    });
  }

  _onSectionLoad() {
    this.resizeImage(this.slider?.querySelector('.is-active'));
    if (this.closest('.product__media-wrapper') && this.slider?.classList.contains('organize_images')) {
      this.initProductGallery();
    }
  }

  _onBlockSelect(event) {
    let activeBlock = event.target;
    if (!this.querySelector(`#${activeBlock.getAttribute('id')}`)) return;

    let activeSlide = this.slider.querySelector('.is-active');
    if (!activeSlide) return;

    activeSlide.classList.remove('is-active');
    activeBlock.classList.add('is-active');

    let activeSlideIndex = Array.from(this.sliderItems).indexOf(activeBlock);
    this._scheduleDisableButtons();
    this.update();
    if (this.sliderItems[activeSlideIndex]) this.slider.scrollLeft = this.sliderItems[activeSlideIndex].offsetLeft;
  }

  _onSliderScroll() {
    if (this.slider?.classList.contains('thumbnail-list')) return;
    if (this.isOnButtonClick == 'onButtonClick') return;
    if (this.slider.className.includes('disable-scroll')) return;

    if (this.slider.closest('.product-media-modal')) {
      clearTimeout(this._scrollTimer);
      this._scrollTimer = setTimeout(() => {
        this.onAfterSlideChange(this.activeSlide);
      }, 0);
    }

    this.slider.querySelectorAll('.snap-align').forEach(item => item.classList.remove('is-active'));

    if ((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below') || this.slider.closest('.product--thumbnails_left')) && !this.slider.closest('product-modal')) {
      this.galleryThumb = this.slider.closest('.slider-block').querySelector('[id^="GalleryThumbnails-"]');
      this.galleryThumb?.querySelectorAll('.snap-align').forEach(item => item.classList.remove('is-active'));
    }

    if (this.slider.closest('.product-media-modal')) this.onBeforeSlideChange();

    clearTimeout(this._scrollEndTimer);
    this._scrollEndTimer = setTimeout(() => {
      this._applyActiveFromScroll();
      if((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below') || this.slider.closest('.product--thumbnails_left')) && !this.slider.closest('product-modal')) {
        this.scrollThumbnail();
      }

      this.update();
      this.setActiveModel(this._activeIndex);
    }, 80);
  }

  clearScrollEndTimer() {
    if (this._scrollEndTimer) {
      clearTimeout(this._scrollEndTimer);
      this._scrollEndTimer = null;
    }
  }

  _onSliderKeyup(event) {
    if (event.code.toUpperCase() !== 'ARROWRIGHT' && event.code.toUpperCase() !== 'ARROWLEFT') return;

    let activElem = document.activeElement;
    this.activeSlide = this.slider.querySelector('.is-active');

    if (!activElem?.closest('[id^="Slide-"]')?.classList.contains('is-active')) {
      if (this.activeSlide) this.activeSlide.classList.remove('is-active');
      activElem?.classList.add('is-active');

      this.update();

      if ((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below') || this.slider.closest('.product--thumbnails_left')) && !this.slider.closest('product-modal')) {
        this.scrollThumbnail();
      }
    }
  }

  initProductGallery() {
    this.slider.setAttribute('style', 'scroll-behavior: unset;')
    setTimeout(() => this.slider.scrollLeft = this.slider.querySelector('.is-active')?.offsetLeft, 10)
    setTimeout(() => this.slider.setAttribute('style', 'scroll-behavior: smooth;'), 100)
  }

  resizeImage(activeElem) {
    const containerWidth = this.parentContainer?.clientWidth || window.innerWidth;
    if(this.slider.classList.contains('slider-main--original')) {
      if(this.slider.classList.contains('grid--peek') && containerWidth > 768) {
        this.sliderViewport.removeAttribute('style')
        return
      }
      const rect = activeElem.getBoundingClientRect();
      let height = rect.height;
      if(containerWidth < 769) {
        this.slider.closest('.product--side_thumbnails') && !this.slider.closest('product-modal') ? this.slider.closest('.slider-block').removeAttribute('style') : this.slider.removeAttribute('style')
        const newH = `${height}px`;
        if (this.sliderViewport.style.height !== newH) {
          this.sliderViewport.style.height = newH;
        }
      } else {
        this.sliderViewport.removeAttribute('style')
        this.slider.closest('.product--side_thumbnails') && !this.slider.closest('product-modal') ? this.slider.closest('.slider-block').style.height = height + 'px' : this.slider.style.height = height + 'px'
      }
    }
    if(this.sliderItems.length > this.sliderDataCount && containerWidth > 768 || this.sliderItems.length > this.sliderMobileDataCount && containerWidth <= 768 || this.sliderItems.length >= this.sliderDataCount && this.sliderDataCount == 5 && containerWidth <= 1024 && containerWidth > 768) {
      this.disableSwipe = false
    } else {
      this.disableSwipe = true
    }
  }

  _getSliderContainer() {
    if (this._cachedContainer && document.contains(this._cachedContainer)) return this._cachedContainer;
  
    if (this.closest('.cart-drawer') || this.closest('#cart-notification')) {
      this._cachedContainer = document.body;
    } else {
      this._cachedContainer = this.closest('.slider-container-js') || this.closest('section') || this;
    }
    return this._cachedContainer;
  }

  _isHiddenSlide(el) {
    return (
      el.classList.contains('product__media-item--hide') &&
      !el.classList.contains('product__media-item--show') &&
      !el.classList.contains('product__media-item--variant-alt')
    );
  }

  _markSlidesDirty() {
    this._slidesForNavDirty = true;
  }
  
  _getSlidesForNav() {
    if (!this.slider) return [];
  
    if (!this._slidesForNavDirty && this._slidesForNavCache) return this._slidesForNavCache;
  
    const children = this.slider.children;
    const out = [];
  
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      if (!el.id || !el.id.startsWith('Slide-')) continue;
      if (this._isHiddenSlide(el)) continue;
      out.push(el);
    }
  
    this._slidesForNavCache = out;
    this._slidesForNavDirty = false;
    return out;
  }
  
  _initActiveObserver() {
    if (!this.slider || this._activeObserver) return;
  
    this._activeObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          this._markSlidesDirty();
          this._scheduleDisableButtons();
          return;
        }
      }
    });
  
    this._activeObserver.observe(this.slider, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  _scheduleDisableButtons() {
    if (!this.prevButton?.length || !this.nextButton?.length) return;
    if (this._disableButtonsRaf) return;
  
    this._disableButtonsRaf = requestAnimationFrame(() => {
      this._disableButtonsRaf = 0;
      this.disableButtons();
    });
  }
  
  _setButtonsDisabled(nodeList, shouldDisable) {
    nodeList.forEach(btn => {
      const isDisabled = btn.hasAttribute('disabled');
      if (shouldDisable) {
        if (!isDisabled) btn.setAttribute('disabled', 'disabled');
      } else {
        if (isDisabled) btn.removeAttribute('disabled');
      }
    });
  }
  
  _syncNavState() {
    this.disableButtons();
  }

  initPages() {
    this.sliderItemsToShow = this._getSlidesForNav()
    if (this.sliderItemsToShow.length < 2) return;
    this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
    this.slidesPerPage = Math.floor(this.slider.clientWidth / this.sliderItemOffset);
    this.totalPages = this.sliderItemsToShow.length
    this.update();
  }

  resetPages() {
    this.sliderItems = this.slider.querySelectorAll('[id^="Slide-"]');
    this.initPages();
  }

  update() {
    if (!this.pages) return;
  
    const visible = this._getSlidesForNav();
    this.totalPages = visible.length;
    this.activeSlide = this.slider.querySelector('.is-active');
  
    let currentIndex = this.activeSlide ? visible.indexOf(this.activeSlide) : -1;
    if (currentIndex < 0) currentIndex = 0;
    this.currentPage = this.totalPages ? currentIndex + 1 : 0;
  
    if (this.currentPageElement && this.pageTotalElement) {
      this.currentPageElement.textContent = this.currentPage;
      this.pageTotalElement.textContent = this.totalPages;
    }
  
    this.totalPages === 1
      ? this.pages.closest('.slider-buttons').classList.add('visually-hidden')
      : this.pages.closest('.slider-buttons').classList.remove('visually-hidden');
  
      this._scheduleDisableButtons();
  
    if (this.scrollbar) setTimeout(() => this.setScrollBar(), 1);
  }

  disableButtons() {
    if (!this.prevButton?.length || !this.nextButton?.length) return;
    if (!this.slider) return;
  
    const items = this._getSlidesForNav();
    const total = items.length;
  
    if (total <= 1) {
      if (this._lastDisableState.prev !== true) {
        this._setButtonsDisabled(this.prevButton, true);
        this._lastDisableState.prev = true;
      }
      if (this._lastDisableState.next !== true) {
        this._setButtonsDisabled(this.nextButton, true);
        this._lastDisableState.next = true;
      }
      return;
    }
  
    const active = this.slider.querySelector('.is-active');
    let activeIndex = active ? items.indexOf(active) : -1;
    if (activeIndex < 0) activeIndex = Math.max(0, Math.min(this._activeIndex || 0, items.length - 1));
  
    const width = this._containerWidth || window.innerWidth;
    const isMobile = width < 769;
  
    if (this.slider.closest('#cart-notification')) this.slider.setAttribute('data-count', '3');
  
    let dataCount = +(this.slider.dataset.count || 1);
    if (dataCount === 5 && width < 1025) dataCount = 4;
    if (isMobile) dataCount = +(this.slider.dataset.countMobile || dataCount);
  
    let step = dataCount;
    if (this.classList.contains('slider--row-two') || this.classList.contains('slider--row-three')) {
      step = Math.max(1, step - 1);
    }
  
    const disablePrev = activeIndex === 0;
    const disableNext = activeIndex > (total - 1 - step);
  
    if (this._lastDisableState.prev !== disablePrev) {
      this._setButtonsDisabled(this.prevButton, disablePrev);
      this._lastDisableState.prev = disablePrev;
    }
    if (this._lastDisableState.next !== disableNext) {
      this._setButtonsDisabled(this.nextButton, disableNext);
      this._lastDisableState.next = disableNext;
    }
  }

  _scheduleScrollbarRecalc() {
    if (!this.scrollbar || !this.slider) return;
  
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.setScrollBar();
      });
    });
  }

  setScrollBar() {
    const thumbWidth = (this.slider.clientWidth / this.slider.scrollWidth) * 100;
    this.scrollbarThumb.style.width = `${thumbWidth}%`;
    this.updateScrollbarPosition();
  }

  initEvents(e) {
    this.slider.addEventListener('scroll', this._onScrollbarScroll);
    this.scrollbarTrack.addEventListener('click', this._onScrollbarTrackClick);
    this.scrollbarThumb.addEventListener('mousedown', this._onScrollbarThumbDown);

    document.addEventListener('mouseup', this._onDocMouseUp);
    document.addEventListener('mousemove', this._onDocMouseMove);
  }

  updateScrollbarPosition() {
    const scrollOffset = theme.config.rtl ? Math.abs(this.slider.scrollLeft) : this.slider.scrollLeft;
    const scrollRatio = scrollOffset / (this.slider.scrollWidth - this.slider.clientWidth);
    const maxLeft = this.scrollbarTrack.clientWidth - this.scrollbarThumb.clientWidth;
    const thumbPosition = maxLeft * scrollRatio;
    this.scrollbarThumb.style.left = theme.config.rtl ? `${maxLeft- thumbPosition}px` : `${thumbPosition}px`;
  }

  scrollByClick(event) {
    if (event.target === this.scrollbarThumb) return;
    const trackRect = this.scrollbarTrack.getBoundingClientRect();
    const clickPosition = event.clientX - trackRect.left;
    const thumbCenter = this.scrollbarThumb.clientWidth / 2;
    const newLeft = clickPosition - thumbCenter;
    const scrollRatio = newLeft / (trackRect.width - this.scrollbarThumb.clientWidth);
    this.slider.scrollLeft = scrollRatio * (this.slider.scrollWidth - this.slider.clientWidth);
  }

  onDragStart(event) {
    event.preventDefault();
    this.isDragging = true;
    this.startX = event.clientX;
    this.thumbStartLeft = this.scrollbarThumb.offsetLeft;
    this.scrollbarThumb.classList.add('dragging');
  }

  onDragMove(event) {
    if (!this.isDragging) return;
    event.preventDefault();
    const deltaX = event.clientX - this.startX;
    const newLeft = Math.max(0, Math.min(this.thumbStartLeft + deltaX, this.scrollbarTrack.clientWidth - this.scrollbarThumb.clientWidth));
    const scrollRatio = newLeft / (this.scrollbarTrack.clientWidth - this.scrollbarThumb.clientWidth);
    this.slider.scrollLeft = scrollRatio * (this.slider.scrollWidth - this.slider.clientWidth);
  }

  onDragEnd() {
    this.isDragging = false;
    this.scrollbarThumb.classList.remove('dragging');
  }

  scrollThumbnail() {
    this.activeSlide = this.slider.querySelector('.is-active')
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
    this.galleryThumb = this.slider.closest('.slider-block').querySelector('[id^="Slider-Thumbnails"]')
    this.galleryThumb.classList.contains('variant-thumbs') ? this.sliderThumbs = this.galleryThumb.querySelectorAll('[id^="Slide-Thumbnails"].product__media-item--variant-alt') : this.sliderThumbs = this.galleryThumb.querySelectorAll('[id^="Slide-Thumbnails"]')
    let activeThumb = this.sliderThumbs[activeSlideIndex]
    if(!activeThumb) return
    let prevActiveSlide = this.galleryThumb.querySelector('.is-active')
    if (prevActiveSlide) prevActiveSlide.classList.remove('is-active')  
    activeThumb.classList.add('is-active')
    // Check thumbnails gallery position   
    if (this.galleryThumb.classList.contains('thumbnail-list--column')) {
      this.galleryThumb.closest('.thumbnail-slider--column').scrollTo({
        top: activeThumb.offsetTop - activeThumb.offsetHeight - 8,
        behavior: 'smooth'
      })
    } else {
      this.galleryThumb.scrollTo({
        left: activeThumb.offsetLeft - activeThumb.offsetWidth - 8,
        behavior: 'smooth'
      })
    }
  }

  changeActiveSlideOnScroll() {
    if (this.dataset.enableAutoplay === 'false') {
      window.pauseAllMedia();
    }

    let sliderLeft = Math.round(this.sliderViewport.getBoundingClientRect().left)
    let sliderItemLeft 
    this.sliderItems.forEach((item) => {
      sliderItemLeft = Math.round(item.getBoundingClientRect().left)
      if (Math.abs(sliderLeft - sliderItemLeft) < 7) {
        item.classList.add('is-active')
        this._scheduleResizeImage(item);
      } else {
        if(this.closest('.advantages')) this.querySelectorAll('[id^="Slide-"]')[this.sliderItems.length - 2].classList.add('is-active')
      }
    })
    // Make the gallery flexible if media ratio is original
    if(this.slider.classList.contains('slider-main--original') && this.slider.querySelector('.is-active')) {
      if(this.slider.classList.contains('grid--peek') && this.parentContainer.offsetWidth > 768) {
        this.sliderViewport.removeAttribute('style')
        return
      }
      setTimeout(() => {
        let height = this.slider.querySelector('.is-active').offsetHeight
        if(this.parentContainer.offsetWidth < 769) {
          this.slider.closest('.product--side_thumbnails') && !this.slider.closest('product-modal') ? this.slider.closest('.slider-block').removeAttribute('style') : this.slider.removeAttribute('style')
          const newH = `${height}px`;
          if (this.sliderViewport.style.height !== newH) {
            this.sliderViewport.style.height = newH;
          }
        } else {
          this.sliderViewport.removeAttribute('style')
          this.slider.closest('.product--side_thumbnails') && !this.slider.closest('product-modal') ? this.slider.closest('.slider-block').style.height = height + 'px' : this.slider.style.height = height + 'px'
        }
      }, 100)
    }
    if((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below') || this.slider.closest('.product--thumbnails_left')) && !this.slider.closest('product-modal')) {
      this.scrollThumbnail()
    } 
    this.update();
    this.activeSlide = this.slider.querySelector('.is-active')
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide)
    this.setActiveModel(activeSlideIndex)
  }

  setActiveModel(activeSlideIndex) {
    if (!this.classList.contains('slider-mobile-gutter')) return;

    let activeMediaId;
    if (this.sliderItems[activeSlideIndex]) {
      activeMediaId = this.sliderItems[activeSlideIndex].dataset.mediaId;
    }

    if (activeMediaId) {
      this.toggleXrButton(activeMediaId);
    }
  }

  toggleXrButton(activeMediaId) {
    const xrButtons = document.querySelectorAll('slider-component ~ .product__xr-button');
    
    if (xrButtons.length == 0) return;

    xrButtons.forEach(button => {
      button.classList.add('product__xr-button--hidden');
    });

    const activeXrButton = document.querySelector(`slider-component ~ .product__xr-button[data-media-id="${activeMediaId}"]`);
    if (activeXrButton) {
      activeXrButton.classList.remove('product__xr-button--hidden');
    }
  }

  onBeforeSlideChange() {
    clearTimeout(this.adaptSlideHeightTimeout); // In case of a recurring click on the button

    const modalContent = this.closest('.product-media-modal__content');
    modalContent.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  onAfterSlideChange(activeSlide) {
    const slideTransitionSpeed = 750; // Approximate value of scroll-behavior: smooth in browsers

    if (typeof activeSlide === 'number') {
      activeSlide = this.sliderItems[activeSlide]
    } 

    this.adaptSlideHeightTimeout = setTimeout(() => {
      this.querySelector('.slider__grid').style.setProperty('height', activeSlide.offsetHeight + 'px');
    }, slideTransitionSpeed)
  }

  onButtonClick(direction, nextActiveSlideSwipe) {
      window.pauseAllMedia()

      const isRTL = document.documentElement.dir === 'rtl'

      if (this.slider.closest('.product-media-modal')) this.onBeforeSlideChange()

      if (this.slider.classList.contains('thumbnail-list')) return

      const items = this._getSlidesForNav();
      if (!items.length) return;

      this.activeSlide = this.slider.querySelector('.is-active');
      let activeSlideIndex = items.indexOf(this.activeSlide);
      if (activeSlideIndex < 0) activeSlideIndex = 0;
      if ((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below') || this.slider.closest('.product--thumbnails_left')) && !this.slider.closest('product-modal')) {
        this.galleryThumb = this.slider.closest('.slider-block').querySelector('[id^="GalleryThumbnails-"]')
        let activeThumb = this.galleryThumb.querySelectorAll('[id^="Slide-"]')[activeSlideIndex]
        activeThumb.classList.remove('is-active')
      }
      if(this.slider.closest('#cart-notification')) this.slider.setAttribute("data-count", "3")
      let dataCount = +this.slider.dataset.count
      if (dataCount == 5 && this.closest('.slider-container-js').offsetWidth < 1025 ) dataCount = 4
      let sliderContainer
      !this.closest('.cart-drawer') && !this.closest('#cart-notification') ? sliderContainer = this.closest('.slider-container-js') : sliderContainer = document.querySelector('#body')
      if (sliderContainer.offsetWidth < 769) dataCount = +this.slider.dataset.countMobile
      let nextActiveSlide
      // Determine the step for changing the active slide
      nextActiveSlideSwipe ? nextActiveSlide = nextActiveSlideSwipe : nextActiveSlide = dataCount
      if (direction == 'next') {
        let lastIndex = items.length - 1;
        if (this.closest('.advantages') && window.innerWidth < 768 || this.closest('.testimonials')) lastIndex = this.sliderItems.length
        // Restrict gallery scrolling at the end
        activeSlideIndex = Math.min(lastIndex, activeSlideIndex + nextActiveSlide);

        this.activeSlide.classList.remove('is-active');
        if (items[activeSlideIndex]) items[activeSlideIndex].classList.add('is-active');

        this.resizeImage(items[activeSlideIndex]);
        if (this.slider.closest('.product-media-modal')) this.slider.style.scrollBehavior = 'smooth'
        if (this.classList.contains('slider--row') && this.parentElement.offsetWidth > 768) {
          const activeSlide = items[activeSlideIndex]
          const scrollPosition  = isRTL 
            ? (this.getBoundingClientRect().width - activeSlide.offsetLeft - activeSlide.offsetWidth) * -1 + activeSlide.offsetWidth
            : activeSlide.offsetLeft - activeSlide.offsetWidth

          setTimeout(() => {
            this.slider.scrollLeft = scrollPosition
          }, 1)
        } else {
          const activeSlide = items[activeSlideIndex]
          const scrollPosition  = isRTL 
            ? (this.getBoundingClientRect().width - activeSlide.offsetLeft - activeSlide.offsetWidth) * -1 
            : activeSlide.offsetLeft

          setTimeout(() => {
            this.slider.scrollLeft = scrollPosition
          }, 1)
        }
      }
      if (direction == 'previous') {  
        activeSlideIndex = Math.max(0, activeSlideIndex - nextActiveSlide);
        if (this.activeSlide) this.activeSlide.classList.remove('is-active')  
          items[activeSlideIndex].classList.add('is-active')
        this.resizeImage(items[activeSlideIndex])
        if (this.slider.closest('.product-media-modal')) this.slider.style.scrollBehavior = 'smooth'
        // Restrict gallery scrolling at the beginnig
        if (this.classList.contains('slider--row') && this.offsetWidth > 768) {
          const activeSlide = items[activeSlideIndex]
          const scrollPosition  = isRTL 
            ? (this.getBoundingClientRect().width - activeSlide.offsetLeft - activeSlide.offsetWidth) * -1 + activeSlide.offsetWidth
            : activeSlide.offsetLeft - activeSlide.offsetWidth

          this.slider.scrollLeft = scrollPosition 
        } else {
          const activeSlide = items[activeSlideIndex]
          const scrollPosition  = isRTL 
            ? (this.getBoundingClientRect().width - activeSlide.offsetLeft - activeSlide.offsetWidth) * -1 
            : activeSlide.offsetLeft
            
          this.slider.scrollLeft = scrollPosition
        }       
      }
      if((this.slider.closest('.product--side_thumbnails') || this.slider.closest('.product--thumbnails_below') || this.slider.closest('.product--thumbnails_left')) && !this.slider.closest('product-modal')) {
        this.scrollThumbnail()
      } 
      this.update();
      this._scheduleDisableButtons();
      this.isOnButtonClick = 'onButtonClick'
      this.setActiveModel(activeSlideIndex)
      if (this.slider.closest('.product-media-modal')) this.onAfterSlideChange(activeSlideIndex)
  }

  getEvent (event) {
    return event.type.search('touch') !== -1 ? event.touches[0] : event;
  }

  swipeStart(event) {
    if (event.target.closest('.swiper-button')) return;

    if (event.target.closest('.slider__grid').getAttribute('id') != this.slider.getAttribute('id')) return
    if(this.disableSwipe) return
    if (event.target.closest('.card__extras') || event.target.closest('.swatches_container') || event.target.closest('.only-mobile-slider') && this.closest('section').offsetWidth > 768) return
    if(event.button == 2) return
    event.preventDefault()
    if(event.target.closest('.thumbnail-slider') || event.target.classList.contains('3d-model')) return
    this.slider.style.userSelect = 'none'
    this.slider.style.cursor = 'grab'
   
    setTimeout(() => {
      this.sliderItems.forEach(item => {
        if (item.querySelector('a.card-js')) item.querySelector('a.card-js').style.pointerEvents = 'none'
      }, 20)
    })
    this.sliderItems.forEach(item => {
      item.querySelector('.card-js') ? item.querySelector('.card-js').style.cursor = 'grab' : item.closest('.card-js').style.cursor = 'grab'
    })
    let evt = this.getEvent(event);
    this.posInit = this.posX1 = evt.clientX;
    this.posInitY = this.posY1 = evt.clientY
    this.widthItem = +this.sliderItems[0].offsetWidth
    this.gapValue = +window.getComputedStyle(this.slider).getPropertyValue("gap").slice(0, -2)
    this.fullWidthItem = this.widthItem + this.gapValue
  }

  swipeAction(event) {
    if (event.target.closest('.swiper-button')) return;

    if (event.target.closest('.slider__grid').getAttribute('id') != this.slider.getAttribute('id')) return
    if(this.slider.classList.contains('disable-scroll')) this.slider.classList.remove('disable-scroll')
    if(event.target.closest('.thumbnail-slider')) return
    let evt = this.getEvent(event)
    this.posX2 = this.posX1 - evt.clientX;
    this.posX1 = evt.clientX;
    this.posY2 = this.posY1 - evt.clientY;
    this.posY1 = evt.clientY;
  }

  swipeEnd(event) {
    if (event.target.closest('.swiper-button')) return;

    if (event.target.closest('.slider__grid').getAttribute('id') != this.slider.getAttribute('id')) return
    if(this.disableSwipe) return
    if(event.target.closest('.thumbnail-slider') || event.target.classList.contains('3d-model')) return
    if (event.target.closest('.color-swatch')) return
    // Return default cursor value
    this.slider.style.userSelect = 'auto'
    this.slider.style.cursor = 'default'
    let parentOrChild
    this.sliderItems.forEach(item => {
      item.querySelector('.card-js') ? parentOrChild = item.querySelector('.card-js') : parentOrChild = item.closest('.card-js')
      parentOrChild.style.cursor = 'pointer'
      if (item.querySelector('.product-labels__item')) item.querySelector('.product-labels__item').style.cursor = 'auto'
      parentOrChild.style.pointerEvents = 'auto'
      if (item.querySelector('.testimonials_card')) item.querySelector('.testimonials_card').style.cursor = 'auto'
      if(item.closest('.logo-slider') || item.closest('.banner-gallery')) {
        parentOrChild.style.cursor = 'default'
        if(item.querySelector('a.card-js')) item.querySelector('a.card-js').style.cursor = 'pointer'
      }
    })
    // Check right click
    if(event.button == 2) return
    if (event.target.closest('.card__extras') || event.target.closest('.only-mobile-slider') && this.closest('section').offsetWidth > 768) return
    // Check if swipe was horizontal or vertical
    let isHorizontalSwipe = Math.abs(this.posInit - this.posX1) > Math.abs(this.posInitY - this.posY1)
    let horizontalSwipeIsOk = Math.abs(this.posInit - this.posX1) > 50
    let swipeVertical = Math.abs(this.posInitY - this.posY1) > 20
    let swipeHorizontal = Math.abs(this.posInit - this.posX1) > 20
    if(!swipeHorizontal && !swipeVertical) {
      if(event.target.closest('a')) {
        this.linkElem = event.target.closest('a')
      } 
      else {
        if(event.target == this.slider || event.target == this.sliderViewport || event.target == this) return;
        if(event.target.querySelector('a') && !event.target.querySelector('a').closest('.richtext')) this.linkElem = event.target.querySelector('a')
      }
      if(this.linkElem) this.linkElem.hasAttribute('target') && !Shopify.designMode ? window.open(this.linkElem.href, '_blank') : location.href = this.linkElem.href
    }
    if (!isHorizontalSwipe || !horizontalSwipeIsOk) return
    if (this.slider.closest('.product-media-modal')) this.slider.style.scrollBehavior = 'smooth'
    // Check slider direction
    let posFinal = this.posInit - this.posX1;
    let direction;
    const isRTL = document.documentElement.dir === 'rtl'
    if (isRTL) {
      posFinal > 0 ? direction = 'previous' : direction = 'next'
    } else {
      posFinal > 0 ? direction = 'next' : direction = 'previous'
    }
    // nextActiveSlideSwipe variable determines how many slides the galery will scroll through
    let nextActiveSlideSwipe = 0 // The step between active slide could be equal to the number of slides in visible area, so the variable = 0
    if(!this.slider.closest('.slider-block')) if(Math.abs(posFinal) < this.fullWidthItem) nextActiveSlideSwipe = 1
    this.onButtonClick(direction, nextActiveSlideSwipe)
  }
}
customElements.define('slider-component', SliderComponent);



class BaseProductCardSlider {
  constructor(sliderEl) {
    this.sliderEl = sliderEl;

    this._inited = false;
    this._listenersBound = false;

    this.isRTL = this.sliderEl.getAttribute('dir') === 'rtl';
    this.speed = parseInt(sliderEl.dataset.transitionDuration, 10) || 300;
    this.autoplaySpeed = parseInt(sliderEl.dataset.autoplaySpeed, 10) || 5000;
    this.autoplay = sliderEl.dataset.autoplay === "true";
    this.loop = sliderEl.dataset.loop === "true";
    this.showOnlyVariantsMedia = sliderEl.dataset.showOnlyVariantsMedia === "true";
    this.slidesLoaded = false;
    this.allSlides = null;
    this.firstSlideIndex = 0;

    this.swiperInstance = null;
    this.swiperBaseConfiguration = null;

    this._paginationEl = null;
    this._nextEl = null;
    this._prevEl = null;

    this._onMouseEnterAutoplay = null;
    this._onMouseLeaveAutoplay = null;
    this._onNextClick = null;
    this._onPrevClick = null;
    this._onCardClickBlock = null;
    this._onSwatchChange = null;

    this._onHoverLoad = null;
    this._onHoverMove = null;
    this._onHoverLeave = null;
    this._onResize = null;
  }

  init() {
    if (this._inited) return;
    this._inited = true;

    this._paginationEl = this.sliderEl.querySelector('.swiper-pagination');
    this._nextEl = this.sliderEl.querySelector('.swiper-button-next');
    this._prevEl = this.sliderEl.querySelector('.swiper-button-prev');

    this.swiperBaseConfiguration = {
      a11y: { slideRole: 'listitem' },
      slidesPerView: 'auto',
      loop: this.loop,
      pagination: {
        el: this._paginationEl,
        type: 'bullets'
      },
      navigation: {
        nextEl: this._nextEl,
        prevEl: this._prevEl,
      },
      speed: this.speed,
      lazy: { loadPrevNext: true },
      roundLengths: false,
    };

    nextFrame(() => {
      runIdle(() => {
        this.initializeSwiperInstance();
        this.configureListeners();
      }, { timeout: 2000 });
    });
  }

  destroy() {
    this._detachListeners();

    if (this.swiperInstance) {
      try { this.swiperInstance.destroy(false, true); } catch (e) {}
      this.swiperInstance = null;
    }

    this._inited = false;
    this._listenersBound = false;
  }

  _detachListeners() {
    if (!this._listenersBound) return;
    this._listenersBound = false;

    if (this._onMouseEnterAutoplay) this.sliderEl.removeEventListener('mouseenter', this._onMouseEnterAutoplay);
    if (this._onMouseLeaveAutoplay) this.sliderEl.removeEventListener('mouseleave', this._onMouseLeaveAutoplay);

    if (this._nextEl && this._onNextClick) this._nextEl.removeEventListener('click', this._onNextClick);
    if (this._prevEl && this._onPrevClick) this._prevEl.removeEventListener('click', this._onPrevClick);

    const card = this.sliderEl.closest('.card');
    if (card && this._onCardClickBlock) card.removeEventListener('click', this._onCardClickBlock, true);

    if (this._onSwatchChange) this.sliderEl.removeEventListener('color-swatch:change', this._onSwatchChange);

    if (this._onHoverLoad) this.sliderEl.removeEventListener('mouseenter', this._onHoverLoad);
    if (this._onHoverMove) this.sliderEl.removeEventListener('mousemove', this._onHoverMove);
    if (this._onHoverLeave) this.sliderEl.removeEventListener('mouseleave', this._onHoverLeave);

    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }

  updateSwiper() {
    if (!this.swiperInstance) return;
    this.swiperInstance.destroy(false, true);
    this.initializeSwiperInstance?.();
  }

  getAllSlides() {
    const template = this.sliderEl.querySelector('.all-product-card-images-template');
    if (!template || !template.content) return [];
    const allSlidesTemplate = template.content.cloneNode(true);
    return [...allSlidesTemplate.querySelectorAll('.swiper-slide')];
  }

  loadSlides() {
    const activeSwatch = this.sliderEl.closest('.card')?.querySelector('.active-swatch');

    if (this.showOnlyVariantsMedia && activeSwatch) {
      const activeSwatchColor = activeSwatch.dataset.colorName;
      const activeSwatchFirstMedia = parseNode(activeSwatch.dataset.firstMediaNode).dataset.id;
      this.showSlidesByVariant(activeSwatchColor, activeSwatchFirstMedia);
    } else {
      this.showAllSlides();
    }

    this.slidesLoaded = true;
  }

  adaptModelViewersSize() {
    requestAnimationFrame(() => {
      this.sliderEl.querySelectorAll('model-viewer').forEach(model => {
        const slide = model.closest('.swiper-slide');
        if (!slide) return;
        const rect = slide.getBoundingClientRect();
        model.style.height = `${rect.height}px`;
        model.style.width = `${rect.width}px`;
      });
    });
  }

  showAllSlides() {
    if (!this.allSlides) this.allSlides = this.getAllSlides();

    const sliderWrapper = this.sliderEl.querySelector('.swiper-wrapper');
    if (!sliderWrapper) return;

    const firstPreloadedSlide = this.sliderEl.querySelector('#card__product-image--1');

    if (firstPreloadedSlide) {
      const allSlidesWithoutFirst = this.allSlides.filter(slide => slide.dataset.id !== firstPreloadedSlide.dataset.id);
      sliderWrapper.append(...allSlidesWithoutFirst);
      this.adaptModelViewersSize();
      this.updateSwiper();
    } else {
      this.replaceSlides(sliderWrapper, this.allSlides);
    }

    this.sliderEl.style.setProperty('--total-slides', String(this.allSlides.length));
    this.slidesLoaded = true;
    this.firstSlideIndex = 0;
  }

  showSlidesByVariant(colorName, firstMediaId) {
    if (!this.allSlides) this.allSlides = this.getAllSlides();

    const sliderWrapper = this.sliderEl.querySelector('.swiper-wrapper');
    if (!sliderWrapper) return;

    let variantSlides = this.allSlides.filter(slide =>
      slide.dataset.swiperSlideAlt?.includes(`(${colorName})`) ||
      slide.dataset.swiperSlideAlt?.includes(`(${capitalizeFirstLetter(colorName)})`) ||
      slide.dataset.showSlide == 'true'
    );

    let firstSlideIndex = 0;

    if (!variantSlides.length) {
      const colorSwatchMedia = this.allSlides.find(slide => slide.dataset.id == firstMediaId);
      if (!colorSwatchMedia) {
        this.showAllSlides();
        return;
      }
      variantSlides = [colorSwatchMedia];
    }

    if (firstMediaId && variantSlides.length > 1) {
      const firstSlide = variantSlides.find(slide => slide.dataset.id == firstMediaId);
      if (firstSlide) firstSlideIndex = variantSlides.indexOf(firstSlide);
    }

    const freshSlides = variantSlides.map(s => s.cloneNode(true));
    this.replaceSlides(sliderWrapper, freshSlides);

    if (this.loop && this.swiperInstance) {
      this.swiperInstance.slideToLoop(firstSlideIndex, 0);
    } else {
      this.swiperInstance.slideTo(firstSlideIndex, 0);
    }

    this.sliderEl.style.setProperty('--total-slides', String(variantSlides.length));
    this.slidesLoaded = false;
    this.firstSlideIndex = firstSlideIndex;
  }

  replaceSlides(sliderWrapper, slides) {
    if (!this.swiperInstance) {
      sliderWrapper.replaceChildren(...slides);
      return;
    }

    const { pagination, navigation } = this.swiperInstance;
    sliderWrapper.replaceChildren(...slides);
    this.updateSwiper();

    if (slides.length == 1) {
      pagination.el?.classList.add('swiper-pagination-hidden');
      navigation.prevEl?.classList.add('swiper-button-hidden');
      navigation.nextEl?.classList.add('swiper-button-hidden');
    } else {
      pagination.el?.classList.remove('swiper-pagination-hidden');
      navigation.prevEl?.classList.remove('swiper-button-hidden');
      navigation.nextEl?.classList.remove('swiper-button-hidden');
    }
  }

  configureListeners() {
    if (!this.swiperInstance || this._listenersBound) return;
    this._listenersBound = true;

    this.isSliding = false;

    if (window.innerWidth > 768 && this.autoplay) {
      this._onMouseEnterAutoplay = () => {
        this.swiperInstance.params.autoplay = {
          delay: this.autoplaySpeed,
          disableOnInteraction: false
        };
        this.swiperInstance.autoplay.start();
      };
      this._onMouseLeaveAutoplay = () => {
        if (this.swiperInstance.autoplay?.running) this.swiperInstance.autoplay.stop();
      };

      this.sliderEl.addEventListener('mouseenter', this._onMouseEnterAutoplay);
      this.sliderEl.addEventListener('mouseleave', this._onMouseLeaveAutoplay);
    }

    if (this._nextEl) {
      this._onNextClick = () => {
        if (!this.slidesLoaded) this.loadSlides();
        setTimeout(() => this.swiperInstance.slideNext(), 50);
      };
      this._nextEl.addEventListener('click', this._onNextClick);
    }

    if (this._prevEl) {
      this._onPrevClick = () => {
        if (!this.slidesLoaded) this.loadSlides();
        setTimeout(() => this.swiperInstance.slidePrev(), 50);
      };
      this._prevEl.addEventListener('click', this._onPrevClick);
    }

    this.swiperInstance.on('sliderFirstMove', () => {
      const diffX = this.swiperInstance.touches.currentX - this.swiperInstance.touches.startX;
      const diffY = this.swiperInstance.touches.currentY - this.swiperInstance.touches.startY;

      if (!this.slidesLoaded) {
        this.loadSlides();

        let direction;
        if (Math.abs(diffX) > Math.abs(diffY)) {
          if (this.isRTL) {
            direction = diffX > 0 ? 'left' : 'right';
          } else {
            direction = diffX > 0 ? 'right' : 'left';
          }
        }

        setTimeout(() => {
          if (direction === undefined) return;
          direction === 'left'
            ? this.swiperInstance.slideNext(300)
            : this.swiperInstance.slidePrev(300);
        }, 50);
      }
    });

    this.swiperInstance.on('slideChange', (e) => {
      const enableAutoplayMedia = this.sliderEl.dataset.enableAutoplayMedia === "true";
      const currentSlide = e.slides[e.activeIndex]?.querySelector('.card__image');
      const previousSlide = e.slides[e.previousIndex]?.querySelector('.card__image');
      this.isSliding = true;

      setTimeout(() => { this.isSliding = false; }, 100);

      if (e.activeIndex !== e.previousIndex) {
        window.pauseMedia(previousSlide, enableAutoplayMedia);
      }
      window.playMedia(currentSlide, enableAutoplayMedia, true);
    });

    if (this.autoplay) {
      this.sliderEl.addEventListener('mouseenter', () => {
        if (!this.slidesLoaded) this.loadSlides();
      }, { passive: true });
    }

    const card = this.sliderEl.closest('.card');
    if (card) {
      this._onCardClickBlock = (e) => {
        if (this.isSliding) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      };
      card.addEventListener('click', this._onCardClickBlock, true);
    }

    this._onSwatchChange = (event) => {
      if (event.detail.colorName === 'all') this.showAllSlides();
      else this.showSlidesByVariant(event.detail.colorName, event.detail.firstMediaId);
      this.slidesLoaded = true;
    };
    this.sliderEl.addEventListener('color-swatch:change', this._onSwatchChange);
  }
}

class ProductCardSlider extends BaseProductCardSlider {
  initializeSwiperInstance() {
    this.swiperInstance = new Swiper(this.sliderEl, {
      ...this.swiperBaseConfiguration,
    });
  }
}

class ProductCardHoverGallery extends BaseProductCardSlider {
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  initializeSwiperInstance() {
    this.swiperInstance = new Swiper(this.sliderEl, {
      ...this.swiperBaseConfiguration,
      loop: false,
      allowTouchMove: this.isTouchDevice(),
      simulateTouch: this.isTouchDevice(),
    });
  }

  configureListeners() {
    super.configureListeners();

    this._onHoverLoad = () => {
      if (!this.slidesLoaded) this.loadSlides();
    };
    this.sliderEl.addEventListener('mouseenter', this._onHoverLoad, { passive: true });

    this._onHoverMove = (e) => {
      if (!this.swiperInstance) return;

      const totalSlidesCount = this.sliderEl.querySelectorAll('.swiper-slide').length;
      const sliderViewportWidth = this.sliderEl.offsetWidth;
      const rect = this.sliderEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const percentage = mouseX / sliderViewportWidth;

      let targetIndex = this.isRTL
        ? Math.floor((1 - percentage) * totalSlidesCount)
        : Math.floor(percentage * totalSlidesCount);

      this.swiperInstance.slideTo(targetIndex, 0);
    };
    this.sliderEl.addEventListener('mousemove', this._onHoverMove, { passive: true });

    this._onHoverLeave = () => {
      if (!this.swiperInstance) return;
      this.swiperInstance.slideTo(this.firstSlideIndex || 0, 0);
    };
    this.sliderEl.addEventListener('mouseleave', this._onHoverLeave, { passive: true });

    this._onResize = () => {
      if (!this.swiperInstance) return;
      this.swiperInstance.allowTouchMove = this.isTouchDevice();
      this.swiperInstance.simulateTouch = this.isTouchDevice();
    };
    window.addEventListener('resize', this._onResize, { passive: true });
  }
}

class ProductCardScrollGallery extends BaseProductCardSlider {
  initializeSwiperInstance() {
    this.swiperInstance = new Swiper(this.sliderEl, {
      ...this.swiperBaseConfiguration,
      loop: true,
      allowTouchMove: true,
      simulateTouch: true,
    });
  }

  configureListeners() {
    super.configureListeners();
    const loadWhenReady = () => {
      if (!this.slidesLoaded) this.loadSlides();
    };
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(loadWhenReady, { timeout: 2500 });
    } else {
      setTimeout(loadWhenReady, 2100);
    }
  }
}

class SwiperGallery extends HTMLElement {
  constructor() {
    super();

    this._instance = null;
    this._io = null;
    this._initScheduled = false;
    this._lazyObserversAttached = false;
    this._deferInitForClosedStories = false;

    this._onFirstIntent = this._onFirstIntent.bind(this);
    this._initNow = this._initNow.bind(this);
  }

  connectedCallback() {
    if (this.closest('.stories-slider.visually-hidden')) {
      this._deferInitForClosedStories = true;
      return;
    }
    this._attachLazyInitObservers();
  }

  _attachLazyInitObservers() {
    if (this._lazyObserversAttached) return;
    this._lazyObserversAttached = true;

    this.addEventListener('pointerenter', this._onFirstIntent, { once: true });
    this.addEventListener('pointerdown', this._onFirstIntent, { once: true });
    this.addEventListener('focusin', this._onFirstIntent, { once: true });
    this.addEventListener('touchstart', this._onFirstIntent, { once: true, passive: true });

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        const e = entries[0];
        if (e && e.isIntersecting) {
          this._io.disconnect();
          this._io = null;
          this._initNow();
        }
      }, { root: null, rootMargin: '300px 0px', threshold: 0.01 });

      this._io.observe(this);
    } else {
      this._initNow();
    }
  }

  resumeDeferredStoriesGalleryInit() {
    if (!this._deferInitForClosedStories) return;
    this._deferInitForClosedStories = false;
    this._attachLazyInitObservers();
  }

  disconnectedCallback() {
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
    if (this._instance) {
      this._instance.destroy();
      this._instance = null;
    }
  }

  _onFirstIntent() {
    this._initNow();
  }

  _initNow() {
    if (this._instance || this._initScheduled) return;
    this._initScheduled = true;

    this._initScheduled = false;

    if (this.classList.contains('swiper-product-card--scroll-gallery')) {
      this._instance = new ProductCardScrollGallery(this);
      this._instance.init();
      return;
    }

    if (this.classList.contains('swiper-product-card--slider')) {
      this._instance = new ProductCardSlider(this);
      this._instance.init();
      return;
    }

    if (this.classList.contains('swiper-product-card--hover-gallery')) {
      this._instance = new ProductCardHoverGallery(this);
      this._instance.init();
      return;
    }
  }
}
customElements.define('swiper-gallery', SwiperGallery);


function initStoriesSlideshow() {
  const storiesRunIdle = (fn, timeout = 1500) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout });
    } else {
      setTimeout(fn, 0);
    }
  };

  function playProductCardsMedia(container) {
    if (!container) return;
    container.querySelectorAll('product-card-image .card__image').forEach((media) => {
      playMedia(media);
    });
  }

  function pauseProductCardsMedia(container) {
    if (!container) return;
    container.querySelectorAll('product-card-image .card__image').forEach((media) => {
      pauseMedia(media);
    });
  }

  const STORY_DEFER_SRC = 'data-story-src';

  function deferStoryProductsPanelMedia(panel) {
    if (!panel || !panel.classList.contains('stories__products')) return;

    panel.querySelectorAll('video').forEach((video) => {
      const mainSrc = video.getAttribute('src');
      if (mainSrc && !video.hasAttribute(STORY_DEFER_SRC)) {
        video.setAttribute(STORY_DEFER_SRC, mainSrc);
        video.removeAttribute('src');
      }
      video.querySelectorAll('source').forEach((source) => {
        const src = source.getAttribute('src');
        if (src && !source.hasAttribute(STORY_DEFER_SRC)) {
          source.setAttribute(STORY_DEFER_SRC, src);
          source.removeAttribute('src');
        }
      });
      try {
        video.load();
      } catch (e) {}
    });

    panel.querySelectorAll('iframe').forEach((iframe) => {
      const src = iframe.getAttribute('src');
      if (src && !iframe.hasAttribute(STORY_DEFER_SRC)) {
        iframe.setAttribute(STORY_DEFER_SRC, src);
        iframe.removeAttribute('src');
      }
    });
  }

  function hydrateStoryProductsPanelMedia(panel) {
    if (!panel || !panel.classList.contains('stories__products')) return;

    panel.querySelectorAll('video').forEach((video) => {
      const backup = video.getAttribute(STORY_DEFER_SRC);
      if (backup) {
        video.setAttribute('src', backup);
        video.removeAttribute(STORY_DEFER_SRC);
      }
      video.querySelectorAll('source').forEach((source) => {
        const b = source.getAttribute(STORY_DEFER_SRC);
        if (b) {
          source.setAttribute('src', b);
          source.removeAttribute(STORY_DEFER_SRC);
        }
      });
      try {
        video.load();
      } catch (e) {}
    });

    panel.querySelectorAll(`iframe[${STORY_DEFER_SRC}]`).forEach((iframe) => {
      const backup = iframe.getAttribute(STORY_DEFER_SRC);
      if (backup) {
        iframe.setAttribute('src', backup);
        iframe.removeAttribute(STORY_DEFER_SRC);
      }
    });
  }

  function deferAllStoryProductsPanelsNotOpen(root) {
    if (!root) return;
    root.querySelectorAll('.stories__products:not(.open)').forEach(deferStoryProductsPanelMedia);
  }

  const STATE = new WeakMap();

  function getState(root) {
    let s = STATE.get(root);
    if (!s) {
      s = {
        inited: false,

        root,
        autoplaySpeed: 8000,

        mainSliderEl: null,
        storiesSlider: null,
        thumbnailsWrapper: null,

        thumbnails: [],
        slides: [],
        mainSwiper: null,
        innerSwipers: [],
        autoplayTimeout: null,
        autoplayRemainingTime: 0,
        autoplayStartTime: 0,

        holdTimeout: null,
        isHolding: false,
        wasHolding: false,
        swipe: false,
        onDocClick: null,
        onKeyUp: null,
        onResize: null,
        thumbsIO: null,
      };
      STATE.set(root, s);
    }
    return s;
  }

  function clearAutoplayTimeout(s) {
    if (s.autoplayTimeout) {
      clearTimeout(s.autoplayTimeout);
      s.autoplayTimeout = null;
    }
  }

  function resetBulletProgress(innerSwiper) {
    if (!innerSwiper?.el) return;
  
    const active = innerSwiper.el.querySelector('.swiper-pagination-bullet-active');
    if (!active) return;
  
    active.classList.remove('paused');
  
    active.classList.remove('swiper-pagination-bullet-active');
    void active.offsetWidth;
    active.classList.add('swiper-pagination-bullet-active');
  }

  function isOpen(s) {
    return !!(s.storiesSlider && s.storiesSlider.classList.contains('stories-slider-in'));
  }

  function closeStories(s) {
    if (!s) return;

    try {
      if (s.mainSwiper) {
        s.mainSwiper.autoplay?.stop?.();
        s.mainSwiper.allowTouchMove = false;
      }
    } catch (e) {}

    s.innerSwipers.forEach((sw) => {
      try {
        sw?.autoplay?.stop?.();
        sw.allowTouchMove = false;
      } catch (e) {}
    });

    clearAutoplayTimeout(s);

    if (s.storiesSlider) {
      s.storiesSlider.classList.remove('stories-slider-in');
      s.storiesSlider.classList.add('visually-hidden');
    }
    document.body.classList.remove('hidden');

    s.root.querySelectorAll('.stories__products.open').forEach((productsEl) => {
      productsEl.classList.remove('open');
      productsEl.closest('.swiper-story-inner')?.classList.remove('products-open');
      pauseProductCardsMedia(productsEl);
    });

    s.root.querySelectorAll('.stories__products').forEach(deferStoryProductsPanelMedia);

    s.root.querySelectorAll('.swiper-pagination-bullet.paused').forEach((b) => b.classList.remove('paused'));
  }

  function scheduleNextOuterSlideIfNeeded(s, innerSwiper, index) {
    clearAutoplayTimeout(s);
    s.autoplayRemainingTime = innerSwiper?.params?.autoplay?.delay || s.autoplaySpeed;
    s.autoplayStartTime = Date.now();

    s.autoplayTimeout = setTimeout(() => {
      const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
      const activeInnerSwiperEl = activeOuterSlide?.querySelector('.swiper-story-inner');
      const productsOpen = activeInnerSwiperEl?.querySelector('.stories__products.open');

      if (!productsOpen && innerSwiper?.isEnd) {
        handleNextSlide(s, index);
        try { innerSwiper.autoplay.stop(); } catch (e) {}
      }
    }, s.autoplayRemainingTime);
  }

  function delayedHandleNextSlide(s, innerSwiper, index) {
    if (!innerSwiper) return;
    if (innerSwiper._endTimeout) return;

    innerSwiper._endTimeout = true;
    scheduleNextOuterSlideIfNeeded(s, innerSwiper, index);

    setTimeout(() => { innerSwiper._endTimeout = false; }, 0);
  }

  function handleNextSlide(s, index) {
    if (!s.mainSwiper) return;
    if (!s.slides?.length) return;

    if (index < s.slides.length - 1) {
      s.mainSwiper.slideNext();
      const next = s.innerSwipers[index + 1];
      if (next) resetBulletProgress(next);
    } else {
      s.mainSwiper.slideTo(0, 0);
    }
  }

  function customAutoplayResume(s) {
    const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
    const activeInnerSwiperEl = activeOuterSlide?.querySelector('.swiper-story-inner');
    const activeInnerSwiper = activeInnerSwiperEl?.swiper;
    if (!activeInnerSwiper) return;

    activeInnerSwiper.params.autoplay.delay = s.autoplayRemainingTime || s.autoplaySpeed;
    activeInnerSwiper.autoplay.start();

    if (activeInnerSwiper.slides.length === 1) {
      clearAutoplayTimeout(s);
      s.autoplayRemainingTime = activeInnerSwiper.params.autoplay.delay;
      s.autoplayStartTime = Date.now();

      s.autoplayTimeout = setTimeout(() => {
        const productsOpen = activeInnerSwiperEl.querySelector('.stories__products.open');
        if (!productsOpen) {
          handleNextSlide(s, s.mainSwiper.realIndex);
        }
      }, s.autoplayRemainingTime);
    }
  }

  function ensureSwipersCreated(s) {
    if (s.mainSwiper && s.innerSwipers.length) return;

    s.mainSliderEl = s.root.querySelector('.swiper-stories');
    s.storiesSlider = s.root.querySelector('.stories-slider');
    s.slides = Array.from(s.root.querySelectorAll('.stories-slides'));

    if (!s.mainSliderEl || !s.storiesSlider || !s.slides.length) return;

    // Create main swiper
    s.mainSwiper = new Swiper(s.mainSliderEl, {
      slidesPerView: 'auto',
      centeredSlides: true,
      modules: [EffectCarousel],
      loop: false,
      effect: 'carousel',
      carouselEffect: {
        opacityStep: 0.33,
        scaleStep: 0.09,
        sideSlides: 8,
      },
      on: {
        slideChange: function () {
          const oldIndex = s.mainSwiper.previousIndex;
          const newIndex = s.mainSwiper.realIndex;

          const oldInner = s.innerSwipers[oldIndex];
          const nextInner = s.innerSwipers[newIndex];

          if (oldInner) {
            try {
              oldInner.autoplay.stop();
              oldInner.slideTo(0, 0);
            } catch (e) {}
          }

          if (!nextInner) return;

          nextInner.slideTo(0, 0);
          resetBulletProgress(nextInner);

          nextInner.params.autoplay.delay = s.autoplaySpeed;
          s.autoplayRemainingTime = s.autoplaySpeed;
          s.mainSliderEl.style.setProperty('--active-slide-duration', `${s.autoplaySpeed / 1000}s`);

          nextInner.autoplay.start();
          s.autoplayStartTime = Date.now();

          clearAutoplayTimeout(s);
          s.autoplayTimeout = setTimeout(() => {
            const activeOuterSlide = s.mainSwiper.slides[s.mainSwiper.activeIndex];
            const activeInnerSwiperEl = activeOuterSlide?.querySelector('.swiper-story-inner');
            const productsOpen = activeInnerSwiperEl?.querySelector('.stories__products.open');

            if (!productsOpen && nextInner.isEnd && s.mainSwiper.realIndex === newIndex) {
              handleNextSlide(s, newIndex);
            }
          }, s.autoplayRemainingTime);

          deferAllStoryProductsPanelsNotOpen(s.root);
        }
      }
    });

    // Create all inner swipers (HEAVY) — but only now, on user click/open
    s.innerSwipers = [];
    s.slides.forEach((slide, index) => {
      const innerEl = slide.querySelector('.swiper-story-inner');
      if (!innerEl) {
        s.innerSwipers.push(null);
        return;
      }

      const innerSwiper = new Swiper(innerEl, {
        slidesPerView: 1,
        spaceBetween: 0,
        loop: false,
        pagination: {
          el: innerEl.querySelector('.stories-slider-pagination'),
          type: 'bullets',
          clickable: true,
        },
        autoplay: {
          delay: s.autoplaySpeed,
          disableOnInteraction: false,
        },
        observer: true,
        observeParents: true,
        observeSlideChildren: true
      });

      s.innerSwipers.push(innerSwiper);

      innerSwiper.autoplay.stop();
      innerSwiper.allowTouchMove = false;

      let localAutoplayStartTime = null;
      innerSwiper.on('autoplayStart', () => { localAutoplayStartTime = Date.now(); });
      innerSwiper.on('autoplayStop', () => {
        if (!localAutoplayStartTime) return;
        const elapsed = Date.now() - localAutoplayStartTime;
        s.autoplayRemainingTime = innerSwiper.params.autoplay.delay - elapsed;
        if (s.autoplayRemainingTime < 0) s.autoplayRemainingTime = 0;
      });

      innerSwiper.on('slideChange', () => {
        const isActiveOuter = (s.mainSwiper.realIndex === index);
        if (!isActiveOuter) {
          innerSwiper.autoplay.stop();
          return;
        }

        s.mainSliderEl.style.setProperty('--active-slide-duration', `${s.autoplaySpeed / 1000}s`);
        innerSwiper.params.autoplay.delay = s.autoplaySpeed;

        resetBulletProgress(innerSwiper); 

        innerSwiper.autoplay.start();

        if (innerSwiper.slides.length === 1) {
          clearAutoplayTimeout(s);
          s.autoplayRemainingTime = innerSwiper.params.autoplay.delay;
          s.autoplayStartTime = Date.now();

          s.autoplayTimeout = setTimeout(() => {
            const productsOpen = slide.querySelector('.stories__products.open');
            if (!productsOpen) handleNextSlide(s, index);
          }, s.autoplayRemainingTime);
        } else if (innerSwiper.isEnd) {
          delayedHandleNextSlide(s, innerSwiper, index);
        }

        deferAllStoryProductsPanelsNotOpen(s.root);
      });

      // bind per-slide buttons & products
      slide.querySelectorAll('.swiper-slide').forEach((swSlide) => {
        swSlide.querySelector('.stories-slider-button-next')?.addEventListener('click', (e) => {
          if (s.wasHolding || s.swipe) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          !innerSwiper.isEnd ? innerSwiper.slideNext() : handleNextSlide(s, index);
        });

        swSlide.querySelector('.stories-slider-button-prev')?.addEventListener('click', (e) => {
          if (s.wasHolding) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          if (!innerSwiper.isBeginning) {
            innerSwiper.slidePrev();
          } else {
            s.mainSwiper.slidePrev();
            const prevInner = s.innerSwipers[s.mainSwiper.realIndex];
            if (prevInner) resetBulletProgress(prevInner);
          }
        });

        swSlide.querySelectorAll('.stories-slider-button').forEach((btn) => {
          btn.addEventListener('pointerdown', () => handleHoldStart(s, innerSwiper));
          btn.addEventListener('pointerup',   () => handleHoldEnd(s, innerSwiper));
        });

        const productTitle = swSlide.querySelector('.stories__products-title');
        const productsEl = swSlide.querySelector('.stories__products');

        productTitle?.addEventListener('click', () => {
          const isActiveOuter = (s.mainSwiper.realIndex === index);
          if (!isActiveOuter) return;

          productsEl?.classList.toggle('open');
          productsEl?.closest('.swiper-story-inner')?.classList.toggle('products-open');

          const bulletActive = swSlide.closest('.swiper-story-inner')
            ?.querySelector('.swiper-pagination-bullet-active');

          if (productsEl?.classList.contains('open')) {
            productsEl.style.transitionDelay = '0s';
            innerSwiper.autoplay.stop();
            bulletActive?.classList.add('paused');
            s.mainSwiper.allowTouchMove = false;
            hydrateStoryProductsPanelMedia(productsEl);
            playProductCardsMedia(productsEl);
          } else {
            bulletActive?.classList.remove('paused');
            customAutoplayResume(s);
            s.mainSwiper.allowTouchMove = true;

            setTimeout(() => {
              if (productsEl && productsEl.style.transitionDelay === '0s') {
                productsEl.style.removeProperty('transition-delay');
              }
            }, 100);

            pauseProductCardsMedia(productsEl);
            deferStoryProductsPanelMedia(productsEl);
            deferAllStoryProductsPanelsNotOpen(s.root);
          }
        });
      });
    });

    if (!s.onDocClick) {
      s.onDocClick = (e) => {
        if (!isOpen(s)) return;
        if (e.target.closest('.video-controls')) return;

        if (
          e.target.closest('.stories-slider-close-button') ||
          ((e.target.classList?.contains('swiper-stories') || e.target.classList?.contains('swiper-wrapper-stories')) &&
            !s.storiesSlider.querySelector('.products-open'))
        ) {
          closeStories(s);
          return;
        }

        const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
        if (!activeOuterSlide) return;

        const activeInnerEl = activeOuterSlide.querySelector('.swiper-story-inner');
        const activeInner = activeInnerEl?.swiper;
        if (!activeInner) return;

        const activeInnerSlide = activeInner.slides[activeInner.activeIndex];
        if (!activeInnerSlide) return;

        const productsEl = activeInnerSlide.querySelector('.stories__products');
        const bulletActive = activeInnerEl.querySelector('.swiper-pagination-bullet-active');

        const isClickInsideProducts = e.target.closest('.stories__products');
        const isClickOnTitle = e.target.closest('.stories__products-title');

        if (productsEl && productsEl.classList.contains('open') && !isClickInsideProducts && !isClickOnTitle) {
          productsEl.classList.remove('open');
          productsEl.closest('.swiper-story-inner')?.classList.remove('products-open');
          bulletActive?.classList.remove('paused');
          s.mainSwiper.allowTouchMove = true;
          customAutoplayResume(s);
          pauseProductCardsMedia(productsEl);
          deferStoryProductsPanelMedia(productsEl);
          deferAllStoryProductsPanelsNotOpen(s.root);
        }

        if (!e.target.closest('.stories-slider-button') && !e.target.closest('.stories__products') && !e.target.closest('.stories__products-title')) {
          const clicked = s.mainSwiper.clickedSlide;
          if (clicked && !clicked.classList.contains('swiper-slide-active')) {
            const idx = Array.from(s.mainSwiper.slides).indexOf(clicked);
            if (idx >= 0) s.mainSwiper.slideTo(idx, 300);
          }
        }
      };

      document.addEventListener('click', s.onDocClick, { passive: true });
    }

    if (!s.onKeyUp) {
      s.onKeyUp = (event) => {
        if (!isOpen(s)) return;
        if (event.code && event.code.toUpperCase() === 'ESCAPE') closeStories(s);
      };
      document.addEventListener('keyup', s.onKeyUp);
    }

    if (!s.onResize) {
      let resizeTimeout;
      s.onResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (!s.mainSwiper) return;
          try {
            s.mainSwiper.destroy(true, true);
          } catch (e) {}
          s.mainSwiper = null;

          storiesRunIdle(() => {
            s.mainSwiper = new Swiper(s.mainSliderEl, {
              slidesPerView: 'auto',
              centeredSlides: true,
              modules: [EffectCarousel],
              loop: false,
              effect: 'carousel',
              carouselEffect: {
                opacityStep: 0.33,
                scaleStep: 0.09,
                sideSlides: 8,
              },
              on: {
                slideChange: function () {
                  const oldIndex = s.mainSwiper.previousIndex;
                  const newIndex = s.mainSwiper.realIndex;

                  const oldInner = s.innerSwipers[oldIndex];
                  const nextInner = s.innerSwipers[newIndex];

                  if (oldInner) {
                    try { oldInner.autoplay.stop(); oldInner.slideTo(0, 0); } catch (e) {}
                  }

                  if (!nextInner) return;

                  nextInner.slideTo(0, 0);
                  resetBulletProgress(nextInner);

                  nextInner.params.autoplay.delay = s.autoplaySpeed;
                  s.autoplayRemainingTime = s.autoplaySpeed;
                  s.mainSliderEl.style.setProperty('--active-slide-duration', `${s.autoplaySpeed / 1000}s`);

                  const bulletActive = nextInner.el.querySelector('.swiper-pagination-bullet-active');
                  if (bulletActive) {
                    bulletActive.classList.remove('swiper-pagination-bullet-active');
                    void bulletActive.offsetWidth;
                    bulletActive.classList.add('swiper-pagination-bullet-active');
                  }

                  nextInner.autoplay.start();
                  s.autoplayStartTime = Date.now();

                  clearAutoplayTimeout(s);
                  s.autoplayTimeout = setTimeout(() => {
                    const activeOuterSlide = s.mainSwiper.slides[s.mainSwiper.activeIndex];
                    const activeInnerSwiperEl = activeOuterSlide?.querySelector('.swiper-story-inner');
                    const productsOpen = activeInnerSwiperEl?.querySelector('.stories__products.open');

                    if (!productsOpen && nextInner.isEnd && s.mainSwiper.realIndex === newIndex) {
                      handleNextSlide(s, newIndex);
                    }
                  }, s.autoplayRemainingTime);

                  deferAllStoryProductsPanelsNotOpen(s.root);
                }
              }
            });
          }, 1200);
        }, 200);
      };

      window.addEventListener('resize', s.onResize);
    }
  }

  function handleHoldStart(s, innerSwiper) {
    s.holdTimeout = setTimeout(() => {
      s.isHolding = true;
      s.wasHolding = true;

      const elapsed = Date.now() - s.autoplayStartTime;
      s.autoplayRemainingTime = Math.max(innerSwiper.params.autoplay.delay - elapsed, 0);

      innerSwiper.autoplay.pause();
      clearAutoplayTimeout(s);

      const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
      const activeInnerEl = activeOuterSlide?.querySelector('.swiper-story-inner');
      const bulletActive = activeInnerEl?.querySelector('.swiper-pagination-bullet-active');
      bulletActive?.classList.add('paused');

      s.mainSwiper.allowTouchMove = false;
    }, 200);
  }

  function handleHoldEnd(s, innerSwiper) {
    clearTimeout(s.holdTimeout);
    if (!s.isHolding) return;
    s.isHolding = false;

    const activeOuterSlide = s.mainSwiper?.slides?.[s.mainSwiper.activeIndex];
    const activeInnerEl = activeOuterSlide?.querySelector('.swiper-story-inner');
    const bulletActive = activeInnerEl?.querySelector('.swiper-pagination-bullet-active');

    s.mainSwiper.allowTouchMove = true;

    s.autoplayStartTime = Date.now();
    innerSwiper.autoplay.resume();
    bulletActive?.classList.remove('paused');

    setTimeout(() => { s.wasHolding = false; }, 150);
  }

  function openStoriesAtIndex(s, index) {
    if (!s.storiesSlider) s.storiesSlider = s.root.querySelector('.stories-slider');
    if (!s.storiesSlider) return;

    s.storiesSlider.classList.add('stories-slider-in');
    s.storiesSlider.classList.remove('visually-hidden');
    document.body.classList.add('hidden');

    queueMicrotask(() => {
      s.storiesSlider?.querySelectorAll('swiper-gallery').forEach((el) => {
        if (el && typeof el.resumeDeferredStoriesGalleryInit === 'function') {
          el.resumeDeferredStoriesGalleryInit();
        }
      });
    });

    ensureSwipersCreated(s);

    deferAllStoryProductsPanelsNotOpen(s.root);
    storiesRunIdle(() => {
      deferAllStoryProductsPanelsNotOpen(s.root);
    });

    if (!s.mainSwiper) return;

    // reset all inners
    s.innerSwipers.forEach((sw) => {
      if (!sw) return;
      try {
        sw.autoplay.stop();
        sw.slideTo(0, 0);
      } catch (e) {}
    });

    s.mainSwiper.slideTo(index, 0);

    const inner = s.innerSwipers[index];
    if (!inner) return;

    inner.slideTo(0, 0);
    resetBulletProgress(inner);
    inner.params.autoplay.delay = s.autoplaySpeed;

    if (!isOpen(s)) return;

    inner.autoplay.start();
    s.autoplayRemainingTime = inner.params.autoplay.delay;
    s.autoplayStartTime = Date.now();

    clearAutoplayTimeout(s);

    setTimeout(() => {
      if (!inner.slides?.length) return;

      if (inner.slides.length === 1) {
        s.autoplayTimeout = setTimeout(() => {
          const productsOpen = s.root.querySelector('.stories__products.open');
          if (!productsOpen) handleNextSlide(s, index);
        }, s.autoplayRemainingTime);
      } else if (inner.isEnd) {
        delayedHandleNextSlide(s, inner, index);
      }
    }, 100);
  }

  function setupThumbnailsAnimationIO(s) {
    if (!s.thumbnailsWrapper) return;

    if (s.thumbsIO) {
      try { s.thumbsIO.disconnect(); } catch (e) {}
      s.thumbsIO = null;
    }

    s.thumbsIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const thumbs = entry.target.querySelectorAll('.stories-slideshow__thumbnail');
        if (entry.isIntersecting) {
          thumbs.forEach((thumb, idx) => {
            setTimeout(() => thumb.classList.add('visible'), idx * 2000);
          });
        } else {
          thumbs.forEach((thumb) => thumb.classList.remove('visible'));
        }
      });
    }, { threshold: 0.9 });

    s.thumbsIO.observe(s.thumbnailsWrapper);
  }

  function initOne(root) {
    const s = getState(root);
    if (s.inited) return;
    s.inited = true;

    s.autoplaySpeed = Number(root.dataset.autoplaySpeed || 8000) || 8000;

    s.thumbnailsWrapper = root.querySelector('.stories-slideshow__thumbnails');
    s.thumbnails = Array.from(root.querySelectorAll('.stories-slideshow__thumbnail'));
    s.storiesSlider = root.querySelector('.stories-slider');

    if ('IntersectionObserver' in window) {
      setupThumbnailsAnimationIO(s);
    }

    s.thumbnails.forEach((thumbnail, index) => {
      thumbnail.addEventListener('click', (e) => {
        e.preventDefault();

        openStoriesAtIndex(s, index);
      }, { passive: false });
    });

    deferAllStoryProductsPanelsNotOpen(root);
  }

  document.querySelectorAll('.stories-slideshow').forEach((root) => {
    if (root.dataset.storiesInited === '1') return;
    root.dataset.storiesInited = '1';
    initOne(root);
  });
}

document.addEventListener('DOMContentLoaded', initStoriesSlideshow);
document.addEventListener('shopify:section:load', initStoriesSlideshow);

class AddToCart extends HTMLElement {
  constructor() {
    super();

    this.quickButton = this.querySelector('.quick') || this.closest('.quick');

    if (this.classList.contains('cart-drawer')) this.miniCart = document.querySelector('cart-drawer');
    if (this.classList.contains('cart-notification')) this.miniCart = document.querySelector('cart-notification');
   
    this.addEventListener('click', (event) => {
      event.preventDefault()
      if (this.querySelector('button[disabled]')) return
      this.onClickHandler(this)
    }) 
  }

  onClickHandler() {
    const variantId = this.dataset.variantId;

    if (variantId) {
      if (document.body.classList.contains('template-cart') ) {
        Shopify.postLink(window.routes.cart_add_url, {
          parameters: {
            id: variantId,
            quantity: 1
          },
        });
        return;
      }

      this.setAttribute('disabled', true);
      this.quickButton?.classList.add('loading');
      this.classList.add('loading');

      const sections = this.miniCart ? this.miniCart.getSectionsToRender().map((section) => section.id) : this.getSectionsToRender().map((section) => section.id);

      const body = JSON.stringify({
        id: variantId,
        quantity: 1,
        sections: sections,
        sections_url: window.location.pathname
      });

      fetch(`${window.routes.cart_add_url}`, { ...fetchConfig('javascript'), body })
        .then((response) => response.json())
        .then((parsedState) => {
          if (parsedState.status === 422) {
             document.dispatchEvent(new CustomEvent('ajaxProduct:error', {
                detail: {
                  errorMessage: parsedState.description
                }
              }));
           }
           else {
            this.miniCart && this.miniCart.renderContents(parsedState);
            this.renderContents(parsedState)
             document.dispatchEvent(new CustomEvent('ajaxProduct:added', {
              detail: {
                product: parsedState
              }
            }));
          }
        })
        .catch((e) => {
          console.error(e);
        })
        .finally(() => {
          this.quickButton?.classList.remove('loading');
          this.classList.remove('loading');
          this.removeAttribute('disabled');
        });
    }
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
  renderContents(parsedState) {
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section => {
      const sectionElements = document.querySelectorAll(section.selector);
      if(sectionElements) {
        Array.from(sectionElements).forEach(sectionElement => {
          sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
        })
      } 
    }));
  }
  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }
}
customElements.define('add-to-cart', AddToCart);

// This script works both for Slideshow section and for Anouncement bar
class SlideshowComponent extends HTMLElement {
  constructor() {
    super();
      this.debug = false;
      
          this.slideshow = this.querySelector('.slideshow__slider');
          this.fade = this.slideshow.classList.contains("animation-fade") ? true : false;
          this.data = this.slideshow.dataset;
          this.time = 500;
          this.posX1 
          this.posInit 
          this.posX2
          this.posY1
          this.posY2 
          this.posInitY
          this.swipeVertical
          this.swipeHorizontal
          this.init(this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.data.start? this.data.start : 1)+")"));
  
          if (Shopify.designMode) {
            document.addEventListener('shopify:section:load', (event) => {
              if (event.target.closest('.slideshow-section')) {
                this.init(this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.data.start? this.data.start : 1)+")"))
              }
            })
            document.addEventListener('shopify:section:reorder', () => {
              this.init(this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.data.start? this.data.start : 1)+")"))
            })
            document.addEventListener('shopify:block:select', (event) => {
              this.slideshow.querySelectorAll('.slideshow__slide').forEach(slide => {
                if (event.target.getAttribute('id') == slide.getAttribute('id')) this.init(slide)
              } )        
            })
          }
          
          this.controls = {
            "buttonNext": this.querySelector('.slideshow__controls--next'),
            "buttonPrev": this.querySelector('.slideshow__controls--prev'),
            "currentSlideNumber": this.querySelector('.slideshow__controls-current'),
            "slides": this.querySelectorAll('.slideshow__slide')
          };
          if (this.controls.buttonNext || this.controls.buttonPrev) {
            this.controls.buttonNext.addEventListener('click', () => {
              this.next('next')
              this.autoplay = this.data.autoplay ? this.data.autoplay : false
              if(this.autoplay) {
                this.stopAutoplay();
                this.start()
              }
            })
            this.controls.buttonPrev.addEventListener('click', () => {
              this.prev('prev')
              this.autoplay = this.data.autoplay ? this.data.autoplay : false
              if(this.autoplay) {
                this.stopAutoplay();
                this.start()
              }
            })
          }

          if (!this.data.autoplay) return
          this.querySelectorAll('.slideshow__content-js').forEach(content => {
            content.addEventListener('mouseenter', this.stopAutoplay.bind(this))
            content.addEventListener('mouseleave', this.start.bind(this))
          })
          if (this.controls.buttonNext || this.controls.buttonPrev) {
            this.controls.buttonNext.addEventListener('mouseenter', this.stopAutoplay.bind(this))
            this.controls.buttonPrev.addEventListener('mouseenter', this.stopAutoplay.bind(this))
          }
  }

  init(element) {   
      this.slideshow.querySelectorAll(".slideshow__slide").forEach(slide => {
        slide.classList.remove('loaded')
        slide.classList.remove('current')
        if (slide.querySelector('video')) slide.querySelector('video').pause()
        slide.classList.remove('before-load')
      })
      this.current = {
          "int": this.data.start? parseInt(this.data.start) : 1,
          "element": element
      }
      if (this.current.element && this.current.element.classList){ 
          this.current.element.classList.add("current");
          if (this.current.element.querySelector('video')) this.current.element.querySelector('video').play()
      }
      
      this.length = parseInt(this.slideshow.querySelectorAll(".slideshow__slide").length);

      this.autoplay = this.data.autoplay ? this.data.autoplay : false;
      this.timeout = null;
      if(this.autoplay) this.start();
      this.refreshControls()
      this.classList.add("slideshow-initialized");
  }

  prev(useAnimation = true){ 
    this.slideshow.querySelectorAll('.slideshow__slide').forEach(slide => slide.classList.remove('prev'))
      var temp = this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.current.int - 1)+")")
      if(temp){
        var prev = {
          "int": this.current.int - 1,
          "element": temp
        }
      } 
      else {
        var prev = {
          "int": this.length,
          "element": this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.length)+")")
        }
      }

      this.setPosition(prev, 'prev', useAnimation)
      this.refreshControls()
  }

  next(useAnimation = true){  
      var temp = this.slideshow.querySelector(".slideshow__slide:nth-child("+(this.current.int + 1)+")")
      if(temp)
          var next = {
              "int": this.current.int + 1,
              "element": temp
          }
      else
          var next = {
              "int": 1,
              "element": this.slideshow.querySelector(".slideshow__slide:nth-child(1)")
          }
      this.setPosition(next, 'next', useAnimation);
      this.refreshControls()
  }

  set(index, useAnimation = true){
      index = parseInt(index)
      var temp = this.slideshow.querySelector(`.slideshow__slide:nth-child(${index})`)
      if(temp){
          if(this.autoplay){
              this.stopAutoplay();
          }
          this.autoplay = false;
          this.setPosition({
              "int": index,
              "element": temp
          }, useAnimation);
      }
  }

  setPosition(to, direction){
    if(this.current.int != to.int) {
        this.stop();
        var after = function () {
          let arr = Array.from(this.slideshow.querySelectorAll('.slideshow__slide'))
            this.current.element.classList.remove("current");
            if (this.current.element.querySelector('video')) this.current.element.querySelector('video').pause()
            arr.forEach(slide => {
              slide.classList.add('animate')
              slide.classList.remove('prev', `direction-${direction}`)
            })
            if (this.current.element.querySelector(".slide-content.slide-background>img")) {
                this.current.element.querySelector(".slide-content.slide-background>img").style.removeProperty("transform");
            }
            to.element.classList.add("current");
            if (to.element.querySelector('video')) to.element.querySelector('video').play()
            this.current = to;

            if (this.querySelectorAll('.slideshow__button a').length > 0) this.querySelectorAll('.slideshow__button a').forEach(button => {
              button.closest('.current') ? button.setAttribute('tabindex', '0') : button.setAttribute('tabindex', '-1')
            })
            this.currentElementIndex = arr.indexOf(this.current.element)
            
            if (direction == 'next') {
              this.current.element.classList.add(`direction-${direction}`)
              if (this.currentElementIndex > 0) {
                this.prevElement = arr[this.currentElementIndex - 1]
                this.prevElement.classList.add(`direction-${direction}`)
              } else {
                this.prevElement = arr[arr.length - 1]
                this.prevElement.classList.add(`direction-${direction}`)
              }
            } else {
              this.current.element.classList.add(`direction-${direction}`)
              if (this.currentElementIndex == arr.length - 1) {
                this.prevElement = arr[0]
                this.prevElement.classList.add(`direction-${direction}`)
              } else {
                this.prevElement = arr[this.currentElementIndex + 1]
                this.prevElement.classList.add(`direction-${direction}`)
              }
            }
            if (this.slideshow.classList.contains('text-blocks')) this.slideshow.style.insetInlineStart = `calc(-100% * ${this.currentElementIndex})`
            if (this.prevElement.classList) this.prevElement.classList.add('prev')
            if(this.autoplay) this.start();
            this.lock = false;
            this.refreshControls()
        }.bind(this);
        after()
      }
  }

  start() {
      this.autoplay = this.data.autoplay ? this.data.autoplay : false;

      this.slideshow.classList.add("slideshow-playing");
      this.slideshow.classList.remove("slideshow-stopped");
      
      this.timeout = setTimeout(this.next.bind(this), this.autoplay);
      
  } 
  stop() {
      clearTimeout(this.timeout);
  }
  stopAutoplay(){
      if(this.slideshow.classList.contains("slideshow-playing")){
          this.slideshow.classList.add("slideshow-stopped");
          this.slideshow.classList.remove("slideshow-playing");
      }
      this.stop();
  }

  changeSlide(direction) {
    if (direction == 'next') {
      this.currentSlide = this.querySelector('.slideshow__slide.current')
      let index = Array.from(this.controls.slides).indexOf(this.currentSlide) + 1
  
      if (index < this.controls.slides.length) {
        this.set((index + 1));
        this.start();
      }
      else {
        this.set((1));
        this.start();
      }
      this.refreshControls()
    }
    if (direction == 'prev') {
      this.currentSlide = this.querySelector('.slideshow__slide.current')
      let index = Array.from(this.controls.slides).indexOf(this.currentSlide) + 1
  
      this.set((index + 1));
      if (index > 1) {
        this.set((index - 1));
        this.start();
      }
      else {
        this.set((this.controls.slides.length));
        this.start();
      }
      this.refreshControls()
    }
  }

  refreshControls() {
    this.currentSlide = this.querySelector('.slideshow__slide.current')
    this.currentSlideNumber = this.querySelector('.slideshow__controls-current')
    if (!this.currentSlideNumber) return
    this.currentSlideNumber.innerHTML = this.currentSlide.dataset.position
  }

  touchStart(event) {
    if (event.target.closest('.slideshow__controls--prev') || event.target.closest('.slideshow__controls--next')) return
    let evt = event.changedTouches[0];
    this.posInit = this.posX1 = evt.clientX;
    this.posInitY = this.posY1 = evt.clientY
  }

  touchMove(event) {
    if (event.target.closest('.slideshow__controls')) return
    let evt = event.changedTouches[0];
    this.posX2 = this.posX1 - evt.clientX;
    this.posX1 = evt.clientX;
    this.posY2 = this.posY1 - evt.clientY;
    this.posY1 = evt.clientY;
  }

  touchEnd(event) {
    if (event.target.closest('.slideshow__controls--prev') || event.target.closest('.slideshow__controls--next')) return
    let isHorizontalSwipe = Math.abs(this.posInit - this.posX1) > Math.abs(this.posInitY - this.posY1)
    let horizontalSwipeIsOk = Math.abs(this.posInit - this.posX1) > 50
    let swipeVertical = Math.abs(this.posInitY - this.posY1) > 80
    let swipeHorizontal = Math.abs(this.posInit - this.posX1) > 60
    if (isHorizontalSwipe && horizontalSwipeIsOk) {
      this.slideshow.removeEventListener('touchmove', this.touchMove.bind(this));
      this.slideshow.removeEventListener('touchend', this.touchEnd.bind(this));
      let posFinal = this.posInit - this.posX1;
      let direction = 'next'
      posFinal > 0 ? direction = 'next' : direction = 'previous'
      if (direction == 'next') {
        this.next('next')
        this.autoplay = this.data.autoplay ? this.data.autoplay : false
        if(this.autoplay) {
          this.stopAutoplay();
          this.start()
        }
      }
      if (direction == 'previous') {
        this.prev('prev')
        this.autoplay = this.data.autoplay ? this.data.autoplay : false
        if(this.autoplay) {
          this.stopAutoplay();
          this.start()
        }
      }
    }
  }
}
customElements.define('slideshow-component', SlideshowComponent);

class VariantSelects extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('change', (event) => this.handleProductUpdate(event));
    this.initializeProductSwapUtility();
    this.priceInsideButton = false
    this.sectionWrapper = this.closest(`section[data-section="${this.dataset.section}"]`) || this.closest(`#shopify-section-${this.dataset.section}`)

    const infoWrapper = this.closest('.product__info-wrapper');
    if (infoWrapper && infoWrapper.querySelector('.price-inside-button')) this.priceInsideButton = true

    this.addToCartIconHTML = '';
    if (document.querySelector('.product-sticky-cart')) {
      const addToCartIcon = this.sectionWrapper?.querySelector('.product-form__buttons-icon');
      if (addToCartIcon) {
        this.addToCartIconHTML = addToCartIcon.innerHTML;
      }
    }

    this.querySelectorAll('.color__swatch').forEach(colorSwatch => colorSwatch.addEventListener('mouseenter', (e) => this.alignSwatchTooltip(e))) 
    this.querySelectorAll('.color__swatch').forEach(colorSwatch => colorSwatch.addEventListener('touchstart', (e) => this.alignSwatchTooltip(e))) 
  }

  alignSwatchTooltip(e) {
    const colorSwatch = e.target;
    const tooltip = colorSwatch.querySelector('.color__swatch-tooltip');
    const viewport = colorSwatch.closest('.product');
    if(!tooltip) return

    tooltip.style.setProperty('--tooltip-arrow-left', 'auto');
    tooltip.style.setProperty('--tooltip-arrow-transform', 'none');
    tooltip.removeAttribute('style');

    if (tooltip && viewport && viewport.getBoundingClientRect().left >= tooltip.getBoundingClientRect().left) {
      tooltip.setAttribute('style', `right: calc(50% - ${(Math.abs(tooltip.getBoundingClientRect().left - viewport.getBoundingClientRect().left))}px);`);
      tooltip.style.setProperty('--tooltip-arrow-left', `${colorSwatch.getBoundingClientRect().width / 2}px`);
      tooltip.style.setProperty('--tooltip-arrow-transform', `translateX(-50%)`);
    }
  }

  initializeProductSwapUtility() {
    this.swapProductUtility = new HTMLUpdateUtility();
    this.swapProductUtility.addPreProcessCallback((html) => {
      return html;
    });
    this.swapProductUtility.addPostProcessCallback((newNode) => {
      window?.Shopify?.PaymentButton?.init();
      window?.ProductModel?.loadShopifyXR();
      publish(PUB_SUB_EVENTS.sectionRefreshed, {
        data: {
          sectionId: this.dataset.section,
          resource: {
            type: SECTION_REFRESH_RESOURCE_TYPE.product,
            id: newNode.querySelector('variant-selects').dataset.productId,
          },
        },
      });
    });
  }

  handleProductUpdate(event) {
    let loader 
    if (this.sectionWrapper.querySelector('.product-form__submit .loading-overlay__spinner')) loader = this.sectionWrapper.querySelector('.product-form__submit .loading-overlay__spinner').innerHTML
    const addButton = this.sectionWrapper.querySelector('.product-form__submit[name="add"]');
    if (addButton) addButton.innerHTML = `<div class="loading-overlay__spinner">${loader}</div>`
    this.handleFunctionProductUpdate(event)
    
    document.dispatchEvent(new CustomEvent('variant:change', {
      detail: {
        variant: this.currentVariant
      }
    }))
  }

  handleFunctionProductUpdate(event) {
    const input = this.getInputForEventTarget(event.target);
    const targetId = input.id;
    let targetUrl = input.dataset.productUrl;
    this.currentVariant = this.getVariantData(targetId);
    const sectionId = this.dataset.originalSection || this.dataset.section;
    this.updateSelectedSwatchValue(event);
    this.toggleAddButton(true, '', false);
    this.removeErrorMessage();

    let callback = () => {};
    if (!this.currentVariant) {
      this.toggleAddButton(true, '', true);
      this.setUnavailable();
      if(this.querySelector('.product-combined-listings')) callback = this.handleSwapProduct(sectionId, true)
    } else if (this.dataset.url !== targetUrl) {
      this.updateMedia();
      this.updateURL(targetUrl);
      this.updateVariantInput();
      this.querySelector('.product-combined-listings') ? callback = this.handleSwapProduct(sectionId) : callback = this.handleUpdateProductInfo(sectionId);
    }
    this.renderProductInfo(sectionId, targetUrl, targetId, callback);
  }

  updateSelectedSwatchValue({ target }) {
    const { value, tagName } = target;
    if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = target.closest(`.product-form__input`).querySelector('[data-selected-value]');
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
    }
  }

  updateMedia() {
    if (!this.currentVariant) return;
    if (this.currentVariant.featured_media) {
      const mediaGallery = document.getElementById(`MediaGallery-${this.dataset.section}`);
      mediaGallery.setActiveMedia(`${this.dataset.section}-${this.currentVariant.featured_media.id}`, true);
    } else if (!this.currentVariant.featured_media && this.sectionWrapper.querySelector('.product__media-list.variant-images')) {
      const mediaGallery = document.getElementById(`MediaGallery-${this.dataset.section}`);
      mediaGallery.setActiveMedia(`false`, true);
    }
    document.dispatchEvent(new CustomEvent('updateVariantMedia'))
  }

  updateURL(url) {
    if (this.dataset.updateUrl === 'false') return;
    window.history.replaceState({ }, '', `${url}${this.currentVariant?.id ? `?variant=${this.currentVariant.id}` : ''}`);
  }

  updateVariantInput() {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-${this.dataset.section}--alt, #product-form-installment`);
    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      if (!input) return;
      input.value = this.currentVariant ? this.currentVariant.id : ''
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  updatePickupAvailability() {
    const pickUpAvailability = this.sectionWrapper.querySelector('pickup-availability');
    if (!pickUpAvailability) return;
    if (this.currentVariant && this.currentVariant.available) {
      pickUpAvailability.fetchAvailability(this.currentVariant.id);
    } else {
      pickUpAvailability.removeAttribute('available');
      pickUpAvailability.innerHTML = '';
    }
  }

  getInputForEventTarget(target) {
    return target.tagName === 'SELECT' ? target.selectedOptions[0] : target;
  }

  getVariantData(inputId) {
    return JSON.parse(this.getVariantDataElement(inputId).textContent);
  }

  getVariantDataElement(inputId) {
    return this.querySelector(`script[type="application/json"][data-resource="${inputId}"]`);
  }

  removeErrorMessage() {
    const section = this.closest('section');
    if (!section) return;

    const productForm = section.querySelector('product-form');
    if (productForm) productForm.handleErrorMessage();
  }

  getWrappingSection(sectionId) {
    return (
      this.closest(`section[data-section="${sectionId}"]`) || // main-product
      this.closest(`#shopify-section-${sectionId}`) || // featured-product
      null
    );
  }

  handleSwapProduct(sectionId, unavailableProduct = false) {
    return (html) => {
      const oldContent = this.getWrappingSection(sectionId);
      if (!oldContent) {
        return;
      }
      document.getElementById(`ProductModal-${sectionId}`)?.remove();

      const response =
        html.querySelector(`section[data-section="${sectionId}"]`) /* main/quick-view */ ||
        html.getElementById(`shopify-section-${sectionId}`); /* featured product*/

      this.swapProductUtility.viewTransition(oldContent, response);
      this.updateCurrentVariant(html)
      this.updateVariantImage(html)
      if(unavailableProduct) {
        this.toggleAddButton(true, '', true);
        this.setUnavailable();
      } else {
        if (this.currentVariant) this.toggleAddButton(!this.currentVariant.available, variantStrings.soldOut);
      }
    };
  }

  handleUpdateProductInfo(sectionId) {
    return (html) => {
      this.updatePickupAvailability();
      this.updateSKU(html);
      this.updateStoreLocator(html);
      this.updatePrice(html);
      this.updatePriceAlt(html);
      this.updateCurrentVariant(html)
      this.updateVariantImage(html)
      this.updateColorName(html);
      this.updateInventoryStatus(html);
      if (this.currentVariant) this.toggleAddButton(!this.currentVariant.available, variantStrings.soldOut);
      this.updateOptionValues(html);
      this.updateProductUrl(html);
      publish(PUB_SUB_EVENTS.variantChange, {
        data: {
          sectionId,
          html,
          variant: this.currentVariant,
        },
      });
    };
  }

  updateOptionValues(html) {
    const variantSelects = html.querySelector('variant-selects');
    if (variantSelects) this.innerHTML = variantSelects.innerHTML;
  }

  getSelectedOptionValues() {
    const elements = this.querySelectorAll('select option[selected], fieldset input:checked');

    let selectedValues = Array.from(elements).map(
      (element) => element.dataset.optionValueId
    );

    this.optionsSize = this.dataset.optionsSize
    if (selectedValues.length < this.optionsSize) {
      const fieldsets = this.querySelectorAll('fieldset');
      fieldsets.forEach((fieldset) => {
        const checkedInput = fieldset.querySelector('input:checked');
        if (!checkedInput) {
          const fallbackInput = fieldset.querySelector('input[checked]');
          if (fallbackInput) {
            const value = fallbackInput.dataset.optionValueId;
            if (value && !selectedValues.includes(value)) selectedValues.push(value);
          }
        }
      });
    }

  return selectedValues;
  }

  renderProductInfo(sectionId, url, targetId, callback) {
    const variantParam = this.currentVariant?.id
    ? `variant=${this.currentVariant.id}`
    : '';

    if(!url) url = this.dataset.url
    const fetchUrl = variantParam
    ? `${url}?${variantParam}&section_id=${sectionId}`
    : `${url}?section_id=${sectionId}`;

    fetch(fetchUrl)
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        callback(html);
      })
      .then(() => {
        // set focus to last clicked option value
        const el = document.getElementById(targetId);
        if (el && document.activeElement !== el) {
          el.focus({ preventScroll: true });
        }
        const mediaGallery = document.getElementById(`MediaGallery-${sectionId}`);
        if (mediaGallery && typeof mediaGallery.alignActiveMediaAfterVariantPicker === 'function') {
          mediaGallery.alignActiveMediaAfterVariantPicker();
        }
      })
  }

  updateSKU(html) {
    const id = `sku-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
    if (!source && destination) destination.classList.add('visually-hidden')
  }

  updateStoreLocator(html) {
    const id = `store_locator-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
    if (!source && destination) destination.classList.add('visually-hidden')
  }

  updatePrice(html) {
    const id = `price-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateCurrentVariant(html) {
    const id = `current-variant-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateVariantImage(html) {
    const id = `variant-image-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updatePriceAlt(html) {
    const id = `price-${this.dataset.section}--alt`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateColorName(html) {
    const id = `color-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateInventoryStatus(html) {
    const id = `inventory-${this.dataset.section}`;
    const destination = document.getElementById(id);
    const source = html.getElementById(id);

    if (source && destination) destination.innerHTML = source.innerHTML;
    if (destination) destination.classList.remove('visually-hidden');
  }

  updateProductUrl(html) {
    const currentUrl = window.location.href;
    const id = `#product-url-${this.dataset.section} input`;
    const destination = document.querySelector(id);
    const source = html.querySelector(id);
    if (source && destination) destination.setAttribute('value', `${currentUrl}`);
    if (destination) destination.classList.remove('visually-hidden');
  }

  toggleAddButton(disable = true, text, modifyClass = true) {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-${this.dataset.section}--alt`);
    const loaderEl = this.sectionWrapper.querySelector('.loading-overlay__spinner');
    const loader = loaderEl ? loaderEl.innerHTML : '';
    productForms.forEach((productForm) => {
      const addButton = productForm.querySelector('[name="add"]');
      if (!addButton) return;

      let priceContent = ''
      const priceBlock = document.getElementById(`price-${this.dataset.section}`);
      if(this.priceInsideButton && priceBlock) {
        const priceEl = priceBlock.querySelector('.price');
        if (priceEl) priceContent = priceEl.innerHTML;
      }

      if (disable) {
        addButton.setAttribute('disabled', true);
        addButton.setAttribute('data-sold-out', true);
        if (text) addButton.innerHTML = `<span class="price-inside-button">${priceContent}</span><span>${text}</span><span class="product-form__buttons-icon">${this.addToCartIconHTML}</span> <div class="loading-overlay__spinner hidden">${loader}</div>`;      }
      else {
        addButton.removeAttribute('disabled');
        addButton.removeAttribute('data-sold-out');
        addButton.innerHTML = addButton.dataset.preOrder === 'true' ? `<span class="price-inside-button">${priceContent}</span><span>${variantStrings.preOrder}</span><span class="product-form__buttons-icon">${this.addToCartIconHTML}</span> <div class="loading-overlay__spinner hidden">${loader}</div>` : `<span class="price-inside-button">${priceContent}</span><span>${variantStrings.addToCart}</span><span class="product-form__buttons-icon">${this.addToCartIconHTML}</span> <div class="loading-overlay__spinner hidden">${loader}</div>`;
      }
      
      if (!modifyClass) return;
    });
  }

  setUnavailable() {
    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-${this.dataset.section}--alt`);
    const loaderEl = this.sectionWrapper.querySelector('.loading-overlay__spinner');
    const loader = loaderEl ? loaderEl.innerHTML : '';
    productForms.forEach((productForm) => {
      const addButton = productForm.querySelector('[name="add"]');
      if (!addButton) return;

      addButton.removeAttribute('data-sold-out');

      let priceContent = ''
      const priceBlock = document.getElementById(`price-${this.dataset.section}`);
      if(this.priceInsideButton && priceBlock) {
        const priceEl = priceBlock.querySelector('.price');
        if (priceEl) priceContent = priceEl.innerHTML;
      }

      addButton.innerHTML = `<span class="price-inside-button">${priceContent}</span><span>${variantStrings.unavailable}</span> <span class="product-form__buttons-icon">${this.addToCartIconHTML}</span> <div class="loading-overlay__spinner hidden">${loader}</div>`;

      const price = document.getElementById(`price-${this.dataset.section}`);
      if (price) price.classList.add('visually-hidden');

      const priceAlt = document.getElementById(`price-${this.dataset.section}--alt`);
      if (priceAlt) priceAlt.classList.add('visually-hidden');

      const inventory = document.getElementById(`inventory-${this.dataset.section}`);
      if (inventory) inventory.classList.add('visually-hidden');

      const sku = document.getElementById(`sku-${this.dataset.section}`);
      if (sku) sku.classList.add('visually-hidden');

      const storeLocator = document.getElementById(`store_locator${this.dataset.section}`);
      if (storeLocator) storeLocator.classList.add('visually-hidden');
    });
  }
}
customElements.define('variant-selects', VariantSelects);

class LinkedProducts extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 0
    });
  }

  init() {
    this.gridItem = this.closest('.slider__grid-item');
    this.gridHoverClass = 'is-swatch-hover';
    this.querySelectorAll('.linked-products__swatch').forEach(swatch => swatch.addEventListener('mouseenter', (e) => this.alignSwatchTooltip(e))) 
    this.querySelectorAll('.linked-products__swatch').forEach(swatch => swatch.addEventListener('touchstart', (e) => this.alignSwatchTooltip(e))) 
    this.querySelectorAll('.linked-products__swatch').forEach(swatch => swatch.addEventListener('mouseleave', this.onSwatchMouseLeave)) 
  }

  onSwatchMouseLeave = (e) => {
    const linkedProduct = e.currentTarget;
    const row = linkedProduct.closest('.linked-products__row');
    const tooltip =
      linkedProduct.querySelector('.color__swatch-tooltip') ||
      linkedProduct.querySelector('.linked-products__title') ||
      (row && row.querySelector('.color-swatch__title, .linked-products__title'));
    if (tooltip) tooltip.removeAttribute('style');

    if (!this.gridItem) return;
    this.gridItem.classList.remove(this.gridHoverClass);
  };

  alignSwatchTooltip(e) {
    const linkedProduct = e.currentTarget;
    const row = linkedProduct.closest('.linked-products__row');
    const tooltip =
      linkedProduct.querySelector('.color__swatch-tooltip') ||
      linkedProduct.querySelector('.linked-products__title') ||
      (row && row.querySelector('.color-swatch__title, .linked-products__title'));
    let viewport = linkedProduct.closest('.product');
    if (!viewport) {
      viewport =
        linkedProduct.closest('.slider__viewport') ||
        linkedProduct.closest('.component-tabs__content') ||
        linkedProduct.closest('.shopify-section');
    }
    if (!tooltip) return;

    tooltip.removeAttribute('style');

    requestAnimationFrame(() => {
      if (!viewport) return;
      const v = viewport.getBoundingClientRect();
      const t = tooltip.getBoundingClientRect();
      const lo = v.left - t.left;
      const hi = v.right - t.right;
      let shiftX;
      if (lo <= hi) {
        shiftX = Math.max(lo, Math.min(hi, 0));
      } else {
        shiftX = (v.left + v.right - t.left - t.right) / 2;
      }

      tooltip.style.setProperty('--tooltip-shift-x', `${shiftX}px`);
      if (shiftX !== 0) {
        tooltip.style.transform = `translateX(calc(50% + ${shiftX}px))`;
      }
    });

    if (!this.gridItem) return;
    this.gridItem.classList.add(this.gridHoverClass);
  }
}
customElements.define('linked-products', LinkedProducts);

class ProgressBar extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 0
    });
  }

  init() {
    setTimeout(() => {
      const quantity = parseInt(this.dataset.quantity);
      const totalQuantity = parseInt(this.dataset.total);
      this.style.setProperty('--progress-bar-width', `${quantity / totalQuantity * 100}%`);
    }, 300);
  }
}
customElements.define('progress-bar', ProgressBar);

class CountdownTimer extends HTMLElement {
  constructor() {
    super();

    this.endDate = this.getAttribute('end-date');
    this.endTime = this.getAttribute('end-time') || "00:00";
    this.timezoneOffset = this.getAttribute('timezone-offset');
    this.expirationAction = this.getAttribute('expiration-action');
    this.enableAnimation = this.getAttribute('enable-animation') === "true";
    this.sectionBlocksCount = this.getAttribute('section-blocks-count');
    this.sectionId = this.getAttribute('section-id');
    this.productHandle = this.getAttribute('product-handle');
    this.animationDuration = 300;

    this.timeState = {
      days: ['0', '0'],
      hours: ['0', '0'],
      minutes: ['0', '0'],
      seconds: ['0', '0']
    };

    this.elements = {};

    this.init = this.init.bind(this);
    this.updateTimer = this.updateTimer.bind(this);
  }

  connectedCallback() {
    requestAnimationFrame(this.init);
  }

  disconnectedCallback() {
    if (this.updateTimerIntervalId) clearInterval(this.updateTimerIntervalId);
  }

  async init() {
    if (this.updateTimerIntervalId) clearInterval(this.updateTimerIntervalId);

    if (!this.endDate && this.productHandle) {
      await this.fetchEndDateTimeAndMessage();
    }

    this.deadlineTimestamp = new Date(`${this.endDate}T${this.endTime}`).getTime();

    const isDateValid =
      /^\d{4}-\d{2}-\d{2}$/.test(this.endDate) && this.doesDateExist(this.endDate);
    const isTimeValid = /^\d{2}:\d{2}$/.test(this.endTime);

    const remainingTime = this.getRemainingTime(this.deadlineTimestamp);

    if (!isDateValid || !isTimeValid || !this.deadlineTimestamp || remainingTime.days > 99) {
      if (Shopify.designMode) {
        this.classList.add('countdown--visible');
      } else {
        this.hideCountdownTimer();
      }
      return;
    }

    this.cacheElements();

    if (remainingTime.total > 0) {
      this.updateTimer(true);
      this.updateTimerIntervalId = setInterval(this.updateTimer, 1000);
    } else {
      this.onTimerExpire();
    }

    this.classList.add('countdown--visible');
  }

  cacheElements() {
    const q = (selector) => this.querySelector(selector);

    const countdownTimer = q('#countdownTimer');
    const countdownCompleteMessage = q('#countdownCompleteMessage');

    const daysTens = q('#countdownDaysTens');
    const daysOnes = q('#countdownDaysOnes');
    const hoursTens = q('#countdownHoursTens');
    const hoursOnes = q('#countdownHoursOnes');
    const minutesTens = q('#countdownMinutesTens');
    const minutesOnes = q('#countdownMinutesOnes');
    const secondsTens = q('#countdownSecondsTens');
    const secondsOnes = q('#countdownSecondsOnes');

    this.elements = {
      timer: countdownTimer,
      message: countdownCompleteMessage,
      digits: {
        days: [daysTens, daysOnes],
        hours: [hoursTens, hoursOnes],
        minutes: [minutesTens, minutesOnes],
        seconds: [secondsTens, secondsOnes]
      }
    };
  }

  async fetchEndDateTimeAndMessage() {
    try {
      const response = await fetch(`/products/${this.productHandle}`);
      const html = await response.text();

      const parser = new DOMParser();
      const timerOnProductPage = parser.parseFromString(html, 'text/html').querySelector('.countdown');

      if (!timerOnProductPage) throw new Error('No timer found');

      const endDate = timerOnProductPage.getAttribute('end-date');
      const endTime = timerOnProductPage.getAttribute('end-time');

      this.setAttribute('end-date', endDate);
      this.setAttribute('end-time', endTime);

      const completeMessage = timerOnProductPage.getAttribute('complete-message');
      const completeMessageElement = this.querySelector('.countdown__complete-message');

      if (completeMessageElement) {
        completeMessageElement.innerHTML = completeMessage;
        this.setAttribute('complete-message', completeMessage);
      }

      this.endDate = endDate;
      this.endTime = endTime;

      this.deadlineTimestamp = new Date(`${this.endDate}T${this.endTime}`).getTime();
    } catch (err) {
      this.hideCountdownTimer();
    }
  }

  updateTimer(firstRun = false) {
    const remainingTime = this.getRemainingTime(this.deadlineTimestamp);

    if (remainingTime.total <= 0) {
      if (this.updateTimerIntervalId) clearInterval(this.updateTimerIntervalId);
      this.onTimerExpire();
      return;
    }

    const pad = (num) => num.toString().padStart(2, '0');

    const nextValues = {
      days: pad(remainingTime.days),
      hours: pad(remainingTime.hours),
      minutes: pad(remainingTime.minutes),
      seconds: pad(remainingTime.seconds)
    };

    if (!this.elements.digits) {
      this.cacheElements();
      if (!this.elements.digits) return;
    }

    Object.keys(nextValues).forEach((unit) => {
      const nextStr = nextValues[unit];
      const currentStr = this.timeState[unit].join('');

      if (firstRun || nextStr !== currentStr) {
        if (firstRun || nextStr[0] !== this.timeState[unit][0]) {
          this.animateDigit(
            this.elements.digits[unit][0],
            nextStr[0],
            this.timeState[unit][0],
            firstRun
          );
          this.timeState[unit][0] = nextStr[0];
        }

        if (firstRun || nextStr[1] !== this.timeState[unit][1]) {
          this.animateDigit(
            this.elements.digits[unit][1],
            nextStr[1],
            this.timeState[unit][1],
            firstRun
          );
          this.timeState[unit][1] = nextStr[1];
        }
      }
    });
  }

  animateDigit(wrapper, newValue, oldValue, skipAnimation) {
    if (!wrapper) return;

    const currentNumber = wrapper.querySelector('.countdown__number--current');
    if (!currentNumber) return;

    if (!this.enableAnimation || skipAnimation) {
      currentNumber.innerText = newValue;
      return;
    }

    const previousNumber = wrapper.querySelector('.countdown__number--previous');
    if (!previousNumber) {
      currentNumber.innerText = newValue;
      return;
    }

    previousNumber.innerText = oldValue;
    currentNumber.innerText = newValue;

    previousNumber.classList.add('countdown__number--animated');
    currentNumber.classList.add('countdown__number--animated');

    setTimeout(() => {
      previousNumber.classList.remove('countdown__number--animated');
      currentNumber.classList.remove('countdown__number--animated');
    }, this.animationDuration);
  }

  onTimerExpire() {
    switch (this.expirationAction) {
      case "hide_timer":
        this.hideCountdownTimer();
        break;

      case "show_message":
        const messageEl = this.elements.message || this.querySelector('#countdownCompleteMessage');

        if (!messageEl) {
          this.hideCountdownTimer();
          break;
        }

        const timerEl = this.elements.timer || this.querySelector('.countdown__timer');
        if (timerEl) timerEl.remove();

        messageEl.removeAttribute('hidden');
        break;

      case "show_zeros_and_message":
        {
          const msg = this.elements.message || this.querySelector('#countdownCompleteMessage');
          if (msg) msg.removeAttribute('hidden');

          this.updateTimer(true);
        }
        break;
    }

    if (this.updateTimerIntervalId) clearInterval(this.updateTimerIntervalId);
  }

  hideCountdownParent() {
    const sectionElement = document.getElementById('shopify-section-' + this.sectionId);
    if (!sectionElement) return;

    if (this.sectionBlocksCount === "1") {
      const sectionToRemovalTargetMap = {
        'rich-text': '.rich-text',
        'image-banner': '.banner__content',
        'section-newsletter': '.banner__content',
        'video-banner': '.banner__content',
        'media-with-text': '.ordinal-section:has(.media-with-text__media .placeholder-svg)',
      };

      for (const [sectionClass, removalTargetClass] of Object.entries(sectionToRemovalTargetMap)) {
        if (sectionElement.classList.contains(sectionClass)) {
          const targetElement = sectionElement.querySelector(removalTargetClass);
          targetElement?.remove();
        }
      }
    }

    const sectionToRemovalTargetMap = {
      'announcement-bar-section': '.slideshow__slide',
      'slideshow-section': '.slideshow__content',
    };

    for (const [sectionClass, removalTargetClass] of Object.entries(sectionToRemovalTargetMap)) {
      if (sectionElement.classList.contains(sectionClass)) {
        const targetElement = this.closest(removalTargetClass);

        if (targetElement && targetElement.children.length === 1) {
          targetElement.remove();
        }
      }
    }
  }

  hideCountdownTimer() {
    this.hideCountdownParent();

    setTimeout(() => {
      this.remove();
    });
  }

  getRemainingTime(deadline) {
    const total = deadline - this.getTimestampInStoreTimezone();

    if (total <= 0) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      total,
      seconds: Math.floor((total / 1000) % 60),
      minutes: Math.floor((total / 1000 / 60) % 60),
      hours: Math.floor((total / (1000 * 60 * 60)) % 24),
      days: Math.floor(total / (1000 * 60 * 60 * 24))
    };
  }

  getTimestampInStoreTimezone() {
    const match = this.timezoneOffset?.match(/([+-]?)(\d{2})(\d{2})/);

    if (!match) {
      console.error("Invalid timezone format:", this.timezoneOffset);
      return Date.now();
    }

    const now = new Date();
    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3], 10);
    const offsetMilliseconds = sign * ((hours * 60 + minutes) * 60000);
    const utcTimestamp = now.getTime() + now.getTimezoneOffset() * 60000;

    return utcTimestamp + offsetMilliseconds;
  }

  doesDateExist(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }
}

customElements.define('countdown-timer', CountdownTimer);

class AccordionBlock extends HTMLElement {
  constructor() {
    super();
    this.item = this.querySelector('.accordion-toggle')
    this.panel = this.querySelector('.accordion__panel')
    this.links = this.panel.querySelectorAll('a')
    this.textareas = this.panel.querySelectorAll('textarea')
    this.inputs = this.panel.querySelectorAll('input')
    this.selects = this.panel.querySelectorAll('select')
    this.buttons = this.panel.querySelectorAll('button')
    this.panelHeight
    this.item.addEventListener('mousedown', () => this.item.closest('body').classList.add('no-user-select'))
    this.item.addEventListener('mouseup', () => this.item.closest('body').classList.remove('no-user-select'))
    if (!this.item.classList.contains('is-open')) this.blurElements()
    if(this.closest('.snippet-facets--horizontal')) {
      document.addEventListener('click', (event) => {
        if (!event.target.closest('.accordion-toggle') && this.item.classList.contains('is-open')) this.item.classList.remove('is-open')
      })
    }

    if (this.item.classList.contains('js-filter')) {
      document.addEventListener('filters:rerendered', ()=> {
        if(this.closest('.snippet-facets--horizontal')) return
        let filters = this.querySelectorAll('.accordion-toggle')
        filters.forEach((filter) => {
          this.panel = filter.querySelector('.accordion__panel')
          this.panel.style.transitionDuration = '0s'
          if (!filter.classList.contains('is-open')) {
            this.panel.style.maxHeight = null
            this.panel.style.removeProperty('--max-height')
          } else {
            const sh = this.panel.scrollHeight
            if (sh > 0) {
              this.panel.style.setProperty('--max-height', `${sh}px`)
              this.panel.style.maxHeight = `${sh}px`
            } else {
              this.panel.style.maxHeight = 'none'
              this.panel.style.removeProperty('--max-height')
            }
          }
          setTimeout(() => {this.panel.style.transitionDuration = '0.3s'}, 100)
        })
      })

      if(this.item.className.includes('open_collapsible')) {
        if(this.panel.scrollHeight > 0) this.panel.style.maxHeight = this.panel.scrollHeight + "px"
      }

      this.item.addEventListener('click', (event) => {
        this.panel = this.querySelector('.accordion__panel')
        if(this.closest('.snippet-facets--horizontal')) {
          let facets = this.closest('.snippet-facets--horizontal')
          facets.querySelectorAll('.accordion-toggle').forEach(item => {
            if(item.classList.contains('is-open') && event.target.closest('.accordion-toggle') != item) item.classList.remove('is-open')
          })
        }
        if (!event.target.closest('.mobile-facets__summary')) return

        if(this.item.className.includes('open_collapsible') && this.item.className.includes('is-open') && !this.panel.style.maxHeight) {
          this.panelHeight = this.panel.scrollHeight + "px"
          this.panel.style.setProperty('--max-height', `${this.panelHeight}`)
          this.panel.style.maxHeight = this.panelHeight
        }

        this.item.classList.toggle('is-open')
        if(this.closest('.snippet-facets--horizontal')) return
        this.panelHeight = this.panel.scrollHeight + "px"
        
        this.panel.style.setProperty('--max-height', `${this.panelHeight}`)
        !this.item.classList.contains('is-open') ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panelHeight
        this.item.classList.contains('is-open') ? this.focusElements() : this.blurElements()
      })

      this.item.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          this.panel = this.querySelector('.accordion__panel')
          if(this.closest('.snippet-facets--horizontal')) {
            let facets = this.closest('.snippet-facets--horizontal')
            facets.querySelectorAll('.accordion-toggle').forEach(item => {
              if(item.classList.contains('is-open') && event.target.closest('.accordion-toggle') != item) item.classList.remove('is-open')
            })
          }
          if (event.target.closest('.accordion__panel')) return
          this.item.classList.toggle('is-open')
          if(this.closest('.snippet-facets--horizontal')) return
          this.panelHeight = this.panel.scrollHeight + "px"
          this.panel.style.setProperty('--max-height', `${this.panelHeight}`)
          !this.item.classList.contains('is-open') ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panelHeight
        }
        if (event.code.toUpperCase() === 'ESCAPE') {
          this.item.classList.remove('is-open')
          this.panel.style.maxHeight = null
        }
        this.item.classList.contains('is-open') ? this.focusElements() : this.blurElements()
      })
    } 
    else {
      this.item.querySelector('.accordion__summary > input[type="checkbox"]') ? this.accordionButton = this.item.querySelector('.accordion__summary > input[type="checkbox"]') : this.accordionButton = this.item.querySelector('.accordion__summary')
      if(this.item.className.includes('not_collapsible')) return

      if(this.item.className.includes('open_collapsible')) {
        this.panel.style.maxHeight = this.panel.scrollHeight + "px"
      }

      this.accordionButton.addEventListener('click', (event) => {
        if (this.closest('.store-accordion') && !event.target.closest('.icon-accordion')) {
          return;
        }
    
        !this.item.className.includes('is-open') ? this.item.classList.add('is-open') : this.item.classList.remove('is-open')
        this.panel.style.maxHeight ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panel.scrollHeight + "px"
        this.item.classList.contains('is-open') ? this.focusElements() : this.blurElements()
      })

      this.accordionButton.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') {
          if (this.closest('.store-accordion') && !event.target.closest('.icon-accordion')) {
            return;
          }
      
          !this.item.className.includes('is-open') ? this.item.classList.add('is-open') : this.item.classList.remove('is-open')
          this.panel.style.maxHeight ? this.panel.style.maxHeight = null : this.panel.style.maxHeight = this.panel.scrollHeight + "px"
        }
        if (event.code.toUpperCase() === 'ESCAPE') {
          if (this.closest('.store-accordion') && !event.target.closest('.icon-accordion')) {
            return;
          }
      
          this.item.classList.remove('is-open')
          this.panel.style.maxHeight = null
        }
        this.item.classList.contains('is-open') ? this.focusElements() : this.blurElements()
      })
    }

    this.querySelectorAll('.store-accordion__toggle-area').forEach(toggle => {
      toggle.addEventListener('click', (event) => {
        const checkbox = toggle.querySelector('.store-accordion__checkbox');

        if (event.target === checkbox) return;

        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }

  blurElements() {
    this.links.forEach(link => link.setAttribute('tabindex', '-1'))
    this.textareas.forEach(textarea => textarea.setAttribute('tabindex', '-1'))
    this.inputs.forEach(input => input.setAttribute('tabindex', '-1'))
    this.selects.forEach(select => select.setAttribute('tabindex', '-1'))
    this.buttons.forEach(button => button.setAttribute('tabindex', '-1'))
  }
  focusElements() {
    this.links.forEach(link => link.setAttribute('tabindex', '0'))
    this.inputs.forEach(input => input.setAttribute('tabindex', '0'))
    this.selects.forEach(select => select.setAttribute('tabindex', '0'))
    this.buttons.forEach(button => button.setAttribute('tabindex', '0'))
  }
}
customElements.define('accordion-block', AccordionBlock);

class ProductRecommendations extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);

      fetch(this.dataset.url)
        .then(response => response.text())
        .then(text => {
          const html = document.createElement('div');
          html.innerHTML = text;

          const recommendations = html.querySelector(`product-recommendations[data-parent="${this.dataset.parent}"]`) || html.querySelector('product-recommendations');

          if (recommendations && recommendations.innerHTML.trim().length) {
            this.innerHTML = recommendations.innerHTML;
            document.dispatchEvent(new CustomEvent('product-recommendations:load'));
          }

          if (!this.querySelector('slideshow-component') && this.classList.contains('complementary-products')) {
            this.remove();
          }

          this.classList.add('product-recommendations--loaded');
        })
        .catch(e => {
          console.error(e);
        });
    }

    new IntersectionObserver(handleIntersection.bind(this), {rootMargin: '0px 0px 400px 0px'}).observe(this);
  }
}
customElements.define('product-recommendations', ProductRecommendations);

class ComplementaryProducts extends HTMLElement {
  constructor() {
    super();

    this._mounted = false;
    this._inited = false;

    this.slider = null;
    this.sliderItems = null;
    this.prevButton = null;
    this.nextButton = null;

    this._io = null;
    this._initScheduled = false;

    this._onPrevClick = null;
    this._onNextClick = null;
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    this._armLazyInit();
  }

  disconnectedCallback() {
    this._mounted = false;

    this._disarmLazyInit();

    if (this._inited) {
      if (this.prevButton?.length && this._onPrevClick) {
        this.prevButton.forEach(btn => btn.removeEventListener('click', this._onPrevClick));
      }
      if (this.nextButton?.length && this._onNextClick) {
        this.nextButton.forEach(btn => btn.removeEventListener('click', this._onNextClick));
      }
    }

    this._inited = false;
    this._initScheduled = false;
    this.slider = null;
    this.sliderItems = null;
    this.prevButton = null;
    this.nextButton = null;
    this._onPrevClick = null;
    this._onNextClick = null;
  }

  _armLazyInit() {
    if (this._io) return;

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        const e = entries && entries[0];
        if (!e) return;
        if (e.isIntersecting) {
          this._disarmLazyInit();
          this._scheduleInit();
        }
      }, { root: null, rootMargin: '500px 0px', threshold: 0.01 });

      this._io.observe(this);
    } else {
      window.addEventListener('load', () => this._scheduleInit(), { once: true });
    }
  }

  _disarmLazyInit() {
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
  }

  _scheduleInit() {
    if (this._inited || this._initScheduled) return;
    this._initScheduled = true;

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

    this.slider = this.querySelector('[id^="Slider-"]');
    if (!this.slider) return;

    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.prevButton = this.querySelectorAll('button[name="previous"]');
    this.nextButton = this.querySelectorAll('button[name="next"]');

    this._onPrevClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onButtonClick('previous');
    };
    this._onNextClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onButtonClick('next');
    };

    if (this.prevButton?.length) {
      this.prevButton.forEach(button => button.addEventListener('click', this._onPrevClick));
    }
    if (this.nextButton?.length) {
      this.nextButton.forEach(button => button.addEventListener('click', this._onNextClick));
    }

    if (!this.slider.querySelector('.is-active')) {
      this.sliderItems?.[0]?.classList.add('is-active');
    }

    this.disableButtons();
  }

  disableButtons() {
    if (!this.prevButton || !this.nextButton) return;
    if (!this.sliderItems || !this.sliderItems.length) return;

    this.activeSlide = this.querySelector('.is-active');
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide);
    if (activeSlideIndex < 0) activeSlideIndex = 0;

    const nextActiveSlide = 1;

    activeSlideIndex > this.sliderItems.length - 1 - nextActiveSlide
      ? this.nextButton.forEach(button => button.setAttribute('disabled', 'disabled'))
      : this.nextButton.forEach(button => button.removeAttribute('disabled'));

    activeSlideIndex === 0
      ? this.prevButton.forEach(button => button.setAttribute('disabled', 'disabled'))
      : this.prevButton.forEach(button => button.removeAttribute('disabled'));
  }

  onButtonClick(direction) {
    if (!this.slider || !this.sliderItems || !this.sliderItems.length) return;

    this.activeSlide = this.slider.querySelector('.is-active');
    let activeSlideIndex = Array.from(this.sliderItems).indexOf(this.activeSlide);
    if (activeSlideIndex < 0) activeSlideIndex = 0;

    const dataCount = 1;
    const nextActiveSlide = dataCount;

    if (direction === 'next') {
      const lastIndex = this.sliderItems.length - 1;
      activeSlideIndex + nextActiveSlide > lastIndex
        ? activeSlideIndex = this.sliderItems.length - nextActiveSlide
        : activeSlideIndex = activeSlideIndex + nextActiveSlide;

      this.activeSlide?.classList.remove('is-active');
      this.sliderItems[activeSlideIndex]?.classList.add('is-active');
    }

    if (direction === 'previous') {
      activeSlideIndex - nextActiveSlide < 0
        ? activeSlideIndex = 0
        : activeSlideIndex = activeSlideIndex - nextActiveSlide;

      this.activeSlide?.classList.remove('is-active');
      this.sliderItems[activeSlideIndex]?.classList.add('is-active');
    }

    this.disableButtons();
  }
}
customElements.define('complementary-products', ComplementaryProducts);

class ProductRecentlyViewed extends HTMLElement {
  constructor() {
    super();
    
    // Save the product ID in local storage to be eventually used for recently viewed section
    if (isStorageSupported('local')) {
      const productId = parseInt(this.dataset.productId);
      const cookieName = 'avante-theme:recently-viewed';
      const items = JSON.parse(window.localStorage.getItem(cookieName) || '[]');

      // Check if the current product already exists, and if it does not, add it at the start
      if (!items.includes(productId)) {
        items.unshift(productId);
      }

      // By keeping only the 10 most recent
      window.localStorage.setItem(cookieName, JSON.stringify(items.slice(0, 10)));
    }
  }
}
customElements.define('product-recently-viewed', ProductRecentlyViewed);

class RecentlyViewedProducts extends HTMLElement {
  constructor() {
    super();

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    fetch(this.dataset.url + this.getQueryString())
      .then(response => response.text())
      .then(text => {
        const html = document.createElement('div');
        html.innerHTML = text;
        const recommendations = html.querySelector('recently-viewed-products');
        if (recommendations && recommendations.innerHTML.trim().length) {
          this.innerHTML = recommendations.innerHTML;
        }
        this.classList.add('recently-viewed-products--loaded');
      })
      .catch(e => {
        console.error(e);
      });
  }

  getQueryString() {
    const cookieName = 'avante-theme:recently-viewed';
    let items = JSON.parse(window.localStorage.getItem(cookieName) || "[]");
    items = items.filter(item => item != null)
    if (this.dataset.productId && items.includes(parseInt(this.dataset.productId))) {
      items.splice(items.indexOf(parseInt(this.dataset.productId)), 1);
    }
    return items.map((item) => "id:" + item).slice(0, 10).join(" OR ");
  }
}
customElements.define('recently-viewed-products', RecentlyViewedProducts);

class VideoSection extends HTMLElement {
  constructor() {
    super();

    this.background = this.dataset.initMode !== 'template';
    this.popup = this.closest('modal-dialog');
    this.isPopupOpen = false;
    this.observer = null;

    if (this.popup) {
      this.buttonClose = this.popup.querySelector('.close-popup');
      this.overlay = document.querySelector('body > .overlay');
      this.openPopup = this.popup.querySelector('.open-popup');
      this.bannersWrapper = this.openPopup?.closest('.banner__wrapper');
      this.videoButton = this.openPopup?.closest('.video-button-block');

      const closeHandler = () => {
        this.isPopupOpen = false;
        this.disconnectObserver();
        this.pauseMedia(true);
        this.hiddenVideoPopup();
      };

      const openHandler = () => {
        this.isPopupOpen = true;
        this.visuallyVideoPopup();
        this.playMedia();
      };

      this.buttonClose?.addEventListener('click', closeHandler);
      this.buttonClose?.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') closeHandler();
      });

      this.overlay?.addEventListener('click', closeHandler);

      this.openPopup?.addEventListener('click', openHandler);
      this.openPopup?.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ENTER') openHandler();
      });

      document.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'ESCAPE' && this.player) closeHandler();
      });
    }

    if (this.background) {
      theme.initWhenVisible({
        element: this,
        callback: this.init.bind(this),
        threshold: 600
      });
    } else {
      this.init();
    }
  }

  hiddenVideoPopup() {
    if (this.bannersWrapper) {
      this.bannersWrapper.style.zIndex = "1";
      if (!this.bannersWrapper.closest('.overlapping-section')) {
        this.bannersWrapper.style.overflow = "hidden";
      }
    }
    if (this.videoButton) this.videoButton.style.zIndex = "1";
  }

  visuallyVideoPopup() {
    if (this.bannersWrapper) {
      this.bannersWrapper.style.zIndex = "40";
      this.bannersWrapper.style.overflow = "visible";
    }
    if (this.videoButton) this.videoButton.style.zIndex = "40";
  }

  init() {
    this.parentSelector = this.dataset.parent || '.deferred-media';
    this.parent = this.closest(this.parentSelector);

    switch (this.dataset.type) {
      case 'youtube':
        this.initYoutubeVideo();
        break;
      case 'vimeo':
        this.initVimeoVideo();
        break;
      case 'mp4':
        this.initMp4Video();
        break;
    }
  }

  initYoutubeVideo() {
    window.loadScript('youtube').then(this.setupYoutubePlayer.bind(this));
  }

  initVimeoVideo() {
    window.loadScript('vimeo').then(this.setupVimeoPlayer.bind(this));
  }

  initMp4Video() {
    const player = this.querySelector('video');
    if (player) {
      const promise = player.play();
      if (typeof promise !== 'undefined') {
        promise.then(() => {}).catch(() => {
          player.setAttribute('controls', '');
        });
      }
    }
  }

  setAsLoaded() {
    if (this.parent) this.parent.setAttribute('loaded', true);
  }

  shouldAutoPlayNow() {
    if (this.background) return true;

    if (this.popup) return this.isPopupOpen;

    return true;
  }

  pauseMedia(muteToo = false) {
    if (!this.player) return;

    if (this.dataset.type === 'youtube') {
      if (muteToo && typeof this.player.mute === 'function') this.player.mute();
      if (typeof this.player.pauseVideo === 'function') this.player.pauseVideo();
      return;
    }

    if (this.dataset.type === 'vimeo') {
      if (muteToo && typeof this.player.setVolume === 'function') {
        this.player.setVolume(0).catch(() => {});
      }
      if (typeof this.player.pause === 'function') {
        this.player.pause().catch(() => {});
      }
      return;
    }

    if (typeof this.player.pause === 'function') this.player.pause();
  }

  playMedia() {
    if (!this.player) return;

    if (!this.shouldAutoPlayNow()) {
      this.pauseMedia(true);
      return;
    }

    if (this.dataset.type === 'youtube') {
      if (theme.config.isTouch && typeof this.player.mute === 'function') this.player.mute();
      if (!theme.config.isTouch && typeof this.player.unMute === 'function') this.player.unMute();
      if (typeof this.player.playVideo === 'function') this.player.playVideo();
      return;
    }

    if (this.dataset.type === 'vimeo') {
      if (theme.config.isTouch && typeof this.player.setMuted === 'function') {
        this.player.setMuted(true).catch(() => {});
      } else if (typeof this.player.setVolume === 'function') {
        this.player.setVolume(1).catch(() => {});
      }
      if (typeof this.player.play === 'function') {
        this.player.play().catch(() => {});
      }
      return;
    }

    if (typeof this.player.play === 'function') this.player.play();
  }

  disconnectObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  connectObserverIfPossible() {
    if (!this.background) return;
    if (!this.iframe) return;

    this.disconnectObserver();

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.playMedia();
        } else {
          this.pauseMedia(true);
        }
      });
    }, { rootMargin: '0px 0px 50px 0px' });

    this.observer.observe(this.iframe);
  }

  setupYoutubePlayer() {
    const videoId = this.dataset.videoId;

    const playerInterval = setInterval(() => {
      if (window.YT) {
        window.YT.ready(() => {
          const element = document.createElement('div');
          this.appendChild(element);

          this.player = new YT.Player(element, {
            videoId,
            playerVars: {
              showinfo: 0,
              controls: !this.background,
              fs: !this.background,
              rel: 0,
              height: '100%',
              width: '100%',
              iv_load_policy: 3,
              html5: 1,
              loop: 1,
              playlist: videoId,
              playsinline: 1,
              modestbranding: 1,
              disablekb: 1
            },
            events: {
              onReady: this.onYoutubeReady.bind(this),
              onStateChange: this.onYoutubeStateChange.bind(this)
            }
          });

          clearInterval(playerInterval);
        });
      }
    }, 50);
  }

  onYoutubeReady() {
    this.iframe = this.querySelector('iframe');
    if (this.iframe) {
      this.iframe.classList.add('js-youtube');
      this.iframe.setAttribute('tabindex', '-1');
    }

    if (this.shouldAutoPlayNow()) this.playMedia();
    else this.pauseMedia(true);

    this.setAsLoaded();
    this.connectObserverIfPossible();
  }

  onYoutubeStateChange(event) {
    if (!this.shouldAutoPlayNow()) {
      this.pauseMedia(true);
      return;
    }

    switch (event.data) {
      case -1:
        if (this.attemptedToPlay) this.setAsLoaded();
        break;
      case 0:
        this.playMedia();
        break;
      case 1:
        this.setAsLoaded();
        break;
      case 3:
        this.attemptedToPlay = true;
        break;
    }
  }

  setupVimeoPlayer() {
    const videoId = this.dataset.videoId;

    const playerInterval = setInterval(() => {
      if (window.Vimeo) {
        this.player = new Vimeo.Player(this, {
          id: videoId,
          autoplay: this.background,
          autopause: true,
          background: this.background,
          controls: !this.background,
          loop: true,
          height: '100%',
          width: '100%'
        });

        this.player.on('play', () => {
          if (this.popup && !this.isPopupOpen) {
            this.player.setVolume(0).catch(() => {});
            this.player.pause().catch(() => {});
          }
        });

        this.player.ready().then(this.onVimeoReady.bind(this));
        clearInterval(playerInterval);
      }
    }, 50);
  }

  onVimeoReady() {
    this.iframe = this.querySelector('iframe');
    if (this.iframe) {
      this.iframe.classList.add('js-vimeo');
      this.iframe.setAttribute('tabindex', '-1');
    }

    if (this.shouldAutoPlayNow()) this.playMedia();
    else this.pauseMedia(true);

    this.setAsLoaded();
    this.connectObserverIfPossible();
  }
}

customElements.define('video-section', VideoSection);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();

    this.poster = null;
    this.popupVideo = null;
    this.swipeVertical = false;
    this.swipeHorizontal = false;
    this.enableAutoplay = false;
    this.mediaVisibilityWhenScrollByInMs = 300;
    this._mounted = false;
    this._firstVisibleObserver = null;
    this._visibilityObserver = null;
    this._pauseObserver = null;

    this._firstVisibleTimer = null;
    this._autoplayTriggered = false;

    this._onPosterClick = this._onPosterClick.bind(this);
    this._onPosterKeydown = this._onPosterKeydown.bind(this);

    this._onPosterDown = this.swipeStart.bind(this);
    this._onPosterMove = this.swipeAction.bind(this);
    this._onPosterUp   = this.swipeEnd.bind(this);
  }

  connectedCallback() {
    if (this._mounted) return;
    this._mounted = true;

    this.poster = this.querySelector('[id^="Deferred-Poster-"]');
    this.popupVideo = this.querySelector('.popup-video');
    this.enableAutoplay = this.dataset.enableAutoplay === "true";

    if (this.poster) {
      this.poster.addEventListener('click', this._onPosterClick);
      this.poster.addEventListener('mousedown', this._onPosterDown);
      this.poster.addEventListener('mousemove', this._onPosterMove);
      this.poster.addEventListener('mouseup', this._onPosterUp);
      this.poster.addEventListener('keydown', this._onPosterKeydown);
    }

    if (this.enableAutoplay) {
      this.autoplayMediaWhenFirstVisible();
    }
  }

  disconnectedCallback() {
    this._mounted = false;

    if (this.poster) {
      this.poster.removeEventListener('click', this._onPosterClick);
      this.poster.removeEventListener('mousedown', this._onPosterDown);
      this.poster.removeEventListener('mousemove', this._onPosterMove);
      this.poster.removeEventListener('mouseup', this._onPosterUp);
      this.poster.removeEventListener('keydown', this._onPosterKeydown);
    }

    if (this._firstVisibleTimer) {
      clearTimeout(this._firstVisibleTimer);
      this._firstVisibleTimer = null;
    }

    if (this._firstVisibleObserver) {
      this._firstVisibleObserver.disconnect();
      this._firstVisibleObserver = null;
    }
    if (this._visibilityObserver) {
      this._visibilityObserver.disconnect();
      this._visibilityObserver = null;
    }
    if (this._pauseObserver) {
      this._pauseObserver.disconnect();
      this._pauseObserver = null;
    }
  }

  getObserverOptions(_targetElement) {
    return { threshold: 0.5 };
  }

  autoplayMediaWhenFirstVisible() {
    const mediaWrapper = this.closest('.product__media-item');
    if (!mediaWrapper) return;
    if (!('IntersectionObserver' in window)) return;
    if (this._autoplayTriggered) return;

    if (this._firstVisibleObserver) {
      this._firstVisibleObserver.disconnect();
      this._firstVisibleObserver = null;
    }

    this._firstVisibleObserver = new IntersectionObserver((entries, observerInstance) => {
      const entry = entries && entries[0];
      if (!entry) return;

      if (entry.isIntersecting) {
        if (!this._firstVisibleTimer) {
          this._firstVisibleTimer = setTimeout(() => {
            this._firstVisibleTimer = null;
            if (this._autoplayTriggered) return;

            this._autoplayTriggered = true;
            this._autoplayLoadLikeClick();
            observerInstance.unobserve(mediaWrapper);
            observerInstance.disconnect();
            this._firstVisibleObserver = null;
          }, 500);
        }
      } else {
        if (this._firstVisibleTimer) {
          clearTimeout(this._firstVisibleTimer);
          this._firstVisibleTimer = null;
        }
      }
    }, this.getObserverOptions(mediaWrapper));

    this._firstVisibleObserver.observe(mediaWrapper);
  }

  _autoplayLoadLikeClick() {
    this.loadContent(false);

    const buttonStop = this.querySelector('.stop-video');
    if (!buttonStop) return;

    if (this.closest('.product__media-item')) {
      this.closest('.product__media-item').style.overflow = 'visible';
    }

    buttonStop.style.display = 'flex';

    if (!buttonStop._dmBound) {
      buttonStop._dmBound = true;
      buttonStop.addEventListener('click', this.handleStopButtonClick.bind(this));
    }
  }

  setPauseMediaWhenNotVisible(media, mediaWrapperToObserve) {
    const target = mediaWrapperToObserve || media;
    if (!target) return;
    if (!('IntersectionObserver' in window)) return;

    if (this._pauseObserver) this._pauseObserver.disconnect();

    this._pauseObserver = new IntersectionObserver((entries) => {
      const entry = entries && entries[0];
      if (!entry) return;

      if (entry.isIntersecting) {
        media.dataset.visible = 'true';
      } else if (media.dataset.visible === 'true') {
        window.pauseMedia(media);
        media.dataset.visible = 'false';
      }
    }, this.getObserverOptions(target));

    this._pauseObserver.observe(target);
  }

  observeMediaVisibility(media, mediaWrapperToObserve) {
    const target = mediaWrapperToObserve || media;
    if (!target) return;
    if (!('IntersectionObserver' in window)) return;

    media.dataset.visible = 'true';

    if (this._visibilityObserver) this._visibilityObserver.disconnect();

    this._visibilityObserver = new IntersectionObserver((entries) => {
      const entry = entries && entries[0];
      if (!entry) return;

      if (entry.isIntersecting) {
        if (!target._intersectTimeout) {
          target._intersectTimeout = setTimeout(() => {
            target._intersectTimeout = null;
            window.playMedia(media, this.enableAutoplay);
            media.dataset.visible = 'true';
          }, this.mediaVisibilityWhenScrollByInMs);
        }
      } else {
        if (target._intersectTimeout) {
          clearTimeout(target._intersectTimeout);
          target._intersectTimeout = null;
        }

        if (media.dataset.visible === 'true') {
          window.pauseMedia(media, this.enableAutoplay);
          media.dataset.visible = 'false';
        }
      }
    }, this.getObserverOptions(target));

    this._visibilityObserver.observe(target);
  }

  loadContent(focus = true) {
    const isProductOverviewSection = !!this.closest('.product-overview-section');
    if (!isProductOverviewSection) {
      window.pauseAllMedia();
    }

    if (this.getAttribute('loaded')) return;
    if (this.querySelector('.template-video')) return;

    const template = this.querySelector('template');
    if (!template?.content?.firstElementChild) return;

    const content = document.createElement('div');
    content.classList.add('template-video');

    const media = template.content.firstElementChild.cloneNode(true);
    content.appendChild(media);

    if (content.querySelector('video-section')) {
      (this.popupVideo ? this.popupVideo.appendChild(content) : this.appendChild(content));
      if (focus) (this.popupVideo || this).focus();
    } else {
      const deferredElement = this.appendChild(content.querySelector('video, model-viewer, iframe'));
      this.setAttribute('loaded', true);
      if (focus && deferredElement) deferredElement.focus();
    }

    const mediaWrapper = this.closest('.product__media-item') || template.closest('.product__media-item');

    if (mediaWrapper) {
      if (this.enableAutoplay) {
        this.observeMediaVisibility(media, mediaWrapper);
      } else {
        this.setPauseMediaWhenNotVisible(media, mediaWrapper);
      }
    }

    window.playMedia(media, this.enableAutoplay);
  }

  _onPosterClick(event) {
    event.preventDefault();
  }

  _onPosterKeydown(event) {
    if (event.code && event.code.toUpperCase() === 'ENTER') this.swipeEnd();
  }

  getEvent(event) {
    return event.type.search('touch') !== -1 ? event.touches[0] : event;
  }

  swipeStart(event) {
    event.preventDefault();

    const evt = this.getEvent(event);
    this.posInit = this.posX1 = evt.clientX;
    this.posInitY = this.posY1 = evt.clientY;
  }

  swipeAction(event) {
    const evt = this.getEvent(event);
    this.posX2 = this.posX1 - evt.clientX;
    this.posX1 = evt.clientX;
    this.posY2 = this.posY1 - evt.clientY;
    this.posY1 = evt.clientY;
  }

  swipeEnd() {
    this.swipeVertical = Math.abs(this.posInitY - this.posY1) > 20;
    this.swipeHorizontal = Math.abs(this.posInit - this.posX1) > 20;

    if (!this.swipeVertical && !this.swipeHorizontal) {
      this.loadContent();

      const buttonStop = this.querySelector('.stop-video');
      if (!buttonStop) return;

      if (this.closest('.product__media-item')) this.closest('.product__media-item').style.overflow = 'visible';

      buttonStop.style.display = 'flex';

      if (!buttonStop._dmBound) {
        buttonStop._dmBound = true;
        buttonStop.addEventListener('click', this.handleStopButtonClick.bind(this));
      }
    }
  }

  handleStopButtonClick() {
    const media = this.querySelector('iframe');
    media?.remove();

    if (getMediaType(media) === 'YOUTUBE') {
      removeYoutubePlayer(media.id);
    }

    this.removeAttribute('loaded');

    if (this.closest('.product__media-item')) this.closest('.product__media-item').style.overflow = 'hidden';

    const buttonStop = this.querySelector('.stop-video');
    if (buttonStop) buttonStop.style.display = 'none';
  }
}
customElements.define('deferred-media', DeferredMedia);

class DoubleHover extends HTMLElement {
  constructor() {
    super();
    // Link defocus animation when hovered over a link inside it
    this.cardLink = this.querySelector('.double-hover');
    this.elementsHover = this.querySelectorAll('.elem-hover')
    this.richtext = this.querySelectorAll('.richtext')
    if (this.richtext) {
      this.richtext.forEach(item => {
        if (item.querySelectorAll('a')) {
          item.querySelectorAll('a').forEach(link => {
          link.addEventListener('mouseleave', () => link.closest('.double-hover').classList.remove('no-hover'))
          link.addEventListener('mouseenter', () => link.closest('.double-hover').classList.add('no-hover'))
        })
        }
      })
    } 
    if (this.elementsHover) {
      this.elementsHover.forEach(item => {
        // Return hover effect to parent link if we move mouse away from child link
        item.addEventListener('mouseleave', () => {
          this.cardLink.classList.remove('no-hover');
          if(item.classList.contains('disabled')) this.cardLink.style.cursor = 'pointer'
        })
        // If we hover over the child link, we add class to parent link to cancel hover effect on it
        item.addEventListener('mouseenter', () => {
          this.cardLink.classList.add('no-hover');
          if(item.classList.contains('disabled')) this.cardLink.style.cursor = 'default'
        }) 
        if(item.classList.contains('disabled')) {
          item.addEventListener('click', event => event.preventDefault())
        }
      })
    } 
  }
}
customElements.define('double-hover', DoubleHover);

class MediaTabs extends HTMLElement {
  constructor() {
    super()

    this._boundChangeActiveTab = this.changeActiveTab.bind(this)
    this._boundOnTabsKeydown = this.onTabsKeydown.bind(this)

    this._onBlockSelect = (event) => {
      const activeTab = event.target
      const activeTabId = activeTab?.getAttribute?.('id')

      if (!activeTabId) return
      if (!this.closest('section')?.querySelector(`#${activeTabId}`)) return

      this.refreshElements()

      this.tabs.forEach(tab => tab.classList.remove('active'))
      if (this.allMedia.length > 0) this.allMedia.forEach(media => this.hiddenContentPrevActiveTab(media))
      if (this.contents.length > 0) this.contents.forEach(content => this.hiddenContentPrevActiveTab(content))

      activeTab.classList.add('active')

      let activeElemID = activeTabId
      if (activeTab.closest('.tab-media-js')) activeElemID = activeElemID.split('media-')[1]

      if (this.closest('.media-with-tabs')) {
        document.getElementById(activeElemID)?.classList.add('active')
      }

      if (this.allMedia.length > 0) {
        this.allMedia.forEach(media => this.visibleElementActiveTab(media, activeElemID))
      }

      if (this.contents.length > 0) {
        this.contents.forEach(content => this.visibleElementActiveTab(content, activeElemID))
      }

      this.syncAccessibility()
    }
  }

  connectedCallback() {
    this.refreshElements()

    if (this.closest('.tabs-container-js.predictive-search-results')) {
      if (this.tabs.length > 0) this.tabs[0].classList.add('active')
      if (this.contents.length > 0) this.contents[0].classList.add('active')
    }

    if (this.allMedia.length > 0) {
      this.allMedia.forEach(media => {
        if (media.querySelector('video') && !media.classList.contains('active')) {
          media.querySelector('video').pause()
        }
      })
    }

    this.contents.forEach(content => {
      if (!content.classList.contains('active')) this.hiddenContentPrevActiveTab(content)
    })

    this.allMedia.forEach(media => {
      if (!media.classList.contains('active')) this.hiddenContentPrevActiveTab(media)
    })

    if (!this._mediaTabsListenersAttached) {
      this.addEventListener('click', this._boundChangeActiveTab)
      this.addEventListener('keydown', this._boundOnTabsKeydown)
      document.addEventListener('shopify:block:select', this._onBlockSelect)
      this._mediaTabsListenersAttached = true
    }

    this.syncAccessibility()
  }

  disconnectedCallback() {
    if (this._mediaTabsListenersAttached) {
      this.removeEventListener('click', this._boundChangeActiveTab)
      this.removeEventListener('keydown', this._boundOnTabsKeydown)
      document.removeEventListener('shopify:block:select', this._onBlockSelect)
      this._mediaTabsListenersAttached = false
    }
  }

  refreshElements() {
    const container = this.closest('.tabs-container-js')

    this.tabs = this.querySelectorAll('.tab-js')
    this.allMedia = container ? container.querySelectorAll('.tab-media-js') : []
    this.contents = container ? container.querySelectorAll('.tab-content-js') : []
  }

  syncAccessibility() {
    this.refreshElements()

    this.tabs.forEach(tab => {
      const isSelected = tab.classList.contains('active')
      const tabId = tab.getAttribute('id')

      tab.setAttribute('aria-selected', isSelected ? 'true' : 'false')
      tab.setAttribute('tabindex', isSelected ? '0' : '-1')

      if (!tabId) return

      const contentPanel = this.closest('.tabs-container-js')?.querySelector(`#content-${tabId}`)
      const mediaPanel = this.closest('.tabs-container-js')?.querySelector(`#media-${tabId}`)

      if (contentPanel) {
        contentPanel.setAttribute('aria-hidden', contentPanel.classList.contains('active') ? 'false' : 'true')
      }

      if (mediaPanel) {
        mediaPanel.setAttribute('aria-hidden', mediaPanel.classList.contains('active') ? 'false' : 'true')
      }
    })

    this.contents.forEach(content => {
      const isActive = content.classList.contains('active')
      content.setAttribute('aria-hidden', isActive ? 'false' : 'true')

      if (isActive) {
        this.enableFocusableElements(content)
      } else {
        this.disableFocusableElements(content)
      }
    })

    this.allMedia.forEach(media => {
      const isActive = media.classList.contains('active')
      media.setAttribute('aria-hidden', isActive ? 'false' : 'true')

      if (isActive) {
        this.enableFocusableElements(media)
      } else {
        this.disableFocusableElements(media)
      }
    })
  }

  activateTab(tabElement) {
    if (!tabElement || !tabElement.classList.contains('tab-js')) return

    this.refreshElements()

    const activeElemID = tabElement.getAttribute('id')
    if (!activeElemID) return

    this.tabs.forEach(tab => tab.classList.remove('active'))
    tabElement.classList.add('active')

    if (this.allMedia.length > 0) {
      this.allMedia.forEach(media => this.hiddenContentPrevActiveTab(media))
      this.allMedia.forEach(media => this.visibleElementActiveTab(media, activeElemID))
    }

    if (this.contents.length > 0) {
      this.contents.forEach(content => this.hiddenContentPrevActiveTab(content))
      this.contents.forEach(content => this.visibleElementActiveTab(content, activeElemID))
    }

    this.syncAccessibility()
  }

  onTabsKeydown(event) {
    const tab = event.target.closest?.('.tab-js')
    if (!tab || !this.contains(tab)) return

    const tabs = Array.from(this.querySelectorAll('.tab-js'))
    const idx = tabs.indexOf(tab)
    if (idx < 0) return

    const len = tabs.length
    const rtl = getComputedStyle(this).direction === 'rtl'
    const { key } = event

    const focusTabAt = (i) => {
      this.activateTab(tabs[i])
      tabs[i].focus()
    }

    let delta
    if (key === 'ArrowUp') delta = -1
    else if (key === 'ArrowDown') delta = 1
    else if (key === 'ArrowLeft') delta = rtl ? 1 : -1
    else if (key === 'ArrowRight') delta = rtl ? -1 : 1

    if (delta !== undefined) {
      event.preventDefault()
      focusTabAt((idx + delta + len) % len)
      return
    }

    if (key === 'Home') {
      event.preventDefault()
      focusTabAt(0)
      return
    }

    if (key === 'End') {
      event.preventDefault()
      focusTabAt(len - 1)
      return
    }

    if (key === 'Tab' && !event.shiftKey) {
      const focusable = this.getFocusableElementsInActivePanel(tab)
      if (focusable.length > 0) {
        event.preventDefault()
        focusable[0].focus()
      }
      return
    }

    if (key === ' ' || key === 'Spacebar') {
      event.preventDefault()
      this.activateTab(tab)
      return
    }

    if (key === 'Enter' && tab.tagName !== 'BUTTON') {
      event.preventDefault()
      this.activateTab(tab)
    }
  }

  changeActiveTab(event) {
    const activeElem = event.target?.closest?.('.tab-js')
    if (activeElem) this.activateTab(activeElem)
  }

  hiddenContentPrevActiveTab(element) {
    element.classList.remove('active')
    element.setAttribute('aria-hidden', 'true')
    this.disableFocusableElements(element)

    if (element.querySelector('video') && !element.classList.contains('active')) {
      element.querySelector('video').pause()
    }

    if (element.querySelector('.js-youtube') && !element.classList.contains('active')) {
      element.querySelector('.js-youtube').contentWindow.postMessage(
        '{"event":"command","func":"pauseVideo","args":""}',
        '*'
      )
    }

    if (element.querySelector('.js-vimeo') && !element.classList.contains('active')) {
      element.querySelector('.js-vimeo').contentWindow.postMessage('{"method":"pause"}', '*')
    }
  }

  visibleElementActiveTab(element, activeElemID) {
    let elemID

    if (element.classList.contains('tab-content-js')) {
      elemID = element.getAttribute('id')?.split('content-')[1]
    }

    if (element.classList.contains('tab-media-js')) {
      elemID = element.getAttribute('id')?.split('media-')[1]
    }

    if (elemID == activeElemID) {
      element.classList.add('active')
      element.setAttribute('aria-hidden', 'false')
      this.enableFocusableElements(element)
      element.querySelectorAll('[data-viewport-defer-video="true"]').forEach((wrapper) => {
        hydrateViewportDeferredVideoMedia(wrapper);
      });
    } else {
      this.disableFocusableElements(element)
    }

    if (
      elemID == activeElemID &&
      element.querySelector('video') &&
      !element.closest('.none-autoplay')
    ) {
      element.querySelector('video').play()
    }
  }

  getFocusableSelector() {
    return [
      'a[href]',
      'area[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'summary',
      'iframe',
      'audio[controls]',
      'video[controls]',
      '[tabindex]'
    ].join(',')
  }

  getFocusableElements(container) {
    return Array.from(container.querySelectorAll(this.getFocusableSelector())).filter(element => {
      if (element.hasAttribute('disabled')) return false
      if (element.getAttribute('aria-hidden') === 'true') return false
      return true
    })
  }

  disableFocusableElements(container) {
    this.getFocusableElements(container).forEach(element => {
      if (!element.hasAttribute('data-prev-tabindex')) {
        const currentTabindex = element.getAttribute('tabindex')
        element.setAttribute('data-prev-tabindex', currentTabindex !== null ? currentTabindex : '')
      }
      element.setAttribute('tabindex', '-1')
    })
  }

  enableFocusableElements(container) {
    this.getFocusableElements(container).forEach(element => {
      if (!element.hasAttribute('data-prev-tabindex')) return

      const prevTabindex = element.getAttribute('data-prev-tabindex')

      if (prevTabindex === '') {
        element.removeAttribute('tabindex')
      } else {
        element.setAttribute('tabindex', prevTabindex)
      }

      element.removeAttribute('data-prev-tabindex')
    })
  }

  getFocusableElementsInActivePanel(activeTab) {
    const activeElemID = activeTab.getAttribute('id')
    if (!activeElemID) return []

    const container = this.closest('.tabs-container-js')
    if (!container) return []

    const activeContent = container.querySelector(`#content-${activeElemID}`)
    const activeMedia = container.querySelector(`#media-${activeElemID}`)

    let focusableElements = []

    if (activeContent && activeContent.classList.contains('active')) {
      focusableElements = this.getFocusableElements(activeContent)
    }

    if (focusableElements.length === 0 && activeMedia && activeMedia.classList.contains('active')) {
      focusableElements = this.getFocusableElements(activeMedia)
    }

    return focusableElements.filter(element => {
      return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
    })
  }
}

customElements.define('component-tabs', MediaTabs)

const VIEWPORT_DEFER_VIDEO_SRC = 'data-viewport-defer-src';

function deferViewportDeferredVideoMedia(rootEl) {
  if (!rootEl) return;

  rootEl.querySelectorAll('video').forEach((video) => {
    const mainSrc = video.getAttribute('src');
    if (mainSrc && !video.hasAttribute(VIEWPORT_DEFER_VIDEO_SRC)) {
      video.setAttribute(VIEWPORT_DEFER_VIDEO_SRC, mainSrc);
      video.removeAttribute('src');
    }
    video.querySelectorAll('source').forEach((source) => {
      const src = source.getAttribute('src');
      if (src && !source.hasAttribute(VIEWPORT_DEFER_VIDEO_SRC)) {
        source.setAttribute(VIEWPORT_DEFER_VIDEO_SRC, src);
        source.removeAttribute('src');
      }
    });
    try {
      video.load();
    } catch (e) {}
  });

  rootEl.querySelectorAll('iframe[src]').forEach((iframe) => {
    const src = iframe.getAttribute('src');
    if (src && !iframe.hasAttribute(VIEWPORT_DEFER_VIDEO_SRC)) {
      iframe.setAttribute(VIEWPORT_DEFER_VIDEO_SRC, src);
      iframe.removeAttribute('src');
    }
  });
}

function hydrateViewportDeferredVideoMedia(rootEl) {
  if (!rootEl) return;

  rootEl.querySelectorAll('video').forEach((video) => {
    const backup = video.getAttribute(VIEWPORT_DEFER_VIDEO_SRC);
    if (backup) {
      video.setAttribute('src', backup);
      video.removeAttribute(VIEWPORT_DEFER_VIDEO_SRC);
    }
    video.querySelectorAll('source').forEach((source) => {
      const b = source.getAttribute(VIEWPORT_DEFER_VIDEO_SRC);
      if (b) {
        source.setAttribute('src', b);
        source.removeAttribute(VIEWPORT_DEFER_VIDEO_SRC);
      }
    });
    try {
      video.load();
    } catch (e) {}
  });

  rootEl.querySelectorAll(`iframe[${VIEWPORT_DEFER_VIDEO_SRC}]`).forEach((iframe) => {
    const backup = iframe.getAttribute(VIEWPORT_DEFER_VIDEO_SRC);
    if (backup) {
      iframe.setAttribute('src', backup);
      iframe.removeAttribute(VIEWPORT_DEFER_VIDEO_SRC);
    }
  });
}

function viewportDeferVideoWrapperMayHydrate(wrapper) {
  const tab = wrapper.closest('.tab-content-js');
  if (tab) return tab.classList.contains('active');
  return true;
}

function initViewportDeferredVideos() {
  document.querySelectorAll('[data-viewport-defer-video="true"]').forEach((wrapper) => {
    if (wrapper.dataset.viewportDeferVideoInit === '1') return;
    wrapper.dataset.viewportDeferVideoInit = '1';

    deferViewportDeferredVideoMedia(wrapper);

    if (!viewportDeferVideoWrapperMayHydrate(wrapper)) {
      return;
    }

    if (!('IntersectionObserver' in window)) {
      hydrateViewportDeferredVideoMedia(wrapper);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      const hit = entries.some((e) => e.isIntersecting);
      if (!hit) return;
      hydrateViewportDeferredVideoMedia(wrapper);
      io.disconnect();
    }, { root: null, rootMargin: '120px 0px', threshold: 0.01 });

    io.observe(wrapper);
  });
}

document.addEventListener('DOMContentLoaded', initViewportDeferredVideos);
document.addEventListener('shopify:section:load', initViewportDeferredVideos);

// TweenMax lazy loader
window.themeAssets = window.themeAssets || {};

const TweenMaxLoader = (() => {
  let promise = null;

  function load() {
    if (window.TweenMax && window.TimelineMax) return Promise.resolve(true);
    if (promise) return promise;

    const src = window.themeAssets?.tweenMaxSrc;
    if (!src) {
      return Promise.resolve(false);
    }

    promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-tweenmax="1"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      s.dataset.tweenmax = "1";
      s.onload = () => resolve(true);
      s.onerror = reject;
      document.head.appendChild(s);
    });

    return promise;
  }

  function prefetchNear(elements, rootMarginPx = 400) {
    if (!('IntersectionObserver' in window)) {
      if ('requestIdleCallback' in window) requestIdleCallback(() => load(), { timeout: 1500 });
      else setTimeout(() => load(), 0);
      return;
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          io.disconnect();
          load();
          break;
        }
      }
    }, { rootMargin: `${rootMarginPx}px 0px ${rootMarginPx}px 0px`, threshold: 0.01 });

    elements.forEach(el => io.observe(el));
  }

  return { load, prefetchNear };
})();

class HoverImageReveal extends HTMLElement {
  constructor() {
    super();
       
    this.reveal = null;
    this.revealInner = null;
    this.revealImg = null;

    this.header = null;
    this.sidebar = null;

    this.windowWidth = 0;
    this.headerHeight = 0;
    this.imageWidth = 0;
    this.imageHeight = 0;

    this._rafMove = 0;
    this._lastEv = null;
    this._didMeasure = false;
    this._didBind = false;

    this._hovering = false;
    this._warmed = false;

    this._isPromo = false;

    this._onMouseEnter = null;
    this._onMouseLeave = null;
    this._onMouseMove = null;
    this._onResize = null;

    this._enabled = this._computeEnabled();

    if (!HoverImageReveal._globalWarmArmed) {
      HoverImageReveal._globalWarmArmed = true;

      const armGlobalWarm = () => {
        const run = () => {
          HoverImageReveal._globalWarmDone = true;

          const warm = () => {
            try {
              TweenMaxLoader.load().catch(() => {});
            } catch (e) {}
          };

          if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2000 });
          else setTimeout(warm, 0);
        };

        const once = () => {
          if (HoverImageReveal._globalWarmDone) return;

          run();

          window.removeEventListener('scroll', once);
          window.removeEventListener('pointermove', once);
          window.removeEventListener('touchstart', once);
        };

        window.addEventListener('scroll', once, { passive: true });
        window.addEventListener('pointermove', once, { passive: true });
        window.addEventListener('touchstart', once, { passive: true });
      };

      if (document.readyState === 'complete') armGlobalWarm();
      else window.addEventListener('load', armGlobalWarm, { once: true });
    }
  }

  connectedCallback() {
    this.reveal = this.querySelector('.hover-reveal');
    this.revealInner = this.querySelector('.hover-reveal__inner');
    this.revealImg = this.querySelector('.hover-reveal__img');

    if (this.revealInner) this.revealInner.style.overflow = 'hidden';

    this.header = document.querySelector('.shopify-section-header .header');
    this.sidebar = document.querySelector('.secondary-sidebar-section');

    // Cache promo check (so we don't call closest() every mousemove frame)
    this._isPromo = !!this.closest('.section-scrolling-promotion');

    if (!this._onResize) {
      this._onResize = () => {
        const nextEnabled = this._computeEnabled();
        const wasEnabled = this._enabled;

        this._didMeasure = false;
        this._warmed = false;

        if (wasEnabled && !nextEnabled) {
          this._enabled = false;
          this._disableHover();
          return;
        }

        if (!wasEnabled && nextEnabled) {
          this._enabled = true;
          this._enableHover();
          return;
        }

        this._enabled = nextEnabled;
      };

      window.addEventListener('resize', this._onResize, { passive: true });
    }

    if (!this._enabled) {
      this._forceHidden();
      return;
    }

    this._enableHover();
  }

  disconnectedCallback() {
    this._disableHover();

    if (this._onResize) window.removeEventListener('resize', this._onResize);

    this._didBind = false;
    this._hovering = false;
    this._didMeasure = false;
    this._warmed = false;

    this._lastEv = null;
  }

  _computeEnabled() {
    const wideEnough = window.innerWidth >= 768;
    const canHoverFine =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isTouchFlag = !!(theme?.config?.isTouch);

    if (!wideEnough) return false;
    if (isTouchFlag) return canHoverFine;
    return canHoverFine; 
  }

  _enableHover() {
    if (this._didBind) return;
    this._didBind = true;

    if (!this.reveal || !this.revealInner || !this.revealImg) return;

    const warmUpOnce = () => {
      if (this._warmed) return;
      this._warmed = true;
      this._didMeasure = false;
      this._measureIfNeeded();
    };

    this._onMouseEnter = (ev) => {
      this._hovering = true;

      warmUpOnce();
      this._positionElement(ev);

      // If TweenMax is already available - don't create extra promise work
      if (window.TweenMax && window.TimelineMax) {
        this.showImage();
        return;
      }

      TweenMaxLoader.load()
        .then((ok) => {
          if (!ok) return;
          if (!this._hovering) return;
          if (window.TweenMax && window.TimelineMax) this.showImage();
        })
        .catch(() => {});
    };

    this._onMouseLeave = () => {
      this._hovering = false;
      if (window.TweenMax && window.TimelineMax) this.hideImage();
    };

    this._onMouseMove = (ev) => {
      this._lastEv = ev;
      if (this._rafMove) return;
      this._rafMove = requestAnimationFrame(() => {
        this._rafMove = 0;
        if (!this._lastEv) return;
        this._positionElement(this._lastEv);
      });
    };

    this.addEventListener('mouseenter', this._onMouseEnter, { passive: true });
    this.addEventListener('mousemove', this._onMouseMove, { passive: true });
    this.addEventListener('mouseleave', this._onMouseLeave, { passive: true });
  }

  _disableHover() {
    if (this._rafMove) cancelAnimationFrame(this._rafMove);
    this._rafMove = 0;

    if (this._onMouseEnter) this.removeEventListener('mouseenter', this._onMouseEnter);
    if (this._onMouseMove) this.removeEventListener('mousemove', this._onMouseMove);
    if (this._onMouseLeave) this.removeEventListener('mouseleave', this._onMouseLeave);

    this._onMouseEnter = null;
    this._onMouseMove = null;
    this._onMouseLeave = null;

    this._didBind = false;
    this._hovering = false;
    this._lastEv = null;

    this._forceHidden();
  }

  _forceHidden() {
    if (!this.reveal) return;

    if (window.TweenMax) {
      try {
        if (this.revealInner) TweenMax.killTweensOf(this.revealInner);
        if (this.revealImg) TweenMax.killTweensOf(this.revealImg);
      } catch (e) {}
    }

    this.reveal.style.opacity = 0;

    try {
      if (window.TweenMax) TweenMax.set(this, { zIndex: '' });
      else this.style.zIndex = '';
    } catch (e) {
      this.style.zIndex = '';
    }
  }

  _measureIfNeeded() {
    if (this._didMeasure) return;

    this.windowWidth = window.innerWidth;
    if (this.sidebar) this.windowWidth = window.innerWidth - 96;

    this.headerHeight = 0;
    if (this.header) {
      this.headerHeight = this.header.closest('.disable') ? 0 : this.header.offsetHeight;
    }

    this.imageWidth = this.revealInner.offsetWidth;
    this.imageHeight = this.revealInner.offsetHeight * 0.8;

    this._didMeasure = true;
  }

  _getMousePos(e) {
    return { x: e.clientX, y: e.clientY };
  }

  _positionElement(ev) {
    if (!ev) return;

    this._measureIfNeeded();

    const mousePos = this._getMousePos(ev);
    const CURSOR_OFFSET_Y = 20;
    const docScrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft || 0;

    let horizontalPosition = mousePos.x + CURSOR_OFFSET_Y + docScrollLeft;
    let verticalPosition = mousePos.y + CURSOR_OFFSET_Y;

    if (horizontalPosition + this.imageWidth + 16 > this.windowWidth + docScrollLeft) {
      horizontalPosition = (this.windowWidth + docScrollLeft) - this.imageWidth - 16;
    }

    if (this._isPromo) {
      const triggerRect = this.getBoundingClientRect();
      const cursorToImageY = triggerRect.height - CURSOR_OFFSET_Y;

      const imageOverflowPixels =
        (verticalPosition + this.revealInner.offsetHeight + cursorToImageY) - window.innerHeight;

      if (imageOverflowPixels > 0) {
        verticalPosition = verticalPosition - imageOverflowPixels;
      }

      this.reveal.style.left = `${horizontalPosition - triggerRect.left - docScrollLeft}px`;
      this.reveal.style.top = `${verticalPosition - triggerRect.top + cursorToImageY}px`;
      return;
    }

    if (this.headerHeight + 16 + this.imageHeight > verticalPosition) {
      verticalPosition = this.headerHeight + 16 + this.imageHeight;
    }

    this.reveal.style.left = `${horizontalPosition - docScrollLeft}px`;
    this.reveal.style.top = `${verticalPosition}px`;
  }

  showImage() {
    if (!window.TweenMax || !window.TimelineMax) return;

    TweenMax.killTweensOf(this.revealInner);
    TweenMax.killTweensOf(this.revealImg);

    const startAtYCoord = this._isPromo ? '0%' : '50%';
    const yCoord = this._isPromo ? '0%' : '-80%';

    this.tl = new TimelineMax({
      onStart: () => {
        this.reveal.style.opacity = 1;
        TweenMax.set(this, { zIndex: 5 });
      }
    })
      .delay(0.2)
      .add('begin')
      .add(new TweenMax(this.revealInner, 0.8, {
        ease: Expo.easeOut,
        startAt: { opacity: 0, y: startAtYCoord, rotation: -15, scale: 0 },
        y: yCoord,
        rotation: 0,
        opacity: 1,
        scale: 1
      }), 'begin')
      .add(new TweenMax(this.revealImg, 0.8, {
        ease: Expo.easeOut,
        startAt: { rotation: 15, scale: 2 },
        rotation: 0,
        scale: 1
      }), 'begin');
  }

  hideImage() {
    if (!window.TweenMax || !window.TimelineMax) return;

    TweenMax.killTweensOf(this.revealInner);
    TweenMax.killTweensOf(this.revealImg);

    this.tl = new TimelineMax({
      onStart: () => {
        TweenMax.set(this, { zIndex: 4 });
      },
      onComplete: () => {
        TweenMax.set(this, { zIndex: '' });
        TweenMax.set(this.reveal, { opacity: 0 });
      }
    })
      .add('begin')
      .add(new TweenMax(this.revealInner, 0.15, {
        ease: Sine.easeOut,
        y: '-40%',
        rotation: 10,
        scale: 0.9,
        opacity: 0
      }), 'begin')
      .add(new TweenMax(this.revealImg, 0.15, {
        ease: Sine.easeOut,
        rotation: -10,
        scale: 1.5
      }), 'begin');
  }
}

customElements.define('link-hover-image', HoverImageReveal);

class SwatchesWrapper extends HTMLElement {
  constructor() {
    super();

    this.productCard = this.closest('.card')

    this.addEventListener('mouseleave', () => {
      this.productCard.classList.remove('no-hover')
    })
    this.addEventListener('mouseenter', (event) => {
      this.productCard.classList.add('no-hover')
    }) 
  }
}
customElements.define('swatches-wrapper', SwatchesWrapper);

class ProductCardImage extends HTMLElement {
  constructor() {
    super();

    this.showSecondMedia = this.getAttribute('show-second-media') === 'true';
  }

  connectedCallback() {
    this.init()
  }

  disconnectedCallback() {
    if (this.card) {
      this.card.removeEventListener('mouseenter', this.handleCardMouseEnterBound);
      this.card.removeEventListener('mouseleave', this.handleCardMouseLeaveBound);
    }
  }

  init() {
    this.firstMedia = this.querySelector('.card__image:first-child');
    this.secondMedia = this.querySelector('.card__image:nth-child(2)');

    if (this.querySelector('.lazy-image'))  {
      this.firstMedia = this.querySelector('.lazy-image:first-child .card__image');
      this.secondMedia = this.querySelector('.lazy-image:nth-child(2) .card__image');
    }

    this.firstMediaType = getMediaType(this.firstMedia);
    this.secondMediaType = getMediaType(this.secondMedia);

    this.card = this.closest('.card');
    this.swatches = this.card.querySelector('swatches-wrapper');

    const bothMediaAreImages = this.firstMediaType === 'IMAGE' && this.secondMediaType === 'IMAGE';
    
    if (this.firstMediaType === 'YOUTUBE') {
      window.playYoutubeVideo(this.firstMedia, true);
    }

    if (this.card && this.showSecondMedia && this.secondMedia && !bothMediaAreImages) {
      this.handleCardHover();

      this.card.addEventListener('media-update-by-swatch', () => {
        this.card.removeEventListener('mouseenter', this.handleCardMouseEnterBound);
        this.card.removeEventListener('mouseleave', this.handleCardMouseLeaveBound);

        this.init();
      });
    }
  }

  handleCardMouseEnter() {
    if (!this.card.classList.contains('no-hover')) {
      this.isHovered = true; 

      window.pauseMedia(this.firstMedia);
      window.playMedia(this.secondMedia, true);
    }
  }

  handleCardMouseLeave() {
    if (!this.card.classList.contains('no-hover')) {
      this.isHovered = false; 

      window.pauseMedia(this.secondMedia);
      window.playMedia(this.firstMedia, true);
    }
  }

  handleCardHover() {
    this.isHovered = false;

    this.handleCardMouseEnterBound = this.handleCardMouseEnter.bind(this);
    this.handleCardMouseLeaveBound = this.handleCardMouseLeave.bind(this);

    this.card.addEventListener('mouseenter', this.handleCardMouseEnterBound);
    this.card.addEventListener('mouseleave', this.handleCardMouseLeaveBound);

    // Observe class changes to .no-hover
    const observer = new MutationObserver(() => {
      const hasNoHover = this.card.classList.contains('no-hover');

      if (hasNoHover && this.isHovered) {
        // Trigger mouseleave if .no-hover is added while hovered
        this.isHovered = false; 
        window.pauseMedia(this.secondMedia);
        window.playMedia(this.firstMedia);
      } else if (!hasNoHover && !this.isHovered && this.card.matches(':hover')) {
        // Trigger mouseenter if .no-hover is removed and still hovered
        this.isHovered = true; 
        window.pauseMedia(this.firstMedia);
        window.playMedia(this.secondMedia);
      }
    });

    observer.observe(this.card, { attributes: true, attributeFilter: ['class'] });
  }
}

customElements.define('product-card-image', ProductCardImage);

class ColorSwatch extends HTMLElement {
  constructor() {
    super();

    this.cached = {};
    this.variantId = this.dataset.variantId;
    this.colorsContainer = this.closest('.card__colors')
    this.tooltip = this.querySelector('.color-swatch__title')
    this.quickViewButton = this.closest('.card-container').querySelector('.quick-view')
    this.productCard = this.closest('.card')
    this.productHref = this.productCard.href
    this.mediaContainer = this.productCard.querySelector('.card__product-image');
    this.hoverBehavior = this.dataset.hoverBehavior;

    this.firstMedia = this.productCard.querySelector('.card__product-image .card__image')?.cloneNode(true)
    this.secondMedia = this.productCard.querySelector('.card__product-image .card__image--second')?.cloneNode(true)
    this.variantFirstMedia = parseNode(this.dataset.firstMediaNode);
    this.variantSecondMedia = parseNode(this.dataset.secondMediaNode);
    this.priceInCard = this.productCard.querySelector('.price').innerHTML
    this.gridItem = this.closest('.slider__grid-item');
    this.gridHoverClass = 'is-swatch-hover';

    this.addEventListener('click', (event) => {
      event.preventDefault()

      this.onClickHandler()

      if (event.target.closest('a')) return false
    });

    this.closest('.color-swatch').addEventListener('mouseenter', () => { this.alignSwatches() }) 
    this.closest('.color-swatch').addEventListener('touchstart', () => { this.alignSwatches() })
    this.closest('.color-swatch').addEventListener('mouseleave', this.onSwatchMouseLeave) 

    if (this.classList.contains('active-swatch')) {
      this.activateColorSwatch();
    }
  }

  onSwatchMouseLeave = () => {
    if (!this.gridItem) return;
    this.gridItem.classList.remove(this.gridHoverClass);
  };

  onClickHandler() {
    if (this.closest('.show-first-image') && this.closest('.active-swatch')) {
      this.resetSwatch();

      return;
    }

    if (this.closest('.active-swatch')) {
      return;
    }

    this.activateColorSwatch();
  }

  activateColorSwatch() {
    if (this.productCard.querySelector('.swiper-product-card')) {
      const firstMediaNode = parseNode(this.dataset.firstMediaNode);
      const firstMediaId = firstMediaNode.dataset.id || firstMediaNode.querySelector('img').dataset.id;

      this.productCard.querySelector('.swiper-product-card').dispatchEvent(new CustomEvent('color-swatch:change', {
        detail: {
          colorName: this.dataset.colorName,
          firstMediaId: firstMediaId
        }
      }));
    }
    
    const swatches = this.colorsContainer.querySelectorAll('.color-swatch');

    swatches.forEach((swatch) => {
      swatch.classList.remove('active-swatch');
    });

    this.classList.add('active-swatch');
    this.updateURL();

    if (
      (this.hoverBehavior == 'second_image' || this.hoverBehavior == 'nothing') && 
      this.firstMedia && 
      !this.firstMedia.classList.contains('card__image-placeholder') && 
      this.variantFirstMedia
    ) {
      this.updateMedia(this.variantFirstMedia, this.variantSecondMedia);
    }

    if (this.closest('.show-selected-value')) this.colorSwatchFetch()
  }

  resetSwatch() {
    this.classList.remove('active-swatch');
    this.productCard.href = this.productHref;

    if (this.productCard.querySelector('.swiper-product-card')) {
      this.productCard.querySelector('.swiper-product-card').dispatchEvent(new CustomEvent('color-swatch:change', {
        detail: {
          colorName: 'all'
        }
      }));
    }

    if (this.className.includes('show-selected-value')) this.productCard.querySelector('.price').innerHTML = this.priceInCard

    if (
      (this.hoverBehavior === 'second_image' || this.hoverBehavior === 'nothing') &&
      this.firstMedia &&
      !this.firstMedia.classList.contains('card__image-placeholder')
    ) {
      this.updateMedia(this.firstMedia, this.secondMedia);
    }
  }

  updateMedia(firstMedia, secondMedia) {
    this.deleteAllChildren(this.mediaContainer);
  
    if (firstMedia) {
      this.mediaContainer.appendChild(firstMedia);
      window.playMedia(firstMedia, true);
    }
  
    if (secondMedia && this.productCard.querySelector('.card__product-image--show-second')) {
      this.mediaContainer.appendChild(secondMedia);
    }
  
    this.dispatchMediaUpdateEvent();
  }

  dispatchMediaUpdateEvent() {
    const event = new CustomEvent('media-update-by-swatch', {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  colorSwatchFetch() {
    this.productHandle = this.dataset.productHandle;
    this.productUrl = this.dataset.productUrl.split('/')[2]
    if(this.productUrl && this.productHandle != this.productUrl) this.productHandle = this.productUrl
    const collectionHandle = this.dataset.collectionHandle;
    let sectionUrl = `${window.routes.root_url}/products/${this.productHandle}?variant=${this.variantId}&view=card`;

    if (collectionHandle.length > 0) {
      sectionUrl = `${window.routes.root_url}/collections/${collectionHandle}/products/${this.productHandle}?variant=${this.variantId}&view=card`;
    }

    // remove double `/` in case shop might have /en or language in URL
    sectionUrl = sectionUrl.replace('//', '/');

    if (this.cached[sectionUrl]) {
      this.renderProductInfo(this.cached[sectionUrl]);
      return;
    }

    fetch(sectionUrl)
      .then(response => response.text())
      .then(responseText => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        this.cached[sectionUrl] = html;
        this.renderProductInfo(html);
      })
      .catch(e => {
        console.error(e);
      });
  }

  renderProductInfo(html) {
    this.updatePrice(html);
    this.updateSize(html);
    this.updateBadge(html);
    this.updateTitle(html);
  }

  updatePrice(html) {
    const selector = '.price';
    const destination = this.productCard.querySelector(selector);
    const source = html.querySelector('main').querySelector(selector);

    if (source && destination) destination.innerHTML = source.innerHTML;
  }

  updateSize(html) {
    const selector = '.card__sizes';
    const destination = this.productCard.querySelector(selector);
    const source = html.querySelector('main').querySelector(selector);

    if (source && destination) destination.innerHTML = source.innerHTML;
  }

  updateBadge(html) {
    const selector = '.card__badges';
    const destination = this.productCard.querySelector(selector);
    const source = html.querySelector('main').querySelector(selector);

    if (source && destination) destination.innerHTML = source.innerHTML;
  }

  updateTitle(html) {
    const selector = '.card__title-js';
    const destination = this.productCard.querySelector(selector);
    const source = html.querySelector('main').querySelector(selector);
    const name_characters = destination.closest('.card__title').dataset.nameCharacters

    let source_innerHTML
    if (source) source_innerHTML = source.innerHTML
    if (name_characters && source.innerHTML.trim().length > name_characters) source_innerHTML = source.innerHTML.trim().slice(0, name_characters) + '...'
    if (source && destination) destination.innerHTML = source_innerHTML;
  }

  updateURL() {
    const activeSwatch = this.colorsContainer.querySelector('.active-swatch')
    const activeVariantURL = activeSwatch.querySelector('.color-swatch__link').getAttribute('href')
    this.productCard.setAttribute('href', activeVariantURL)
    if (this.quickViewButton) this.quickViewButton.dataset.productUrl = activeVariantURL
    document.dispatchEvent(new CustomEvent('product_cart:update_url'));
  }

  alignSwatches() {
    this.cardViewport =
      this.tooltip.closest('.slider__viewport') ||
      this.tooltip.closest('.component-tabs__content') ||
      this.tooltip.closest('.shopify-section');
    this.tooltip.removeAttribute('style')
    if (this.cardViewport && this.cardViewport.getBoundingClientRect().left >= this.tooltip.getBoundingClientRect().left) {
      this.tooltip.setAttribute('style', `right: calc(50% - ${(Math.abs(this.tooltip.getBoundingClientRect().left - this.cardViewport.getBoundingClientRect().left))}px);`)
    }
    if (!this.gridItem) return;
    this.gridItem.classList.add(this.gridHoverClass);
  }

  deleteAllChildren(parent) {
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }
  }
}
customElements.define('color-swatch', ColorSwatch);



class ScrollingPromotion extends HTMLElement {
  constructor() {
    super();

    this.config = {
      moveTime: parseFloat(this.dataset.speed), // 100px going to move for
      space: 100,  // 100px
    };

    this.promotion = this.querySelector('.promotion');

    theme.initWhenVisible({
      element: this,
      callback: this.init.bind(this),
      threshold: 600
    });
  }

  init() {
    if (this.childElementCount === 1) {
      this.promotion.classList.add('promotion--animated');

      for (let index = 0; index < 10; index++) {
        this.clone = this.promotion.cloneNode(true);
        this.clone.setAttribute('aria-hidden', true);
        this.appendChild(this.clone);

        let imageWrapper = this.clone.querySelector('.promotion__item');
        if (imageWrapper) imageWrapper.classList.remove('loading');
      }
      let animationTimeFrame = (this.promotion.clientWidth / this.config.space) * this.config.moveTime;
      this.style.setProperty('--duration', `${animationTimeFrame}s`);

      this.widthPromotion = this.promotion.offsetWidth
      this.widthWrapper = this.offsetWidth
      this.percent = this.widthPromotion * 100 / this.widthWrapper
      // Define a variable to assign a scroll step. Do not use transform property, this may cause the animation (HoverImageReveal) to work incorrectly
      this.style.setProperty('--left-position', `-${this.percent}%`);

      window.addEventListener('resize', () => {
        this.widthPromotion = this.promotion.offsetWidth
        this.widthWrapper = this.offsetWidth
        this.percent = this.widthPromotion * 100 / this.widthWrapper
        this.style.setProperty('--left-position', `-${this.percent}%`);
        let animationTimeFrame = (this.promotion.clientWidth / this.config.space) * this.config.moveTime;
        this.style.setProperty('--duration', `${animationTimeFrame}s`);
      })

      // pause when out of view
      const observer = new IntersectionObserver((entries, _observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.scrollingPlay();
          } else {
            this.scrollingPause();
          }
        });
      }, {rootMargin: '0px 0px 50px 0px'});

      observer.observe(this);
    }
  }

  scrollingPlay() {
    this.classList.remove('scrolling-promotion--paused');
  }

  scrollingPause() {
    this.classList.add('scrolling-promotion--paused');
  }
}
customElements.define('scrolling-promotion', ScrollingPromotion);

class CascadingGrid extends HTMLElement {
  constructor() {
    super();

    this.masonry = null;

    this._inited = false;
    this._initScheduled = false;

    this._io = null;
    this._firstIntent = null;
    this._onResize = null;
    this._ro = null;
    this._layoutRaf = 0;

    this._startInitSoon = this._startInitSoon.bind(this);
    this._armLazyInit = this._armLazyInit.bind(this);
    this._disarmLazyInit = this._disarmLazyInit.bind(this);
    this._initHard = this._initHard.bind(this);
    this._safeLayout = this._safeLayout.bind(this);
  }

  connectedCallback() {
    if (window.Shopify && Shopify.designMode) {
      this._startInitSoon('design-mode', { urgent: true });
      return;
    }
    this._armLazyInit();
  }

  disconnectedCallback() {
    this._disarmLazyInit();

    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }

    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }

    if (this._layoutRaf) {
      cancelAnimationFrame(this._layoutRaf);
      this._layoutRaf = 0;
    }

    if (this.masonry) {
      try { this.masonry.destroy(); } catch (e) {}
      this.masonry = null;
    }

    this._inited = false;
    this._initScheduled = false;
  }

  _armLazyInit() {
    if (this._lazyArmed) return;
    this._lazyArmed = true;

    this._firstIntent = () => this._startInitSoon('intent', { urgent: true });
    this.addEventListener('pointerenter', this._firstIntent, { once: true, passive: true });
    this.addEventListener('pointerdown',  this._firstIntent, { once: true, passive: true });
    this.addEventListener('focusin',      this._firstIntent, { once: true, passive: true });

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        const e = entries && entries[0];
        if (!e) return;

        const vh = (e.rootBounds && e.rootBounds.height) || window.innerHeight || 0;
        const distanceToViewport = Math.max(0, e.boundingClientRect.top - vh);
        const urgent = distanceToViewport < 250;

        if (e.isIntersecting) this._startInitSoon('viewport', { urgent });
      }, {
        root: null,
        rootMargin: '1200px 0px',
        threshold: 0.01
      });

      this._io.observe(this);
    } else {
      this._startInitSoon('fallback', { urgent: false });
    }
  }

  _disarmLazyInit() {
    if (this._firstIntent) {
      this.removeEventListener('pointerenter', this._firstIntent);
      this.removeEventListener('pointerdown',  this._firstIntent);
      this.removeEventListener('focusin',      this._firstIntent);
      this._firstIntent = null;
    }
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
    this._lazyArmed = false;
  }

  _startInitSoon(reason, { urgent } = { urgent: false }) {
    if (this._inited || this._initScheduled) return;
    this._initScheduled = true;

    this._disarmLazyInit();

    const run = () => {
      this._initScheduled = false;
      this._initHard();
    };

    if (window.Shopify && Shopify.designMode) {
      requestAnimationFrame(run);
      return;
    }

    if (urgent) {
      requestAnimationFrame(run);
      return;
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 2000 });
    } else {
      requestAnimationFrame(run);
    }
  }

  _initHard() {
    if (this._inited) return;
    this._inited = true;

    const isRTL = document.documentElement.dir === 'rtl';
    const containerSelector = this.getAttribute('container-selector');
    const itemSelector = this.getAttribute('item-selector');
    const gridContainer = containerSelector ? this.querySelector(containerSelector) : null;

    if (!gridContainer) return;

    this.masonry = new Masonry(gridContainer, {
      itemSelector,
      originLeft: !isRTL,
      initLayout: false
    });

    this._safeLayout();

    this._onResize = () => this._safeLayout();
    window.addEventListener('resize', this._onResize, { passive: true });

    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(() => this._safeLayout());
      this._ro.observe(gridContainer);
    }
  }

  _safeLayout() {
    if (!this.masonry) return;
    if (this._layoutRaf) cancelAnimationFrame(this._layoutRaf);
    this._layoutRaf = requestAnimationFrame(() => {
      this._layoutRaf = 0;
      try { this.masonry.layout(); } catch (e) {}
    });
  }
}
customElements.define('cascading-grid', CascadingGrid);

class ShowMoreButton extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector('button');

    button.addEventListener('click', (event) => {
      this.toggleShowMore(event.target)
    });

    this.parentPanel = this.closest('.accordion__panel');
    this.showMoreLabel = this.querySelector('.label-show--more');
    this.showLessLabel = this.querySelector('.label-show--less');
  }

  toggleShowMore(button, forceOpen = false) {
    const parentDisplay = button.closest('[id^="Show-More-"]').closest('.js-filter');
    
    if (forceOpen) {
      this.showMoreLabel.classList.add('hidden');
      this.showLessLabel.classList.remove('hidden');

      parentDisplay.querySelectorAll('.show-more-item').forEach((item) => item.classList.remove('hidden'));
    } else {
      this.showMoreLabel.classList.toggle('hidden');
      this.showLessLabel.classList.toggle('hidden');

      parentDisplay.querySelectorAll('.show-more-item').forEach((item) => item.classList.toggle('hidden'));
    }

    this.parentPanel.style.maxHeight = this.parentPanel.scrollHeight + "px"
  }
}

customElements.define('show-more-button', ShowMoreButton);

class InfiniteScroll extends HTMLElement {
  constructor() {
    super();

    this.sectionId = this.closest('section').id.split('shopify-section-')[1]
    if(this.closest('.section-collection-tabs')) {
      this.sectionId = this.closest('.component-tabs__content').id.split('content-')[1]
    }
    this.querySelector('button').addEventListener('click', this.onClickHandler.bind(this));
    if (this.dataset.trigger == 'auto') {
      new IntersectionObserver(this.handleIntersection.bind(this), {rootMargin: '0px 0px 200px 0px'}).observe(this);
    }
  }

  onClickHandler() {
    if (this.classList.contains('loading') || this.classList.contains('disabled')) return;
    this.classList.add('loading');
    this.classList.add('disabled');
    this.querySelector('button').innerHTML = this.querySelector('.loading-overlay__spinner').innerHTML
    const sections = InfiniteScroll.getSections(this.sectionId);
    sections.forEach(() => {
      const url = this.dataset.url;
      InfiniteScroll.renderSectionFromFetch(url, this.sectionId );
    });
  }

  handleIntersection(entries, observer) {
    if (!entries[0].isIntersecting) return;
    observer.unobserve(this);

    this.onClickHandler();
  }

  static getSections(sectionID) {
    return [
      {
        section: document.getElementById(`product-grid--${sectionID}`).dataset.id,
      }
    ]
  }

  static renderSectionFromFetch(url, sectionId) {
    fetch(url)
      .then(response => response.text())
      .then((responseText) => {
        const html = responseText;
        InfiniteScroll.renderPagination(html, sectionId);
        InfiniteScroll.renderProductGridContainer(html, sectionId);
      })
      .catch((e) => {
        console.error(e);
      });
  }

  static renderPagination(html, sectionId) {
    const container = document.getElementById(`ProductGridContainer--${sectionId}`).querySelector('.pagination-wrapper');
    const pagination = new DOMParser().parseFromString(html, 'text/html').getElementById(`ProductGridContainer--${sectionId}`).querySelector('.pagination-wrapper');
    if (pagination) {
      container.innerHTML = pagination.innerHTML;
    }
    else {
      container.remove();
    }
  }

  static renderProductGridContainer(html, sectionId) {
    const container = document.getElementById(`product-grid--${sectionId}`);
    const products = new DOMParser().parseFromString(html, 'text/html').getElementById(`product-grid--${sectionId}`);
    container.insertAdjacentHTML('beforeend', products.innerHTML);
  }
}
customElements.define('infinite-scroll', InfiniteScroll);  

class ImageComparison extends HTMLElement {
  constructor() {
    super();
    this._initialized = false;

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((entries) => {
        const e = entries && entries[0];
        if (!e || !e.isIntersecting) return;
        this._io.disconnect();
        this._io = null;
        this._init();
      }, { root: null, rootMargin: '0px', threshold: 0 });
      this._io.observe(this);
    } else {
      this._init();
    }
  }

  _init() {
    if (this._initialized) return;
    this._initialized = true;

    this.range = this.querySelector('.image-comparison__range');
    if (!this.range) return;

    this.isRTL = document.documentElement.dir === 'rtl';

    const updatePosition = (value) => {
      const position = this.isRTL ? 100 - value : value;
      this.style.setProperty('--position', `${position}%`);
    };

    this.range.addEventListener('input', (e) => updatePosition(e.target.value));
    this.range.addEventListener('change', (e) => updatePosition(e.target.value));

    this.setValue();
    this._boundSetValue = this.setValue.bind(this);
    window.addEventListener('resize', this._boundSetValue);
  }

  setValue() {
    if (!this.range) return;
    this.width = this.offsetWidth;
    this.min = Math.max(Math.ceil(8 * 100 / this.width * 10) / 10, 0);
    this.max = 100 - this.min;
    this.range.setAttribute('min', this.min);
    this.range.setAttribute('max', this.max);
  }

  disconnectedCallback() {
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
    if (this._boundSetValue) {
      window.removeEventListener('resize', this._boundSetValue);
    }
  }
}
customElements.define('image-comparison', ImageComparison);

class ImageWithHotspots extends HTMLElement {
  constructor() {
    super();
    this.timeout

    this.dots = this.querySelectorAll('.image-with-hotspots__dot');
    this.dropdowns = this.querySelectorAll('.image-with-hotspots__dot ~ .image-with-hotspots__content');
    this.dots.forEach(dot => dot.addEventListener('mouseenter', (event) => {
      if (event.target.closest('.image-with-hotspots__dot')) this.openDropdown(event.target.closest('.image-with-hotspots__dot')) 
    }))

    this.dots.forEach(dot => dot.addEventListener('mousemove', (event) => {
      if (event.target.closest('.image-with-hotspots__dot')) this.openDropdown(event.target.closest('.image-with-hotspots__dot')) 
    }))

    this.dots.forEach(dot => dot.addEventListener('mouseleave', (event) => {
      if (event.relatedTarget && !event.relatedTarget.closest('.image-with-hotspots__content')) this.closeDropdown(dot)
    }))

    this.dropdowns.forEach(dropdown => dropdown.addEventListener('mouseleave', (event) => {
      if (event.relatedTarget != dropdown.previousElementSibling) this.closeDropdown(dropdown.previousElementSibling)
    }))

    this.dropdowns.forEach(dropdown => dropdown.addEventListener('click', (event) => {
      if(event.target.closest('quick-view-button') && event.target.closest('quick-view-button').previousElementSibling.closest('.open')) this.closeDropdown(event.target.closest('quick-view-button').previousElementSibling)
    }))
  }

  openDropdown(item) {
    this.stopAnimation()

    if (!item.nextElementSibling) return;

    this.alignDropdown(item.nextElementSibling)
    item.classList.add('open', 'active')
    item.classList.remove('closing')
    item.closest('.image-with-hotspots__hotspot').style.zIndex = 6
  }

  closeDropdown(item) {
    if (!item.nextElementSibling) return;

    item.classList.add('closing')

    this.timeout = setTimeout(() => {
      item.classList.remove('closing')
      item.classList.remove('open')
      item.closest('.image-with-hotspots__hotspot').removeAttribute('style')
      this.content = item.nextElementSibling
      this.contentIcon = this.content.querySelector('.image-with-hotspots__content-icon')
      this.content.removeAttribute('style')
      this.contentIcon.removeAttribute('style')
    }, 300);

    item.classList.remove('active')
  }

  alignDropdown(item) {
    this.itemCoordinate = item.getBoundingClientRect();
    this.contentIcon = item.querySelector('.image-with-hotspots__content-icon')
    this.itemWidth = item.offsetWidth
    this.viewportWidth = window.innerWidth
    this.dotPosition = Math.round(item.closest('.image-with-hotspots__hotspot').getBoundingClientRect().left)
    if(this.itemCoordinate.left < 0) {
      item.style.left = 0 - this.dotPosition + 'px';
      item.style.right = 'auto';
      this.contentIcon.style.left = this.dotPosition + 22 - 8 + 'px';
      this.contentIcon.style.right = 'auto';
    } else if (this.itemCoordinate.right  > this.viewportWidth) {
      item.style.right = 'auto';
      item.style.left = this.viewportWidth - this.dotPosition - this.itemWidth + 'px';
      this.contentIcon.style.left = 'auto';
      this.contentIcon.style.right = this.viewportWidth - this.dotPosition - 22 - 8 + 'px';
    } 
  }

  stopAnimation() {
    clearTimeout(this.timeout)
    this.querySelectorAll('.image-with-hotspots__hotspot').forEach(item => item.removeAttribute('style'))
  }
}
customElements.define('image-with-hotspots', ImageWithHotspots);

class PromoPopup extends HTMLElement {
  constructor() {
    super();

    if (window.location.pathname === '/challenge') return;

    this.cookieName = this.getAttribute('data-section-id');

    this.classes = {
      bodyClass: 'hidden',
      openClass: 'open',
      closingClass: 'is-closing',
      showImage: 'show-image'
    };

    this.originalSection = this.closest('section');
    this.popup = this.querySelector('.popup-wrapper');
    this.popupPlaceholder = document.createComment('popup-placeholder');
    this.stickyTab = this.querySelector('.promo-sticky-tab');
    this.openTabButton = this.querySelector('.open-sticky-tab');
    this.closeTabButton = this.querySelector('.close-sticky-tab');
    this.overlay = document.querySelector('body > .overlay');
    if (this.querySelector('.age-verification__overlay')) this.overlay = this.querySelector('.age-verification__overlay');

    this.hasPopupedUp = false;
    this.flyout = false;

    if (this.popup?.dataset?.position === 'right_flyout' || this.popup?.dataset?.position === 'left_flyout') {
      this.flyout = true;
    }

    this._onToggleClick = this.onButtonClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onCartDrawerOpen = (event) => this.closePopup(event);

    this._scrollDelayActive = false;
    this._scrollDelayPercent = null;
    this._activateScrollDelay = this._activateScrollDelay.bind(this);
    this._onScrollDelay = this._onScrollDelay.bind(this);

    this.onShopifySectionLoad = null;
    this.onShopifySectionSelect = null;
    this.onShopifySectionDeselect = null;

    this._searchmodalListenerAdded = false;
    this._onSearchModalOpen = () => {
      const sec = this.closest('section');
      if (sec) sec.style.zIndex = '9';
    };

    this._togglesBound = false;

    if (this.closeTabButton) {
      this.closeTabButton.addEventListener('click', this.closeStickyTab.bind(this));
    }
  }

  connectedCallback() {
    if (window.location.pathname === '/challenge') return;

    if (!this._togglesBound) {
      this._togglesBound = true;
      this._toggleButtons = Array.from(this.querySelectorAll('[data-popup-toggle]'));
      this._toggleButtons.forEach((button) => {
        button.addEventListener('click', this._onToggleClick);
      });
    }

    this.openStickyTab();

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('cart-drawer:open', this._onCartDrawerOpen);

    if (!this.getCookie(this.cookieName)) {
      this.init();
    }

    if (Shopify?.designMode) {
      this.onShopifySectionLoad = this.onSectionLoad.bind(this);
      this.onShopifySectionSelect = this.onSectionSelect.bind(this);
      this.onShopifySectionDeselect = this.onSectionDeselect.bind(this);
      document.addEventListener('shopify:section:load', this.onShopifySectionLoad);
      document.addEventListener('shopify:section:select', this.onShopifySectionSelect);
      document.addEventListener('shopify:section:deselect', this.onShopifySectionDeselect);
    }
  }

  disconnectedCallback() {
    if (window.location.pathname === '/challenge') return;

    if (this._toggleButtons?.length) {
      this._toggleButtons.forEach((button) => {
        button.removeEventListener('click', this._onToggleClick);
      });
    }
    this._toggleButtons = null;
    this._togglesBound = false;

    if (this.closeTabButton) {
      this.closeTabButton.removeEventListener('click', this.closeStickyTab);
    }

    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('cart-drawer:open', this._onCartDrawerOpen);
    window.removeEventListener('scroll', this._activateScrollDelay);
    document.removeEventListener('scroll', this._onScrollDelay);

    if (Shopify?.designMode) {
      document.removeEventListener('shopify:section:load', this.onShopifySectionLoad);
      document.removeEventListener('shopify:section:select', this.onShopifySectionSelect);
      document.removeEventListener('shopify:section:deselect', this.onShopifySectionDeselect);
      document.body.classList.remove(this.classes.bodyClass);
    }

    if (this._searchmodalListenerAdded) {
      document.removeEventListener('searchmodal:open', this._onSearchModalOpen);
      this._searchmodalListenerAdded = false;
    }
  }

  _onKeyDown(event) {
    if (event.code?.toUpperCase() === 'ESCAPE') {
      if (this.popup?.classList.contains('popup-wrapper--disable-escape')) {
        return;
      }

      if (this.popup?.classList.contains(this.classes.openClass)) {
        this.closePopup(event);
      }
    }
  }

  onSectionLoad(event) {
    filterShopifyEvent(event, this, () => this.openPopup.bind(this));
  }
  onSectionSelect(event) {
    filterShopifyEvent(event, this, this.openPopup.bind(this));
  }
  onSectionDeselect(event) {
    filterShopifyEvent(event, this, this.closePopup.bind(this));
  }

  init() {
    if (Shopify?.designMode) return;

    if (this.dataset.delayType === 'timer') {
      const delayValue = Shopify.designMode ? 0 : parseInt(this.dataset.delay, 10);

      setTimeout(() => {
        if (!document.body.classList.contains(this.classes.bodyClass)) {
          this.openPopup();
        } else if (!this.getCookie(this.cookieName)) {
          const onVisible = () => {
            if (!document.body.classList.contains(this.classes.bodyClass)) {
              setTimeout(() => this.openPopup(), 1000);
            }
            document.removeEventListener('body:visible', onVisible);
          };
          document.addEventListener('body:visible', onVisible, { once: true });
        }
      }, (delayValue || 0) * 1000);

      return;
    }

    if (this.dataset.delayType === 'scroll') {
      const delayValue = parseInt(this.dataset.delay.slice(10).slice(0, -1), 10);
      this._scrollDelayPercent = (delayValue || 0) / 100;

      window.addEventListener('scroll', this._activateScrollDelay, { passive: true, once: true });
      return;
    }
  }

  _activateScrollDelay() {
    if (this._scrollDelayActive || this.hasPopupedUp) return;

    this._scrollDelayActive = true;
    document.addEventListener('scroll', this._onScrollDelay, { passive: true });
    this._onScrollDelay();
  }

  _onScrollDelay() {
    if (this.hasPopupedUp) return;

    const pct = this._scrollDelayPercent;
    if (pct == null) return;

    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const y = window.scrollY || window.pageYOffset || 0;
    const progress = y / maxScroll;

    if (progress >= pct) {
      this.openPopup();
      document.removeEventListener('scroll', this._onScrollDelay);
    }
  }

  onButtonClick(event) {
    event.preventDefault();
    this.popup.classList.contains(this.classes.openClass) ? this.closePopup(event) : this.openPopup();
  }

  openPopup() {
    const popupId = this.popup.dataset.popupId;

    document.querySelectorAll('.promo-popup[data-popup-id]').forEach((popupEl) => {
      if (popupEl.dataset.popupId === popupId && popupEl !== this.popup && document.body.contains(popupEl)) {
        popupEl.remove();
      }
    });
    if (!this.popupPlaceholder.parentNode) {
      this.popup.parentNode.insertBefore(this.popupPlaceholder, this.popup);
    }
    document.body.appendChild(this.popup);

    document.body.classList.remove(this.classes.bodyClass);
    this.popup.classList.add(this.classes.openClass);
    if (!this.flyout && this.overlay && !this.overlay.classList.contains(this.classes.openClass)) {
      this.overlay.classList.add(this.classes.openClass);
    }

    if (this.popup.dataset.position === 'popup') {
      document.body.classList.add(this.classes.bodyClass);
    }

    if (this.stickyTab) this.closeStickyTab();
    this.hasPopupedUp = true;

    window.removeEventListener('scroll', this._activateScrollDelay);
    document.removeEventListener('scroll', this._onScrollDelay);
  }

  closePopup(event = {}) {
    this.popup.classList.add(this.classes.closingClass);

    setTimeout(() => {
      this.popup.classList.remove(this.classes.openClass);

      if (this.overlay && event.type !== 'cart-drawer:open') {
        this.overlay.classList.remove(this.classes.openClass);
      }

      this.popup.classList.remove(this.classes.closingClass);
      this.popup.classList.remove(this.classes.showImage);
      this.openStickyTab();

      // Restore popup to original location
      if (this.popupPlaceholder && this.popupPlaceholder.parentNode) {
        this.popupPlaceholder.parentNode.insertBefore(this.popup, this.popupPlaceholder);
        this.popupPlaceholder.remove();
      }

      document.querySelectorAll('promo-popup').forEach(item => {
        const sec = item.closest('section');
        if (sec && sec.getAttribute('style')) sec.removeAttribute('style');
      });

      if (this.popup.dataset.position === 'popup' && event.type !== 'cart-drawer:open') {
        document.body.classList.remove(this.classes.bodyClass);
      }

      if (this.querySelector('.age-verification')) {
        document.dispatchEvent(new CustomEvent('body:visible'));
      }
    }, 0);

    if (Shopify?.designMode) {
      this.removeCookie(this.cookieName);
      return;
    }

    this.setCookie(this.cookieName, this.dataset.frequency);
  }

  openStickyTab() {
    if (!this.stickyTab) return;

    if (!this._searchmodalListenerAdded) {
      document.addEventListener('searchmodal:open', this._onSearchModalOpen);
      this._searchmodalListenerAdded = true;
    }

    this.stickyTab.classList.add(this.classes.openClass);
    this.stickyTab.closest('section').classList.add('open-sticky-tab');
  }

  closeStickyTab() {
    if (!this.stickyTab) return;
    this.stickyTab.classList.remove(this.classes.openClass);
    this.stickyTab.closest('section').classList.remove('open-sticky-tab');
  }

  getCookie(name) {
    const match = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return match ? match[2] : null;
  }

  setCookie(name, frequency) {
    document.cookie = `${name}=true; max-age=${(frequency * 60 * 60)}; path=/`;
  }

  removeCookie(name) {
    document.cookie = `${name}=; max-age=0`;
  }
}
customElements.define('promo-popup', PromoPopup);

class AnimateSticky extends HTMLElement {
  constructor() {
    super();

    this._inited = false;
    this._initScheduled = false;
    this._topObserver = null;
    this._bottomObserver = null;
    this._topSentinel = null;
    this._bottomSentinel = null;
    /** Sentinel / add-to-cart area fully above viewport — only then show sticky (not when still below fold). */
    this._scrolledPastAddToCart = false;
    this._atBottom = false;
    this._shown = false;

    this._reveal = () => {
      if (this._shown) return;
      this._shown = true;
      this.setAttribute('animate', '');
    };

    this._hide = () => {
      if (!this._shown) return;
      this._shown = false;
      this.removeAttribute('animate');
    };
  }

  connectedCallback() {
    this._deferInitAfterLoad();
  }

  disconnectedCallback() {
    this.destroy();
  }

  _deferInitAfterLoad() {
    if (this._inited || this._initScheduled) return;
    this._initScheduled = true;

    const run = () => {
      this._initScheduled = false;
      this.init();
    };

    const schedule = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(run, { timeout: 2000 });
      } else {
        setTimeout(run, 0);
      }
    };

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
  }

  init() {
    if (this._inited) return;
    this._inited = true;

    const section = this.closest('section');
    if (!section) return;

    const buttons = section.querySelector('.product-form__buttons');
    if (!buttons) return;

    if (!('IntersectionObserver' in window)) {
      this._initFallback(buttons);
      return;
    }

    const topSentinel = document.createElement('span');
    topSentinel.className = 'animate-sticky-sentinel';
    topSentinel.setAttribute('aria-hidden', 'true');
    topSentinel.style.cssText = 'display:block;width:1px;height:1px;margin:0;padding:0;';
    buttons.parentNode.insertBefore(topSentinel, buttons);
    this._topSentinel = topSentinel;

    const bottomSentinel = document.createElement('span');
    bottomSentinel.className = 'animate-sticky-bottom-sentinel';
    bottomSentinel.setAttribute('aria-hidden', 'true');
    bottomSentinel.style.cssText = 'display:block;width:1px;height:1px;margin:0;padding:0;';

    const footer = document.querySelector('.shopify-section-footer') || document.querySelector('footer');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(bottomSentinel, footer.nextSibling);
    } else {
      document.body.appendChild(bottomSentinel);
    }

    this._bottomSentinel = bottomSentinel;

    this._topObserver = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e) return;
      const bottom = e.boundingClientRect.bottom;
      this._scrolledPastAddToCart = typeof bottom === 'number' ? bottom <= 0 : false;
      this._apply();
    }, { root: null, threshold: 0, rootMargin: '0px' });

    this._bottomObserver = new IntersectionObserver((entries) => {
      const e = entries && entries[0];
      if (!e) return;
      this._atBottom = !!e.isIntersecting;
      this._apply();
    }, { root: null, threshold: 0, rootMargin: '0px' });

    this._topObserver.observe(topSentinel);
    this._bottomObserver.observe(bottomSentinel);
  }

  _apply() {
    if (this._atBottom || !this._scrolledPastAddToCart) {
      this._hide();
      return;
    }
    this._reveal();
  }

  _initFallback(buttons) {
    this._buttons = buttons;
    this._onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.pageYOffset || doc.scrollTop || 0;

      const remaining = doc.scrollHeight - (scrollTop + doc.clientHeight);
      const atBottom = remaining <= 1;

      const bottom = this._buttons.getBoundingClientRect().bottom;
      const scrolledPast = typeof bottom === 'number' ? bottom <= 0 : false;

      if (!atBottom && scrolledPast) this._reveal();
      else this._hide();
    };

    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onScroll, { passive: true });
    this._onScroll();
  }

  destroy() {
    if (this._topObserver) {
      this._topObserver.disconnect();
      this._topObserver = null;
    }
    if (this._bottomObserver) {
      this._bottomObserver.disconnect();
      this._bottomObserver = null;
    }

    if (this._topSentinel?.parentNode) this._topSentinel.parentNode.removeChild(this._topSentinel);
    this._topSentinel = null;

    if (this._bottomSentinel?.parentNode) this._bottomSentinel.parentNode.removeChild(this._bottomSentinel);
    this._bottomSentinel = null;

    if (this._onScroll) {
      window.removeEventListener('scroll', this._onScroll);
      window.removeEventListener('resize', this._onScroll);
      this._onScroll = null;
    }

    this._inited = false;
    this._initScheduled = false;

    this._scrolledPastAddToCart = false;
    this._atBottom = false;
    this._shown = false;
  }
}
customElements.define('animate-sticky', AnimateSticky);

class BannerHScroll extends HTMLElement {
  constructor() {
    super();

    this.rootSelector = this.getAttribute('root') || '.horizontal-banners';
    this.useVisualViewport = this.getAttribute('use-visual-viewport') !== 'false';
    this.scrollSpeed = parseFloat(this.getAttribute('scroll-speed') || '1');
    this.smooth = Math.max(0, Math.min(0.95, parseFloat(this.getAttribute('smooth') || '0.18')));
    this.forceWheelRedirect = this.getAttribute('force-wheel-redirect') === 'true';

    this.root = null;
    this.wrapper = null;
    this.track = null;

    this.enabled = false;
    this.active = false;

    this.startY = 0;
    this.endY = 0;
    this.maxX = 0;
    this.x = 0;
    this.animX = 0;

    this.animFrame = null;
    this._recomputeRaf = 0;
    this._vvTick = false;

    this._touchActive = false;
    this._touchLastX = 0;
    this._touchLastY = 0;
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchIntent = null;

    this._io = null;
    this._mediaBound = false;
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.active || !this.enabled) return;
      this.scheduleRecompute();
    });

    this._lastPinHeight = null;

    this.isRTL = document.documentElement.classList.contains('html-rtl');
    this.isCoarse = typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : 'ontouchstart' in window;

    this.onScrollHandler     = this.onScroll.bind(this);
    this.onResizeHandler     = this.onResize.bind(this);
    this.onVvResizeHandler   = this.onVvResize.bind(this);
    this.onWheelHandler      = this.onWheel.bind(this);
    this.onTouchStartHandler = this.onTouchStart.bind(this);
    this.onTouchMoveHandler  = this.onTouchMove.bind(this);
    this.onTouchEndHandler   = this.onTouchEnd.bind(this);

    this.scrollDownEl = null;
    this._scrollDownDismissed = false;
    this._scrollDownHideAfterX = 100;
    this._scrollDownState = 0;
    this._scrollDownRAF = 0;

    this._userInteracted = false;

    this._animIO = null;
    this._blocksAnimatedOnce = false;
  }

  connectedCallback() {
    this._resolveDOM();
    if (!this.root || !this.wrapper || !this.track) return;

    try {
      this.root.style.overscrollBehavior = this.root.style.overscrollBehavior || 'contain';
    } catch (_) {}

    this._setupNearViewport();
    this._setupBlocksAnimateOnMobile();

    this.root.addEventListener('touchstart', this.onTouchStartHandler, { passive: true });
    this.root.addEventListener('touchmove',  this.onTouchMoveHandler,  { passive: false });
    this.root.addEventListener('touchend',   this.onTouchEndHandler,   { passive: true  });
    this.root.addEventListener('touchcancel', this.onTouchEndHandler,  { passive: true  });

    if (this.isCoarse || this.forceWheelRedirect) {
      this.root.addEventListener('wheel', this.onWheelHandler, { passive: false });
    }
  }

  disconnectedCallback() {
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }

    if (this._animIO) {
      this._animIO.disconnect();
      this._animIO = null;
    }

    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this._recomputeRaf) cancelAnimationFrame(this._recomputeRaf);
    if (this._scrollDownRAF) cancelAnimationFrame(this._scrollDownRAF);

    this._removeActiveListeners();
    this.resizeObserver.disconnect();

    if (this.root) {
      this.root.removeEventListener('touchstart', this.onTouchStartHandler);
      this.root.removeEventListener('touchmove',  this.onTouchMoveHandler);
      this.root.removeEventListener('touchend',   this.onTouchEndHandler);
      this.root.removeEventListener('touchcancel', this.onTouchEndHandler);
      this.root.removeEventListener('wheel',      this.onWheelHandler);
    }

    this.disable();

    this.root = null;
    this.wrapper = null;
    this.track = null;
    this.scrollDownEl = null;
  }

  _resolveDOM() {
    const p = this.parentElement;
    if (p && p.matches && p.matches(this.rootSelector)) {
      this.root = p;
    } else {
      this.root = this.closest(this.rootSelector);
    }

    this.wrapper = this.root?.querySelector('.horizontal-banners__wrapper') || null;
    this.track   = this.root?.querySelector('.horizontal-banners__blocks') || null;
    this.scrollDownEl = this.root?.querySelector('.horizontal-banners__scroll-down') || null;
  }

  _setupNearViewport() {
    if (!('IntersectionObserver' in window)) {
      this._setActive(true);
      return;
    }

    this._io = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      this._setActive(!!e.isIntersecting);
    }, {
      root: null,
      rootMargin: '600px 0px',
      threshold: 0.01
    });

    this._io.observe(this.root);
  }

  _setupBlocksAnimateOnMobile() {
    if (!this.root || !this.track) return;

    if (this._blocksAnimatedOnce) return;

    if (!('IntersectionObserver' in window)) {
      if (window.innerWidth < 769) this._addBlocksAnimateOnce();
      return;
    }

    if (this._animIO) return;

    this._animIO = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (!e) return;

      if (e.isIntersecting && window.innerWidth < 769) {
        this._addBlocksAnimateOnce();
      }
    }, {
      root: null,
      rootMargin: '0px 0px',
      threshold: 0.15
    });

    this._animIO.observe(this.root);
  }

  _addBlocksAnimateOnce() {
    if (this._blocksAnimatedOnce) return;
    if (!this.track) return;
  
    this._blocksAnimatedOnce = true;
    this.track.classList.add('animate');
  
    window.setTimeout(() => {
      if (!this.track) return;
      this.track.classList.remove('animate');
    }, 1800);
  
    if (this._animIO) {
      this._animIO.disconnect();
      this._animIO = null;
    }
  }

  _addActiveListeners() {
    window.addEventListener('scroll', this.onScrollHandler, { passive: true });
    window.addEventListener('resize', this.onResizeHandler, { passive: true });

    if (this.useVisualViewport && window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onVvResizeHandler, { passive: true });
      window.visualViewport.addEventListener('scroll',  this.onVvResizeHandler, { passive: true });
    }
  }

  _removeActiveListeners() {
    window.removeEventListener('scroll', this.onScrollHandler);
    window.removeEventListener('resize', this.onResizeHandler);

    if (this.useVisualViewport && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.onVvResizeHandler);
      window.visualViewport.removeEventListener('scroll',  this.onVvResizeHandler);
    }
  }

  _bindMediaEventsOnce() {
    if (this._mediaBound || !this.root) return;
    this._mediaBound = true;

    const recomputeSoon = () => {
      if (!this.active || !this.enabled) return;
      this.scheduleRecompute();
    };

    this.root.querySelectorAll('img').forEach((img) => {
      if (img.complete) return;
      img.addEventListener('load', recomputeSoon, { passive: true });
      img.addEventListener('error', recomputeSoon, { passive: true });
    });

    this.root.querySelectorAll('video').forEach((v) => {
      v.addEventListener('loadedmetadata', recomputeSoon, { passive: true });
      v.addEventListener('loadeddata', recomputeSoon, { passive: true });
      v.addEventListener('canplay', recomputeSoon, { passive: true });
    });
  }

  _setActive(isActive) {
    if (this.active === isActive) return;
    this.active = isActive;

    if (this.active) {
      this._addActiveListeners();
      this._bindMediaEventsOnce();

      this.updateEnabledByWidth();

      if (this.enabled) {
        this.track.style.willChange = 'transform';
        this.track.style.backfaceVisibility = 'hidden';
        this.resizeObserver.observe(this.track);
        this.scheduleRecompute();
      }

      this._scheduleScrollDownUpdate();
    } else {
      this._removeActiveListeners();
      this.resizeObserver.disconnect();

      if (this.track) {
        this.track.style.removeProperty('will-change');
        this.track.style.removeProperty('backface-visibility');
      }

      if (this._userInteracted) {
        this._setScrollDownState(0);
      }
    }
  }

  scheduleRecompute() {
    if (!this.enabled || !this.active) return;
    if (this._recomputeRaf) return;

    this._recomputeRaf = requestAnimationFrame(() => {
      this._recomputeRaf = 0;
      this.recompute();
      this.onScroll();
    });
  }

  updateEnabledByWidth() {
    const mobile = window.innerWidth < 769;

    if (mobile) {
      this.disable();
      if (this.active) this._setupBlocksAnimateOnMobile();
    } else {
      this.enable();
    }

    this._scheduleScrollDownUpdate();
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.root?.setAttribute('data-hscroll', 'enabled');
    this._lastPinHeight = null;
  }

  disable() {
    this.enabled = false;

    if (this.root) {
      this.root.removeAttribute('data-hscroll');
      this.root.style.removeProperty('--pin-height');
    }
    if (this.track) {
      this.track.style.removeProperty('transform');
      this.track.style.removeProperty('will-change');
      this.track.style.removeProperty('backface-visibility');
    }
    this._lastPinHeight = null;

    if (this._userInteracted) {
      this._setScrollDownState(0);
    }
  }

  getViewportH() {
    if (this.useVisualViewport && window.visualViewport?.height) {
      return Math.round(window.visualViewport.height);
    }
    return window.innerHeight;
  }

  getContainerW() {
    return this.wrapper ? (this.wrapper.clientWidth | 0) : 0;
  }

  progressToX(progress) {
    const p = this.clamp(progress, 0, 1);
    return Math.round(this.maxX * p);
  }

  recompute() {
    if (!this.enabled || !this.active) return;

    const viewportW = this.getContainerW();
    const viewportH = this.getViewportH();
    const fullContentWidth = this.track.scrollWidth || 0;

    this.maxX = Math.max(0, fullContentWidth - viewportW);

    if (this.maxX <= 0) {
      if (this._lastPinHeight !== 'auto') {
        this.root.style.setProperty('--pin-height', 'auto');
        this._lastPinHeight = 'auto';
      }
      this.startY = Number.POSITIVE_INFINITY;
      this.endY   = Number.NEGATIVE_INFINITY;
      this.x = 0;
      this.animX = 0;
      this.applyTransform();

      this._scheduleScrollDownUpdate();
      return;
    }

    const pinHeight = viewportH + this.maxX;
    const pinHeightStr = `${pinHeight}px`;

    if (this._lastPinHeight !== pinHeightStr) {
      this.root.style.setProperty('--pin-height', pinHeightStr);
      this._lastPinHeight = pinHeightStr;
    }

    const rootRect = this.root.getBoundingClientRect();
    const docY = window.scrollY || window.pageYOffset || 0;

    this.startY = docY + rootRect.top;
    this.endY   = this.startY + pinHeight - viewportH;

    const y = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (y <= this.startY) {
      this.x = 0;
    } else if (y >= this.endY) {
      this.x = this.maxX;
    } else {
      const progress = (y - this.startY) / (this.endY - this.startY);
      this.x = this.clamp(this.progressToX(progress), 0, this.maxX);
    }

    this.applyTransform();
    this._scheduleScrollDownUpdate();
  }

  isInsidePin(y) {
    return y >= this.startY && y <= this.endY;
  }

  canConsume(delta) {
    if (delta === 0) return false;
    if (delta > 0)  return this.x < this.maxX;
    return this.x > 0;
  }

  onScroll() {
    if (!this.enabled || !this.active) return;

    if (!this._userInteracted) this._userInteracted = true;

    const y = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (y <= this.startY) {
      if (this.x !== 0) this.x = 0;
    } else if (y >= this.endY) {
      if (this.x !== this.maxX) this.x = this.maxX;
    } else {
      const progress = (y - this.startY) / (this.endY - this.startY);
      const nx = this.clamp(this.progressToX(progress), 0, this.maxX);
      if (nx !== this.x) this.x = nx;
    }

    this.applyTransform();
    this._scheduleScrollDownUpdate();
  }

  onResize() {
    if (!this.active) return;
    this.updateEnabledByWidth();
    if (this.enabled) this.scheduleRecompute();
  }

  onVvResize() {
    if (!this.enabled || !this.active) return;
    if (this._vvTick) return;
    this._vvTick = true;
    requestAnimationFrame(() => {
      this._vvTick = false;
      this.scheduleRecompute();
      this._scheduleScrollDownUpdate();
    });
  }

  onWheel(e) {
    if (!this.enabled || !this.active || this.maxX <= 0) return;

    if (!this._userInteracted) this._userInteracted = true;

    const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (!this.isInsidePin(pageY)) return;

    const dyPrimary = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    const delta = dyPrimary * this.scrollSpeed;

    if (!this.canConsume(delta)) return;

    e.preventDefault();
    const target = this.clamp(this.x + delta, 0, this.maxX);
    if (target !== this.x) {
      this.x = target;
      this.applyTransform();
      this._scheduleScrollDownUpdate();
    }
  }

  onTouchStart(e) {
    if (!this.enabled || !this.active || this.maxX <= 0 || !e.touches?.length) return;

    const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (!this.isInsidePin(pageY)) return;

    const t = e.touches[0];
    this._touchActive = true;
    this._touchStartX = this._touchLastX = t.clientX;
    this._touchStartY = this._touchLastY = t.clientY;
    this._touchIntent = null;
  }

  onTouchMove(e) {
    if (!this.enabled || !this.active || !this._touchActive || !e.touches?.length) return;

    const pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (!this.isInsidePin(pageY)) return;

    const t = e.touches[0];
    const dxTotal = t.clientX - this._touchStartX;
    const dyTotal = t.clientY - this._touchStartY;
    const absDx = Math.abs(dxTotal);
    const absDy = Math.abs(dyTotal);

    if (!this._touchIntent) {
      const threshold = 5;
      if (absDx < threshold && absDy < threshold) return;

      if (absDx > absDy * 1.2) {
        this._touchIntent = 'horizontal';
      } else {
        this._touchIntent = 'vertical';
        this._touchActive = false;
        return;
      }
    }

    if (this._touchIntent !== 'horizontal') return;

    if (!this._userInteracted) this._userInteracted = true;

    const dx = this._touchLastX - t.clientX;
    this._touchLastX = t.clientX;

    const delta = dx * this.scrollSpeed;
    if (!this.canConsume(delta)) return;

    if (e.cancelable) e.preventDefault();
    const target = this.clamp(this.x + delta, 0, this.maxX);
    if (target !== this.x) {
      this.x = target;
      this.applyTransform();
      this._scheduleScrollDownUpdate();
    }
  }

  onTouchEnd() {
    this._touchActive = false;
    this._touchIntent = null;
  }

  applyTransform() {
    if (!this.enabled || !this.active || !this.track) return;

    const curX = (this.smooth > 0 ? this.animX : this.x);

    if (this.smooth <= 0) {
      const tX = this.isRTL ? curX : -curX;
      this.track.style.transform = `translate3d(${tX}px,0,0)`;
      return;
    }

    if (this.animFrame) return;

    const tick = () => {
      this.animX += (this.x - this.animX) * this.smooth;
      if (Math.abs(this.x - this.animX) < 0.5) this.animX = this.x;

      const tx = this.isRTL ? this.animX : -this.animX;
      this.track.style.transform = `translate3d(${tx}px,0,0)`;

      if (this.animX !== this.x) {
        this.animFrame = requestAnimationFrame(tick);
      } else {
        this.animFrame = null;
      }
    };

    this.animFrame = requestAnimationFrame(tick);
  }

  _scheduleScrollDownUpdate() {
    if (!this.scrollDownEl) return;
    if (!this._userInteracted) return;

    if (this._scrollDownDismissed) {
      this._setScrollDownState(2);
      return;
    }

    if (this._scrollDownRAF) return;
    this._scrollDownRAF = requestAnimationFrame(() => {
      this._scrollDownRAF = 0;
      this._updateScrollDownNow();
    });
  }

  _updateScrollDownNow() {
    if (!this.scrollDownEl) return;

    if (this.x >= this._scrollDownHideAfterX) {
      this._scrollDownDismissed = true;
      this._setScrollDownState(2);
      return;
    }

    if (!this.active) {
      this._setScrollDownState(0);
      return;
    }

    const rect = this.root.getBoundingClientRect();
    const vh = this.getViewportH();

    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    const halfViewportVisible = (visible > 0) && (visible >= (vh * 0.5));

    if (halfViewportVisible) {
      this._setScrollDownState(1);
    } else {
      this._setScrollDownState(0);
    }
  }

  _setScrollDownState(next) {
    if (!this.scrollDownEl) return;
    if (this._scrollDownState === next) return;
    this._scrollDownState = next;

    if (next === 0) {
      this.scrollDownEl.classList.remove('show', 'hide');
      return;
    }
    if (next === 1) {
      this.scrollDownEl.classList.add('show');
      this.scrollDownEl.classList.remove('hide');
      return;
    }
    this.scrollDownEl.classList.remove('show');
    this.scrollDownEl.classList.add('hide');
  }

  clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }
}

customElements.define('banner-hscroll', BannerHScroll);

/**
 * Desktop drag-to-scroll for featured collections slider.
 * Only initializes containers with .featured-collections__scroll-container (used when desktop_style is 'slider').
 */
function initFeaturedCollectionsScroll() {
  document.querySelectorAll('.featured-collections__scroll-container:not([data-scroll-inited])').forEach(function (container) {
    container.setAttribute('data-scroll-inited', '');
    var isDown = false, startX, scrollLeft, hasDragged = false;
    container.addEventListener('mousedown', function (e) {
      if (window.innerWidth < 921) return;
      isDown = true;
      hasDragged = false;
      container.classList.add('is-dragging');
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });
    container.addEventListener('mouseleave', function () {
      isDown = false;
      container.classList.remove('is-dragging');
    });
    container.addEventListener('mouseup', function () {
      isDown = false;
      container.classList.remove('is-dragging');
    });
    container.addEventListener('mousemove', function (e) {
      if (!isDown) return;
      hasDragged = true;
      e.preventDefault();
      var x = e.pageX - container.offsetLeft;
      var walk = (x - startX);
      container.scrollLeft = scrollLeft - walk;
    });
    container.addEventListener('click', function (e) {
      if (hasDragged) e.preventDefault();
    }, true);
  });
}
document.addEventListener('DOMContentLoaded', initFeaturedCollectionsScroll);
document.addEventListener('shopify:section:load', initFeaturedCollectionsScroll);
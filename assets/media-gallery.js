if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        liveRegion: this.querySelector('[id^="GalleryStatus"]'),
        viewer: this.querySelector('[id^="GalleryViewer"]'),
        thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
        slider: this.querySelector('[id^="Slider-Thumbnails"]'),
        sliderMedia: this.querySelector('[id^="Slider-Gallery"]'),
        thumbnailsArray: this.querySelectorAll('[id^="Slide-Thumbnails"]'),
        parentContainer: this.closest('section') || this,
        sliderViewport: this.querySelector('[id^="GalleryViewer"] .slider__viewport')
      }
      this.mql = window.matchMedia('(min-width: 750px)');
      if (!this.elements.thumbnails) return;
      this.elements.slider.addEventListener('click', this.setActiveThumbnail.bind(this))
      this.elements.slider.addEventListener('keyup', (event) => {
        if (event.code.toUpperCase() === 'ENTER') this.setActiveThumbnail(event)
      })
      if (this.dataset.desktopLayout !== 'one_column_grid' && this.dataset.desktopLayout !== 'two_columns_grid' && this.mql.matches) this.removeListSemantic();
    }

    pinGalleryViewportOverflowAnchor() {
      const vp = this.elements.sliderViewport;
      if (vp) vp.style.setProperty('overflow-anchor', 'none');
    }

    _prefersReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    _easeWindowScrollTo(targetY, duration) {
      const se = document.scrollingElement || document.documentElement;
      const maxY = Math.max(0, se.scrollHeight - se.clientHeight);
      const clamped = Math.min(Math.max(0, targetY), maxY);
      const startY = se.scrollTop;
      const distance = clamped - startY;
      if (Math.abs(distance) < 1) {
        this._easeScrollStartedAt = 0;
        this._lastEaseDuration = 0;
        return;
      }

      this._easeScrollGen = (this._easeScrollGen || 0) + 1;
      const gen = this._easeScrollGen;
      this._easeScrollStartedAt = performance.now();
      this._lastEaseDuration = duration;
      this._easeScrollScheduledAt = 0;

      const startTime = performance.now();
      const easeInOutCubic = (t) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const step = (now) => {
        if (gen !== this._easeScrollGen) return;
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        if (progress >= 1) {
          se.scrollTop = clamped;
          if (gen === this._easeScrollGen) {
            this._easeScrollStartedAt = 0;
            this._lastEaseDuration = 0;
          }
          return;
        }
        se.scrollTop = startY + distance * easeInOutCubic(progress);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    setActiveMedia(mediaId) {
      const activeMedia = this.elements.viewer.querySelector(`[data-media-id="${ mediaId }"]`)
      if (this.elements.viewer.querySelectorAll(`.product__media-item--hide`).length > 0 && activeMedia) {
        let activeMediaAlt = activeMedia.dataset.mediaAlt
        this.elements.viewer.querySelectorAll(`.product__media-item:not(.product__media-item--full)`).forEach(media => {
          media.classList.remove('product__media-item--variant-alt', 'product__media-item--show')
          if (media.dataset.mediaAlt == activeMediaAlt) media.classList.add('product__media-item--variant-alt')
        })
      } 
      if (!activeMedia) return
      if (activeMedia) {
        if(this.elements.sliderMedia.classList.contains('slider-main--original') && !this.elements.sliderMedia.classList.contains('grid--peek')) {
          let height = activeMedia.offsetHeight
          if(this.elements.parentContainer.offsetWidth < 769) {
            this.elements.sliderMedia.closest('.product--side_thumbnails') ? this.elements.sliderMedia.closest('.slider-block').removeAttribute('style') : this.elements.sliderMedia.removeAttribute('style')
            this.elements.sliderViewport.style.height = height + 'px'
          } else {
            this.elements.sliderViewport.removeAttribute('style')
            this.elements.sliderMedia.closest('.product--side_thumbnails') ? this.elements.sliderMedia.closest('.slider-block').style.height = height + 'px' : this.elements.sliderMedia.style.height = height + 'px'
          }
          this.pinGalleryViewportOverflowAnchor();
        }
        const prevActiv = this.elements.viewer.querySelector(`.is-active`)
        if(prevActiv) prevActiv.classList.remove('is-active');
        if (activeMedia) activeMedia.classList.add('is-active');
        const lateralBehavior = this._prefersReducedMotion() ? 'auto' : 'smooth';
        this.elements.sliderMedia.scrollTo({
          left: activeMedia.offsetLeft,
          behavior: lateralBehavior,
        })
      }
      if (this.querySelector('[id^="GalleryThumbnails"]')) {
        const prevActiveThumbnail = this.elements.thumbnails.querySelector(`.is-active`)
        if (prevActiveThumbnail) prevActiveThumbnail.classList.remove('is-active')
        let activeMediaAlt
        let mediaIdValue
        if (activeMedia) {
          activeMediaAlt = activeMedia.dataset.mediaAlt
          mediaIdValue = activeMedia.dataset.mediaId
        }
        const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaIdValue }"]`)
        if (activeThumbnail) activeThumbnail.classList.add('is-active')
        if (this.elements.viewer.querySelectorAll(`.product__media-item--hide`).length > 0 && activeMedia) {
          this.elements.thumbnails.querySelectorAll(`.thumbnail-list__item:not(.product__media-item--full)`).forEach(thumbnail => {
            thumbnail.classList.remove('product__media-item--variant-alt', 'product__media-item--show')
            if (thumbnail.dataset.mediaAlt == activeMediaAlt) thumbnail.classList.add('product__media-item--variant-alt')
          })
        } 
        const lateralBehavior = this._prefersReducedMotion() ? 'auto' : 'smooth';
        this.elements.slider.scrollTo({
          left: activeThumbnail.offsetLeft - activeThumbnail.offsetWidth - 8,
          behavior: lateralBehavior,
        })
        if (activeThumbnail.parentElement.classList.contains('thumbnail-list--column')) {
          this.elements.thumbnails.scrollTo({
            top: activeThumbnail.offsetTop - activeThumbnail.offsetHeight - 8,
            behavior: lateralBehavior,
          })
        }
      }
      if (!activeMedia) return
      this.preventStickyHeader();
      this.playActiveMedia(activeMedia);
      if (!this.elements.thumbnails) return;
      const thumbForAnnounce = this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`);
      if (thumbForAnnounce?.dataset?.mediaPosition != null) {
        this.announceLiveRegion(activeMedia, thumbForAnnounce.dataset.mediaPosition);
      }
      this.queueScrollActiveMediaIntoViewport(activeMedia);
    }

    setActiveThumbnail(event) {
      let galleryMedia = this.elements.thumbnails.closest('.slider-block').querySelector('[id^="GalleryViewer-"]')
      if (galleryMedia && typeof galleryMedia.clearScrollEndTimer === 'function') galleryMedia.clearScrollEndTimer()
      galleryMedia.querySelector('[id^="Slider-Gallery-"]').classList.add('disable-scroll')
      if(!event.target.closest('.thumbnail-list__item')) return
      this.elements.thumbnails.querySelectorAll('button').forEach((element) => element.removeAttribute('aria-current'));
      this.elements.thumbnails.querySelectorAll('li').forEach(item => item.classList.remove('is-active'))
      galleryMedia.querySelectorAll('li').forEach(item => item.classList.remove('is-active'))
      let newActiveThumb = event.target.closest('.thumbnail-list__item')
      let activeThumbData = newActiveThumb.dataset.target
      let newActiveMedia = this.elements.sliderMedia.querySelector(`[data-media-id="${ activeThumbData }"]`)
      setTimeout(() => {
        newActiveThumb.classList.add('is-active')
        newActiveThumb.querySelector('button').setAttribute('aria-current', true);
        newActiveMedia.classList.add('is-active')
        if(this.elements.sliderMedia.classList.contains('slider-main--original') && !this.elements.sliderMedia.classList.contains('grid--peek')) {
          let height = newActiveMedia.offsetHeight
          if(this.elements.parentContainer.offsetWidth < 769) {
            this.elements.sliderMedia.closest('.product--side_thumbnails') ? this.elements.sliderMedia.closest('.slider-block').removeAttribute('style') : this.elements.sliderMedia.removeAttribute('style')
            this.elements.sliderViewport.style.height = height + 'px'
          } else {
            this.elements.sliderViewport.removeAttribute('style')
            this.elements.sliderMedia.closest('.product--side_thumbnails') ? this.elements.sliderMedia.closest('.slider-block').style.height = height + 'px' : this.elements.sliderMedia.style.height = height + 'px'
          }
          this.pinGalleryViewportOverflowAnchor();
        }
          this.elements.sliderMedia.scrollTo({
          left: newActiveMedia.offsetLeft
        })
        if (this.elements.slider.classList.contains('thumbnail-list--column')) {
          this.elements.slider.closest('.thumbnail-slider--column').scrollTo({
            top: newActiveThumb.offsetTop - newActiveThumb.offsetHeight - 8,
            behavior: 'smooth'
          })
        } else {
          this.elements.slider.scrollTo({
            left: newActiveThumb.offsetLeft - newActiveThumb.offsetWidth - 8,
            behavior: 'smooth'
          })
        }
      }, 5) 
      setTimeout(() => {
        galleryMedia.querySelector('[id^="Slider-Gallery-"]').classList.remove('disable-scroll')
      }, 500)
    }

    announceLiveRegion(activeItem, position) {
      const image = activeItem.querySelector('.product__modal-opener--image img');
      if (!image) return;
      const announce = () => {
        this.elements.liveRegion.setAttribute('aria-hidden', false);
        this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace(
          '[index]',
          position
        );
        if (image.closest('.lazy-image')) image.parentNode.classList.add('lazyloaded');
        setTimeout(() => {
          this.elements.liveRegion.setAttribute('aria-hidden', true);
        }, 2000);
      };
      if (image.complete && image.naturalWidth > 0) {
        announce();
        return;
      }
      image.onload = () => announce();
    }

    playActiveMedia(activeItem) {
      window.pauseAllMedia();
      const deferredMedia = activeItem.querySelector('.deferred-media');
      if (deferredMedia) deferredMedia.loadContent(false);
    }

    preventStickyHeader() {
      this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
      if (!this.stickyHeader) return;
      this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
    }

    queueScrollActiveMediaIntoViewport(activeMedia) {
      if (!activeMedia || activeMedia.classList.contains('product__media-item--hide')) return;
      const layout = this.dataset.desktopLayout;
      if (layout !== 'one_column_grid' && layout !== 'two_columns_grid') return;

      this._easeScrollScheduledAt = performance.now();

      const run = () => this.scrollActiveMediaIntoViewport(activeMedia);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(run);
        });
      });
    }

    scrollActiveMediaIntoViewport(activeMedia, behaviorOverride) {
      if (!activeMedia || activeMedia.classList.contains('product__media-item--hide')) return;
      const layout = this.dataset.desktopLayout;
      if (layout !== 'one_column_grid' && layout !== 'two_columns_grid') return;

      const headerRaw = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim();
      let headerOffset = 0;
      if (headerRaw.endsWith('px')) {
        headerOffset = parseFloat(headerRaw) || 0;
      } else if (headerRaw) {
        headerOffset = parseFloat(headerRaw) || 0;
      }

      const edgeMargin = 16;

      const rect = activeMedia.getBoundingClientRect();
      const scrollMarginTop = parseFloat(getComputedStyle(activeMedia).scrollMarginTop) || 0;
      const topVisible = rect.top >= headerOffset + edgeMargin + scrollMarginTop;
      const bottomVisible = rect.bottom <= window.innerHeight - edgeMargin;
      if (topVisible && bottomVisible) {
        this._easeScrollScheduledAt = 0;
        this._easeScrollStartedAt = 0;
        this._lastEaseDuration = 0;
        return;
      }

      const se = document.scrollingElement || document.documentElement;
      const targetTop = se.scrollTop + rect.top - headerOffset - edgeMargin - scrollMarginTop;
      const y = Math.max(0, targetTop);
      if (this._prefersReducedMotion()) {
        const maxY = Math.max(0, se.scrollHeight - se.clientHeight);
        se.scrollTop = Math.min(y, maxY);
        this._easeScrollScheduledAt = 0;
        this._easeScrollStartedAt = 0;
        this._lastEaseDuration = 0;
        return;
      }
      const MAIN_MS = 520;
      const CORRECTION_MS = 280;
      const duration = behaviorOverride === 'correction' ? CORRECTION_MS : MAIN_MS;
      this._easeWindowScrollTo(y, duration);
    }

    alignActiveMediaAfterVariantPicker() {
      const active = this.elements.viewer?.querySelector('.product__media-item.is-active');
      if (!active) return;
      clearTimeout(this._alignAfterPickerTimer);

      const MAIN_MS = 520;
      const BUFFER_MS = 56;
      const started = this._easeScrollStartedAt || 0;
      const scheduled = this._easeScrollScheduledAt || 0;
      const tRef = started || scheduled;
      const easeDuration =
        started && this._lastEaseDuration > 0 ? this._lastEaseDuration : MAIN_MS;
      const elapsed = tRef ? performance.now() - tRef : Infinity;
      const waitForEaseEnd = tRef ? Math.max(0, easeDuration + BUFFER_MS - elapsed) : 0;
      const delay = Math.max(72, waitForEaseEnd);

      this._alignAfterPickerTimer = setTimeout(() => {
        this._alignAfterPickerTimer = null;
        if (!this.isConnected) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() =>
            this.scrollActiveMediaIntoViewport(active, 'correction')
          );
        });
      }, delay);
    }

    removeListSemantic() {
      if (!this.elements.viewer.slider) return;
      this.elements.viewer.slider.setAttribute('role', 'presentation');
      this.elements.viewer.sliderItems.forEach(slide => slide.setAttribute('role', 'presentation'));
    }
  });
}

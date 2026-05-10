if (!customElements.get('shoppable-media-slider')) {
  customElements.define('shoppable-media-slider', class ShoppableMediaSlider extends HTMLElement {
    static lastIndexBySection = new Map();

    constructor() {
      super();
      this.swiper = null;
      this.sectionId = this.dataset.sectionId;
      this._navRaf = 0;
      this._lastNav = { top: null, left: null, right: null, activeIndex: null, h: null, w: null };
      this._navEls = null;
      this._inView = false;
      this._io = null;

      this._cssRead = false;
      this._cssReadRaf = 0;
    }

    connectedCallback() {
      if (this.swiper || !window.Swiper) return;
    
      this.setEventListeners();
      if (Shopify.designMode) {
        this.setDesignModeListeners();
      }
      if (Shopify.designMode) {
        this.initSwiper();
        return;
      }
      this._initInViewObserver();
    }

    initSwiper() {
      if (this.swiper) {
        this.swiper.destroy(true, true);
        this.swiper = null;
      }

      if (!this._cssRead) {
        const styles = getComputedStyle(this);
        this._css = this._css || {};
        this._css.slideGap = parseInt(styles.getPropertyValue('--slide-offset'), 10) || 0;
        this._css.desktopW = parseInt(styles.getPropertyValue('--desktop-slide-width'), 10) || 0;
        this._css.mobileW  = parseInt(styles.getPropertyValue('--mobile-slide-width'), 10) || 0;
        this._css.activeOffset = parseInt(styles.getPropertyValue('--active-slide-offset'), 10) || 0;
        this._cssRead = true;
      } else {
        this._readCssVars(false);
      }
      const { canLoop, slidesPerView, loopAdditionalSlides } = this.computeSliderParams();
      const initialSlideIndex = ShoppableMediaSlider.lastIndexBySection.has(this.sectionId)
        ? Number(ShoppableMediaSlider.lastIndexBySection.get(this.sectionId))
        : 0;
      const userEnabledLoop = this.dataset.loop === 'true';

      this.slideOffset = this._css.slideGap;
      this.activeSlideOffset = this._css.activeOffset;
      this.sliderSpeed = 200;
      this.canLoop = canLoop;
      this.loopAdditionalSlides = loopAdditionalSlides;
      this.currentSlidesPerView = slidesPerView;
      this.videos = this.querySelectorAll('video');

      const swiperConfig = {
        initialSlide: initialSlideIndex,
        slidesPerView: slidesPerView, 
        loop: userEnabledLoop && canLoop,
        spaceBetween: this.slideOffset,
        freeMode: false,
        autoHeight: false,
        roundLengths: true,
        resistanceRatio: 0,
        loopAdditionalSlides: loopAdditionalSlides,
        speed: this.sliderSpeed,
        grabCursor: true,
        centeredSlides: true,
        slideToClickedSlide: false,
        navigation: {
          nextEl: ".swiper-button-next",
          prevEl: ".swiper-button-prev"
        },
        on: {
          init: () => this.onSliderInit(),
          resize: () => this._scheduleNavPosition(),
          slideChangeTransitionStart: () => {
            this.playActiveSlideVideo();
          },
          slideChangeTransitionEnd: () => {
            this.pauseInactiveVideos();
            this.handleSlideChangeTransitionEnd();
          },
          click: (swiper, event) => this.slideToClickedSlide(swiper, event),
          touchStart: () => this.handleTouchStart(),
          touchMove: (event) => this.handleTouchMove(event),
          touchEnd: () => this.handleTouchEnd(),
          touchCancel: () => this.handleTouchEnd(),
        }
      };
    
      this.swiper = new Swiper(this, swiperConfig);
    }

    _initInViewObserver() {
      if (this._io) return;
    
      this._io = new IntersectionObserver((entries) => {
        const e = entries[0];
        if (!e) return;
    
        if (e.isIntersecting || e.intersectionRatio > 0) {
          this._inView = true;
          this._io.disconnect();
          this._io = null;
    
          requestAnimationFrame(() => this.initSwiper());
        }
      }, { root: null, threshold: 0.01 });
    
      this._io.observe(this);
    }

    _scheduleNavPosition() {
      if (this._navRaf) return;
      this._navRaf = requestAnimationFrame(() => {
        this._navRaf = 0;
        this.updateNavPosition();
      });
    }

    _readCssVars(force = false) {
      if (this._cssRead && !force) return;
      if (this._cssReadRaf) return;
    
      this._cssReadRaf = requestAnimationFrame(() => {
        this._cssReadRaf = 0;
    
        const styles = getComputedStyle(this);
    
        const slideGap = parseInt(styles.getPropertyValue('--slide-offset'), 10) || 0;
        const desktopW = parseInt(styles.getPropertyValue('--desktop-slide-width'), 10) || 0;
        const mobileW  = parseInt(styles.getPropertyValue('--mobile-slide-width'), 10) || 0;
        const activeOffset = parseInt(styles.getPropertyValue('--active-slide-offset'), 10) || 0;
    
        this._css = this._css || {};
    
        const same =
          this._css.slideGap === slideGap &&
          this._css.desktopW === desktopW &&
          this._css.mobileW === mobileW &&
          this._css.activeOffset === activeOffset;
    
        if (!same) {
          this._css.slideGap = slideGap;
          this._css.desktopW = desktopW;
          this._css.mobileW = mobileW;
          this._css.activeOffset = activeOffset;
    
          this._paramsDirty = true;
        }
    
        this._cssRead = true;
      });
    }

    _getSlidesAmount() {
      if (this._slidesAmount != null && !this._slidesAmountDirty) return this._slidesAmount;
      this._slidesAmount = this.querySelectorAll('.shoppable-media-slider__slide').length;
      this._slidesAmountDirty = false;
      return this._slidesAmount;
    }

    computeSliderParams() {
      const containerWidth = this.clientWidth || 0;
    
      const MIN_SLIDES_PER_VIEW = 1.4;
      const MOBILE_THRESHOLD = 768;
      const isMobileContainer = containerWidth <= MOBILE_THRESHOLD;
    
      const SLIDES_GAP = this._css?.slideGap ?? 0;
      const DESKTOP_SLIDE_WIDTH = this._css?.desktopW ?? 0;
      const MOBILE_SLIDE_WIDTH = this._css?.mobileW ?? 0;
    
      const SLIDE_WIDTH = isMobileContainer ? MOBILE_SLIDE_WIDTH : DESKTOP_SLIDE_WIDTH;
    
      if (!SLIDE_WIDTH) {
        const slidesPerView = MIN_SLIDES_PER_VIEW;
        const slidesAmount = this._getSlidesAmount();
        const canLoop = slidesAmount >= Math.ceil(slidesPerView) + 1;
        return { slidesPerView, canLoop, loopAdditionalSlides: isMobileContainer ? 1 : 0 };
      }
    
      const slidesPerView = Math.max(
        MIN_SLIDES_PER_VIEW,
        (containerWidth + SLIDES_GAP) / (SLIDE_WIDTH + SLIDES_GAP)
      );
    
      const slidesAmount = this._getSlidesAmount();
      const canLoop = slidesAmount >= Math.ceil(slidesPerView) + 1;
      const loopAdditionalSlides = isMobileContainer ? 1 : 0;
    
      this._lastContainerWidth = containerWidth;
    
      return { slidesPerView, canLoop, loopAdditionalSlides };
    }

    setEventListeners() {
      this._resizeRaf = 0;
      this._onResize = () => {
        if (this._resizeRaf) return;
      
        this._resizeRaf = requestAnimationFrame(() => {
          this._resizeRaf = 0;
      
          const width = this.clientWidth || 0;
          const isMobile = width <= 768;
      
          if (this._wasMobile == null) {
            this._wasMobile = isMobile;
          }
      
          if (this._wasMobile !== isMobile) {
            this._wasMobile = isMobile;
            this._cssRead = false;
            this._paramsDirty = true;
          }
      
          this.reinitIfParamsChanged();
          this._scheduleNavPosition();
        });
      };
      window.addEventListener('resize', this._onResize);

    
      this.soundControls = this.querySelectorAll('.shoppable-media-slider__control--sound');
      this.handleSoundControlClick = this.handleSoundControlClick.bind(this);
      this.soundControls.forEach(el => el.addEventListener('click', this.handleSoundControlClick));
    
      this.playbackControls = this.querySelectorAll('.shoppable-media-slider__control--playback');
      this.handlePlaybackControlClick = this.handlePlaybackControlClick.bind(this);
      this.playbackControls.forEach(el => el.addEventListener('click', this.handlePlaybackControlClick));
    }

    setDesignModeListeners() {
      this.onSectionLoad = (event) => {
        const sectionId = event.detail?.sectionId;

        if (sectionId === this.sectionId && this.swiper) {
          this.swiper.update();
        }
      };

      this.onBlockSelect = (event) => {
        const sectionId = event.detail?.sectionId;

        if (sectionId === this.sectionId  && this.swiper) {
          const block = event.target;
          const blockSlideIndex = this.getSlideIndex(block);

          if (blockSlideIndex !== this.getCurrentIndex()) {
            this.slideTo(blockSlideIndex);
          }
        }
      };

      document.addEventListener('shopify:block:select', this.onBlockSelect);
      document.addEventListener('shopify:section:load', this.onSectionLoad);
    }

    reinitIfParamsChanged() {
      const { canLoop, loopAdditionalSlides, slidesPerView } = this.computeSliderParams();
    
      if (
        canLoop !== this.canLoop ||
        loopAdditionalSlides !== this.loopAdditionalSlides ||
        slidesPerView !== this.currentSlidesPerView
      ) {
        this.initSwiper();
      }
    }

    slideToClickedSlide(swiper, event) {
      const clickedSlide = event.target.closest('.shoppable-media-slider__slide-main-content');

      if (!clickedSlide || clickedSlide.closest('.swiper-slide-active')) {
        return;
      }

      const slideIndex = this.getSlideIndex(swiper.clickedSlide);

      if (slideIndex === this.getCurrentIndex()) {
        return;
      }

      clickedSlide.classList.add('cursor-pointer');

      this.slideTo(slideIndex);

      setTimeout(() => {
        clickedSlide.classList.remove('cursor-pointer');
      }, this.sliderSpeed);
    }

    handleTouchStart() {
      this.dragStarted = false;
      this._touchIntent = null;
    
      const activeSlide = this.querySelector('.swiper-slide-active');
      activeSlide?.classList.add('shoppable-media-slider__slide--large-margins');
    }
    
    handleTouchMove(event) {
      const touches = event.touches;
      if (!touches) return;
    
      const dx = Math.abs(touches.currentX - touches.previousX);
      const dy = Math.abs(touches.currentY - touches.previousY);
      const THRESHOLD = 5; 
    
      if (!this._touchIntent) {
        if (dx > dy && dx > THRESHOLD) this._touchIntent = 'horizontal';
        else if (dy > dx && dy > THRESHOLD) this._touchIntent = 'vertical';
      }

      if (this._touchIntent === 'horizontal' && !this.dragStarted) {
        this.dragStarted = true;
        this.classList.add('is-dragging');
      }
    
      if (this._touchIntent === 'vertical' && this.classList.contains('is-dragging')) {
        this.dragStarted = false;
        this.classList.remove('is-dragging');
      }
    }
    
    handleTouchEnd() {
      this.dragStarted = false;
      this.classList.remove('is-dragging');
      this._touchIntent = null;
    
      const slideWithLargeMargins = this.querySelector('.shoppable-media-slider__slide--large-margins');
      slideWithLargeMargins?.classList.remove('shoppable-media-slider__slide--large-margins');
    }

    handleSlideChangeTransitionEnd() {
      this.playActiveSlideVideo();
    }

    handleSoundControlClick(event) {
      const soundControl = event.currentTarget;
      const soundControlsMuteIcons = this.querySelectorAll('.shoppable-media-slider__control-icon--mute');
      const soundControlsUnmuteIcons = this.querySelectorAll('.shoppable-media-slider__control-icon--unmute');
      const muteIcon = soundControl.querySelector('.shoppable-media-slider__control-icon--mute');
      const unmuteIcon = soundControl.querySelector('.shoppable-media-slider__control-icon--unmute');

      const isMuted = muteIcon.classList.contains('hidden');
      const isUnmuted = unmuteIcon.classList.contains('hidden');

      if (+isMuted + +isUnmuted !== 1) {
        return;
      }

      const video = soundControl.closest('.shoppable-media-slider__slide-main-content').querySelector('video');
      video.muted = !video.muted;

      soundControlsMuteIcons.forEach(icon => icon.classList.toggle('hidden'));
      soundControlsUnmuteIcons.forEach(icon => icon.classList.toggle('hidden'));
      this.soundControls.forEach(control => control.setAttribute('aria-label', `${isMuted ? window.accessibilityStrings.unmute : window.accessibilityStrings.mute}`));

      if (isMuted) {
        this.removeAttribute("data-muted");
      } else {
        this.setAttribute("data-muted", "true");
      }
    }

    handlePlaybackControlClick(event) {
      const playbackControl = event.currentTarget;
      const playbackControlsPlayIcons = this.querySelectorAll('.shoppable-media-slider__control-icon--play');
      const playbackControlsPauseIcons = this.querySelectorAll('.shoppable-media-slider__control-icon--pause');
      const playIcon = playbackControl.querySelector('.shoppable-media-slider__control-icon--play');
      const pauseIcon = playbackControl.querySelector('.shoppable-media-slider__control-icon--pause');

      const isPlaying = playIcon.classList.contains('hidden');
      const isPaused = pauseIcon.classList.contains('hidden');

      if (+isPlaying + +isPaused !== 1) {
        return;
      }

      const video = playbackControl.closest('.shoppable-media-slider__slide-main-content').querySelector('video');
      if (video.paused && isPaused) {
        video.play();
        video.muted = Boolean(this.dataset.muted);
      } else if (!video.paused && isPlaying) {
        video.pause();
      } 

      playbackControlsPlayIcons.forEach(icon => icon.classList.toggle('hidden'));
      playbackControlsPauseIcons.forEach(icon => icon.classList.toggle('hidden'));
      this.playbackControls.forEach(control => control.setAttribute('aria-label', `${isPlaying ? window.accessibilityStrings.play : window.accessibilityStrings.pause}`));

      if (isPaused) {
        this.setAttribute("data-allow-video-autoplay", "true");
      } else {
        this.removeAttribute("data-allow-video-autoplay");
      }
    }

    pauseAllVideos() {
      this.videos.forEach(video => {
        video.pause();
      });
    }

    playActiveSlideVideo() {
      if (!this.dataset.allowVideoAutoplay) return;

      const activeIndex = this.swiper.activeIndex;
      const activeSlide = this.swiper.slides[activeIndex];
      
      if (activeSlide) {
        const activeVideo = activeSlide.querySelector('video');
        if (activeVideo) {
          activeVideo.play().catch(e => console.warn("Autoplay blocked", e));
          activeVideo.muted = Boolean(this.dataset.muted);
        }
      }
    }

    pauseInactiveVideos() {
      const activeIndex = this.swiper.activeIndex;
      const activeSlide = this.swiper.slides[activeIndex];
      const activeVideo = activeSlide?.querySelector('video');

      this.videos.forEach(video => {
        if (video !== activeVideo) {
          video.pause();
        }
      });
    }

    onSliderInit() {
      this._scheduleNavPosition();
      this.pauseAllVideos();
      this.playActiveSlideVideo();
    }

    updateNavPosition() {
      if (!this.swiper) return;
    
      if (!this._navEls) {
        const nav = this.swiper.navigation;
        this._navEls = { prev: nav?.prevEl, next: nav?.nextEl };
      }
    
      const prevButton = this._navEls?.prev;
      const nextButton = this._navEls?.next;
    
      const activeIndex = this.swiper.activeIndex;
      const activeSlide = this.swiper.slides[activeIndex];
      if (!activeSlide || !prevButton || !nextButton) return;
    
      const sliderWidth = this.clientWidth;
      const activeContent = activeSlide.querySelector('.shoppable-media-slider__slide-main-content');
      if (!activeContent) return;
    
      const activeSlideMediaHeight = activeContent.clientHeight;
      const activeSlideWidth = activeSlide.clientWidth;
    
      if (!this._navEls.prevW) this._navEls.prevW = prevButton.offsetWidth;
      if (!this._navEls.nextW) this._navEls.nextW = nextButton.offsetWidth;
    
      const prevButtonWidth = this._navEls.prevW;
      const nextButtonWidth = this._navEls.nextW;
    
      const buttonOffsetFromSliderCenter = sliderWidth / 2 - activeSlideWidth / 2 - this.activeSlideOffset / 2;
    
      const left = buttonOffsetFromSliderCenter - (prevButtonWidth / 2);
      const right = buttonOffsetFromSliderCenter - (nextButtonWidth / 2);
      const top = activeSlideMediaHeight / 2;
    
      if (this._lastNav.activeIndex !== activeIndex || this._lastNav.top !== top) {
        prevButton.style.top = `${top}px`;
        nextButton.style.top = `${top}px`;
        this._lastNav.top = top;
      }
      if (this._lastNav.left !== left) {
        prevButton.style.insetInlineStart = `${left}px`;
        this._lastNav.left = left;
      }
      if (this._lastNav.right !== right) {
        nextButton.style.insetInlineEnd = `${right}px`;
        this._lastNav.right = right;
      }
    
      this._lastNav.activeIndex = activeIndex;
    }

    disconnectedCallback() {
      const lastViewedBlockIndex = this.getCurrentIndex();
      ShoppableMediaSlider.lastIndexBySection.set(this.sectionId, lastViewedBlockIndex);

      if (this._io) {
        this._io.disconnect();
        this._io = null;
      }

      if (this._onResize) window.removeEventListener('resize', this._onResize);

      if (this.onBlockSelect) {
        document.removeEventListener('shopify:block:select', this.onBlockSelect);
        this.onBlockSelect = null;
      }

      if (this.onSectionLoad) {
        document.removeEventListener('shopify:section:load', this.onSectionLoad);
        this.onSectionLoad = null;
      }

      if (this.debouncedReinitIfParamsChanged) {
        window.removeEventListener('resize', this.debouncedReinitIfParamsChanged);
      }

      if (this.soundControls) {
        this.soundControls.forEach(soundControl => {
          soundControl.removeEventListener('click', this.handleSoundControlClick);
        });
      }
      
      if (this.playbackControls) {
        this.playbackControls.forEach(playbackControl => {
          playbackControl.removeEventListener('click', this.handlePlaybackControlClick);
        });
      }
      
      if (this.swiper) {
        this.swiper.destroy(true, true);
        this.swiper = null;
      }
    }

    getCurrentIndex() {
      if (!this.swiper) return 0;

      return this.swiper.params.loop ? this.swiper.realIndex : this.swiper.activeIndex;
    }

    getSlideIndex(slide) {
      return +slide.dataset.swiperSlideIndex || (parseInt(slide.getAttribute('aria-label'), 10) - 1);
    }

    slideTo(index, speed = this.sliderSpeed) {
      if (this.swiper.params.loop) {
        this.swiper.slideToLoop(index, speed);
      } else {
        this.swiper.slideTo(index, speed);
      }
    }
  });
}

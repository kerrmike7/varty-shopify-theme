if (!customElements.get('product-modal')) {
  customElements.define('product-modal', class ProductModal extends ModalWindow {
    constructor() {
      super();
      this.modalOverlay = this.querySelector('.product-media-modal__content');
      this.closeButton = this.querySelector('.product-media-modal__toggle')

      this._originalParent = this.parentNode;
      this._nextSibling = this.nextElementSibling;

      if (this.modalOverlay) {
        this.modalOverlay.addEventListener('click', (event) => {
          if (
            !event.target.closest('.product-media-modal__wrapper--default') &&
            !event.target.closest('.slider-button') &&
            !event.target.closest('.slider__grid-item') &&
            !event.target.closest('.image-magnify-full-size')
          ) {
            this.hide();
          }
        });
      }
      this.closeButton.addEventListener('click', ()=> this.hide())

    }

    hide() {
      super.hide();

      if (this._originalParent) {
        if (this._nextSibling) {
          this._originalParent.insertBefore(this, this._nextSibling);
        } else {
          this._originalParent.appendChild(this);
        }
      }
    }

    show(opener) {
      document.body.appendChild(this);

      super.show(opener);
      this.showActiveMedia();
    }

    showActiveMedia() {
      this.querySelectorAll('img').forEach(image => image.removeAttribute('loading'));

      const currentMediaId = this.openedBy.getAttribute("data-media-id");

      this.querySelectorAll(`[data-media-id]:not([data-media-id="${currentMediaId}"])`).forEach((element) => {
        element.classList.remove('active');
      });

      const activeMedia = this.querySelector(`[data-media-id="${currentMediaId}"]`);
      const dataMediaAlt = activeMedia?.dataset.mediaAlt;

      this.querySelectorAll('[data-media-alt]').forEach(element => {
        element.classList.remove('product__media-item--variant--alt');
      });

      this.querySelectorAll(`[data-media-alt="${dataMediaAlt}"]`).forEach(element => {
        element.classList.add('product__media-item--variant--alt');
      });

      const activeMediaTemplate = activeMedia?.querySelector('template');
      const activeMediaContent = activeMediaTemplate ? activeMediaTemplate.content : null;

      activeMedia?.classList.add('active');
      activeMedia?.scrollIntoView();

      const container = this.querySelector('[role="document"]');
      if (container && activeMedia) {
        container.scrollLeft = (activeMedia.width - container.clientWidth) / 2;
      }

      if (
        activeMedia?.nodeName === 'DEFERRED-MEDIA' &&
        activeMediaContent?.querySelector('.js-youtube')
      ) {
        activeMedia.loadContent();
      }

      document.dispatchEvent(new CustomEvent('image:show'));
    }
  });
}
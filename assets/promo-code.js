if (!customElements.get('promo-code')) {
    customElements.define('promo-code', class PromoCode extends HTMLElement {
        constructor() {
            super();
            this.button = this.querySelector('.copy-button')
            this.content = this.querySelector('.promo-code__field span')
            this.copyMessage = this.querySelector('.copy-label')
            this.successMessage = this.querySelector('.copy-success')
    
            this.button.addEventListener('click', (event) => {
            this.copyToClipboard(event)
            })
        }
    
        copyToClipboard() {
            event.preventDefault()
            navigator.clipboard.writeText(this.content.innerHTML).then(() => {
                if (this.copyMessage) this.copyMessage.classList.replace('show', 'hide')
                this.successMessage.classList.replace('hide', 'show')
            })
            setTimeout(() => {
                if (this.copyMessage) this.copyMessage.classList.replace('hide', 'show')
                this.successMessage.classList.replace('show', 'hide')
            }, 1600)
        }
    })
}
class BlogFilter extends HTMLElement {
  constructor() {
    super();

    const filter = document.querySelector('.blog__filters-select select');
    filter.addEventListener('change', function() {
      window.location = filter.value;
    });
  }
}

customElements.define('blog-filter', BlogFilter);
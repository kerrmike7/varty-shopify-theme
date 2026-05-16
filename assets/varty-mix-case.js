(() => {
  const selectors = document.querySelectorAll('.varty-mix-selector');

  selectors.forEach((selector) => {
    const requiredTotal = Number(selector.dataset.requiredTotal || 6);
    const inputs = [...selector.querySelectorAll('[data-varty-mix-input]')];
    const totalNode = selector.querySelector('[data-varty-mix-total]');
    const form = selector.closest('form');
    const submit = form?.querySelector('[name="add"]');

    const update = () => {
      const total = inputs.reduce((sum, input) => sum + Number(input.value || 0), 0);
      if (totalNode) totalNode.textContent = String(total);
      selector.classList.toggle('is-invalid', total !== requiredTotal);
      if (submit) submit.disabled = total !== requiredTotal;
    };

    inputs.forEach((input) => {
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    });

    update();
  });
})();

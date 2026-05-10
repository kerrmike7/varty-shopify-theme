let themeRole = Shopify.theme.role ?? 'unknown';

if (!localStorage.getItem('avante-theme-loaded') || localStorage.getItem('avante-theme-loaded') !== themeRole) {
  fetch('https://check.staylime.com/check.php', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
    mode: 'cors',
    body: new URLSearchParams({
      shop: Shopify.shop,
      theme: 'Avante',
      preset_name: window.Shopify.theme.name,
      version: document.querySelector('script[src*=theme-editor][data-version]')?.dataset.version,
      role: themeRole,
      contact: document.querySelector('script[src*=theme-editor][data-contact]')?.dataset.contact,
      theme_id: Shopify.theme.id
    })
  })
    .then((response) => {
      if (response.ok) {
        localStorage.setItem('avante-theme-loaded', themeRole);
      }
    });
}
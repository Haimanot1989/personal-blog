const root = document.querySelector('[data-search-root]');

if (root) {
  const input = document.querySelector('#site-search-input');
  const form = input.form;
  const query = new URL(window.location.href).searchParams.get('q') ?? '';
  input.value = query;

  try {
    // Pagefind generates this module in dist, not in the source tree.
    const componentUrl = new URL('/pagefind/pagefind-component-ui.js', window.location.origin);
    await import(componentUrl.href);
    const instance = window.PagefindComponents.getInstanceManager().getInstance('default');
    const syncQuery = (term) => {
      const url = new URL(window.location.href);
      if (term) url.searchParams.set('q', term);
      else url.searchParams.delete('q');
      window.history.replaceState(null, '', url);

      input.value = term;
      for (const link of document.querySelectorAll('.language-switcher a')) {
        const target = new URL(link.href);
        if (term) target.searchParams.set('q', term);
        else target.searchParams.delete('q');
        link.href = target.href;
      }
    };

    instance.on('search', syncQuery);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      instance.triggerSearch(input.value.trim());
    });
    syncQuery(query);
    if (query.trim()) instance.triggerSearch(query);
  } catch (error) {
    console.error('Could not initialize journal search.', error);
    root.querySelector('[data-search-error]').hidden = false;
  }
}

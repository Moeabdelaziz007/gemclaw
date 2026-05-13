(function() {
  try {
    const savedTheme = localStorage.getItem('aether-theme');
    const theme = savedTheme || 'dark';

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

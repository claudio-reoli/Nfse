/**
 * NFS-e Antigravity — SPA Router
 * Lightweight hash-based router for page navigation
 */
export class Router {
  constructor(contentEl) {
    this.routes = {};
    this.contentEl = contentEl;
    this.currentRoute = null;
    window.addEventListener('hashchange', () => this.resolve());
  }

  register(path, handler) {
    this.routes[path] = handler;
    return this;
  }

  navigate(path) {
    window.location.hash = path;
  }

  resolve() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const handler = this.routes[hash];

    if (handler) {
      this.currentRoute = hash;
      this.contentEl.innerHTML = '';
      this.contentEl.classList.add('animate-fade-in');
      handler(this.contentEl);

      // Update sidebar navigation
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.route === hash);
      });

      // Update breadcrumb
      const breadcrumb = document.querySelector('.header-breadcrumb span');
      if (breadcrumb) {
        breadcrumb.textContent = this.getPageTitle(hash);
      }

      requestAnimationFrame(() => {
        this.contentEl.classList.remove('animate-fade-in');
      });
    }
  }

  getPageTitle(hash) {
    const titles = {
      '/dashboard': 'Dashboard',
      '/emissao-dps': 'Emissão de DPS',
      '/consulta-nfse': 'Consulta NFS-e',
      '/eventos': 'Eventos',
      '/decisao-judicial': 'Decisão Judicial',
      '/parametros': 'Parâmetros Municipais',
      '/configuracoes': 'Configurações',
    };
    return titles[hash] || 'Página';
  }

  start() {
    this.resolve();
  }
}

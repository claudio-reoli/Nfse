/**
 * NFS-e Freire — SPA Router
 * Lightweight hash-based router for page navigation
 */
export class Router {
  constructor(contentEl, options = {}) {
    this.routes = {};
    this.contentEl = contentEl;
    this.currentRoute = null;
    this.onRouteChange = options.onRouteChange || (() => {});
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
    let path = (window.location.hash || '').slice(1).trim() || '/dashboard';
    if (path && !path.startsWith('/')) path = '/' + path;
    const handler = this.routes[path];

    if (handler) {
      this.currentRoute = path;
      this.contentEl.innerHTML = '';
      this.contentEl.classList.add('animate-fade-in');
      handler(this.contentEl);
      this.onRouteChange(path);

      // Update sidebar navigation
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.route === path);
      });

      // Update breadcrumb
      const breadcrumb = document.querySelector('.header-breadcrumb span');
      if (breadcrumb) {
        breadcrumb.textContent = this.getPageTitle(path);
      }

      requestAnimationFrame(() => {
        this.contentEl.classList.remove('animate-fade-in');
      });
    }
  }

  getPageTitle(path) {
    const titles = {
      '/dashboard': 'Dashboard',
      '/emissao-dps': 'Emissão de DPS',
      '/consulta-nfse': 'Consulta NFS-e',
      '/minhas-notas': 'Minhas Notas',
      '/eventos': 'Eventos',
      '/guias': 'Guias de Recolhimento',
      '/decisao-judicial': 'Decisão Judicial',
      '/adn': 'Integração ADN',
      '/parametros': 'Parâmetros Municipais',
      '/gestao-acessos': 'Gestão de Acessos',
      '/configuracoes': 'Configurações',
      '/consulta-notas': 'Notas Importadas (ADN)',
    };
    return titles[path] || 'Página';
  }

  start() {
    this.resolve();
  }
}

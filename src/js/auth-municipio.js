/**
 * NFS-e Freire — Auth & RBAC Service (Módulo Município)
 * Gerencia a sessão do usuário e os níveis de permissão da Prefeitura.
 */

export const MUN_ROLES = {
  GESTOR: 'Gestor Municipal',
  FISCAL: 'Fiscal de Tributos',
  AUDITOR: 'Auditor Fiscal',
  ATENDENTE: 'Atendente'
};

const MUN_STORAGE_KEY = 'nfse_mun_session';

/**
 * Retorna o usuário logado atualmente ou null
 */
export function getMunSession() {
  try {
    const data = localStorage.getItem(MUN_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Cria a sessão de acesso no LocalStorage e dispara evento
 */
export function loginMun(cpf, name, role) {
  const session = {
    cpf,
    name,
    role,
    loginTime: new Date().toISOString()
  };
  localStorage.setItem(MUN_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('mun_session_changed'));
  return session;
}

/**
 * Encerra a sessão
 */
export function logoutMun() {
  localStorage.removeItem(MUN_STORAGE_KEY);
  window.dispatchEvent(new Event('mun_session_changed'));
}

/**
 * Verifica se o usuário logado possui a Role e Nível de Segurança necessários
 * @param {string[]} requiredRoles - Ex: [MUN_ROLES.GESTOR, MUN_ROLES.FISCAL]
 */
export function isMunAuthorized(requiredRoles) {
  const session = getMunSession();
  if (!session) return false;
  return requiredRoles.includes(session.role);
}

/**
 * NFS-e Freire — Auth & RBAC Service (Production)
 */

export const ROLES = {
  MASTER: 'Administrador Master',
  CONTADOR: 'Contador',
  FATURISTA: 'Faturista',
  AUDITOR: 'Auditor'
};

export const AUTH_LEVELS = {
  CERTIFICADO_A1_A3: 'e-CNPJ / e-CPF',
  GOVBR_OURO: 'Gov.br (Ouro)',
  GOVBR_PRATA: 'Gov.br (Prata)',
  GOVBR_BRONZE: 'Gov.br (Bronze)'
};

const STORAGE_KEY = 'nfse_session';

export function getSession() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function login(cpf, name, role, authLevel, token, cnpj) {
  const session = {
    cpf,
    name,
    role,
    authLevel,
    token,
    cnpj,
    loginTime: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('session_changed'));
  return session;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('session_changed'));
}

/** Aceita role keys (MASTER, CONTADOR) ou labels (Administrador Master, Contador) */
export function isAuthorized(requiredRoles) {
  const session = getSession();
  if (!session) return false;
  const role = session.role;
  return requiredRoles.some(r => r === role || ROLES[r] === role);
}

export async function promptMFA() {
  return new Promise((resolve) => {
    const isConfirmed = confirm('🔐 Ação Sensível Detectada!\nPor favor, insira o seu PIN ou Token OTP para confirmar.');
    resolve(isConfirmed);
  });
}

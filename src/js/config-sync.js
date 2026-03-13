/**
 * NFS-e — Sincronização de Config (Município → Contribuinte)
 * Canal único para sinalizar quando o município salva ambiente/SEFIN/ADN.
 * O contribuinte escuta e atualiza badge + tela de configurações.
 */
export const CONFIG_SYNC_CHANNEL = 'nfse-config-sync';
export const CONFIG_SYNC_STORAGE_KEY = 'nfse_config_updated';

/** Sinaliza que o município salvou a config (chamar após save bem-sucedido) */
export function notifyConfigSaved() {
  try {
    localStorage.setItem(CONFIG_SYNC_STORAGE_KEY, Date.now().toString());
    const ch = new BroadcastChannel(CONFIG_SYNC_CHANNEL);
    ch.postMessage({ type: 'config_saved', ts: Date.now() });
    ch.close();
  } catch (_) {}
}

/** Registra listener para quando a config do município for salva (usar no portal do contribuinte) */
export function onConfigSaved(callback) {
  const handler = (e) => {
    if (e.key === CONFIG_SYNC_STORAGE_KEY) callback();
  };
  window.addEventListener('storage', handler);

  let bc = null;
  try {
    bc = new BroadcastChannel(CONFIG_SYNC_CHANNEL);
    bc.onmessage = () => callback();
  } catch (_) {}

  return () => {
    window.removeEventListener('storage', handler);
    bc?.close();
  };
}

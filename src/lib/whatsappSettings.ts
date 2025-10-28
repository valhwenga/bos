export type WhatsAppSettings = {
  phoneNumberId?: string;
  businessAccountId?: string;
  accessToken?: string; // Do NOT commit real tokens; demo only
  verifyToken?: string;
  webhookUrl?: string;
  defaultTemplate?: string;
};

const K = { settings: "wa.settings" };
const r = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const w = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export const WhatsAppSettingsStore = {
  get(): WhatsAppSettings { return r<WhatsAppSettings>(K.settings, {}); },
  set(s: WhatsAppSettings) { w(K.settings, s); try { window.dispatchEvent(new Event('wa.settings-changed')); } catch {} return s; }
};

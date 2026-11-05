/**
 * Conteúdo dos QR Codes (TASK-05): link, WhatsApp (`wa.me`), PIX estático (BR Code EMV com CRC16) e Wi-Fi. Funções puras,
 * sem rede; erro de entrada vira `PayloadError` com a mensagem que a interface mostra.
 */

export type QrKind = 'link' | 'whatsapp' | 'pix' | 'wifi';
export const QR_KINDS: [QrKind, string][] = [['link', '🔗 Link'], ['whatsapp', '💬 WhatsApp'], ['pix', '💠 PIX'], ['wifi', '📶 Wi-Fi']];

export class PayloadError extends Error {}

/** CRC16-CCITT-FALSE (polinômio 0x1021, início 0xFFFF, sem reflexão, sem XOR final), 4 dígitos hex maiúsculos. */
export function crc16ccitt(s: string): string {
  let crc = 0xffff;
  for (const b of new TextEncoder().encode(s)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** URL com esquema; sem esquema ganha `https://`. */
export function linkPayload(url: string): string {
  const u = url.trim();
  if (!u) throw new PayloadError('Informe o link');
  if (/\s/.test(u)) throw new PayloadError('O link não pode ter espaços');
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

/** `https://wa.me/<DDI+DDD+número>?text=…`; 10–11 dígitos (DDD + número) ganham o 55 do Brasil. */
export function whatsappPayload(phone: string, message = ''): string {
  let d = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (d.length < 12 || d.length > 15) throw new PayloadError('Telefone inválido: use DDD + número');
  const msg = message.trim();
  return `https://wa.me/${d}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
}

/** Campo EMV: ID (2) + tamanho (2) + valor. */
function tlv(id: string, value: string): string {
  if (value.length > 99) throw new PayloadError(`Campo ${id} longo demais`);
  return id + String(value.length).padStart(2, '0') + value;
}

/** Sem acento, maiúsculas, só letras/números/espaço e pontuação simples, cortado em `max`. */
export function pixText(s: string, max: number): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z0-9 .\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

/** Chave como o DICT a registra: e-mail e aleatória como estão; telefone `+55…`; CPF/CNPJ só com dígitos. */
export function normalizePixKey(key: string): string {
  const k = key.trim();
  if (k.includes('@')) return k.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase();
  if (k.startsWith('+')) return '+' + k.replace(/\D/g, '');
  if (/^[\d.\-/\s()]+$/.test(k)) return k.replace(/\D/g, '');
  return k;
}

export interface PixInput {
  key: string;
  name: string;
  city: string;
  amount?: number;
  txid?: string;
}

/** BR Code estático (Manual do BR Code / EMV QRCPS): campos 00, 26, 52, 53, 54?, 58, 59, 60, 62 e 63 (CRC). */
export function pixPayload(p: PixInput): string {
  const key = normalizePixKey(p.key);
  if (!key) throw new PayloadError('Informe a chave PIX');
  if (key.length > 77) throw new PayloadError('Chave PIX longa demais');
  const name = pixText(p.name, 25);
  if (!name) throw new PayloadError('Informe o nome do recebedor');
  const city = pixText(p.city, 15);
  if (!city) throw new PayloadError('Informe a cidade');
  let amount = '';
  if (p.amount !== undefined) {
    if (!Number.isFinite(p.amount) || p.amount <= 0 || p.amount >= 1e10) throw new PayloadError('Valor inválido');
    amount = tlv('54', p.amount.toFixed(2));
  }
  const txid = p.txid && /^[A-Za-z0-9]{1,25}$/.test(p.txid) ? p.txid : '***';
  const body = tlv('00', '01')
    + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key))
    + tlv('52', '0000')
    + tlv('53', '986')
    + amount
    + tlv('58', 'BR')
    + tlv('59', name)
    + tlv('60', city)
    + tlv('62', tlv('05', txid))
    + '6304';
  return body + crc16ccitt(body);
}

/** "19,90", "19.90", "1.234,56" → número; vazio → undefined; inválido → PayloadError. */
export function parseAmount(s: string): number | undefined {
  const t = s.trim().replace(/^R\$\s*/i, '');
  if (!t) return undefined;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) throw new PayloadError('Valor inválido (ex.: 19,90)');
  return Number(norm);
}

/** Campos EMV de primeiro nível em ordem, ou null se a estrutura ID/tamanho não fechar exatamente no fim. */
export function parseEmv(payload: string): { id: string; value: string }[] | null {
  const out: { id: string; value: string }[] = [];
  for (let i = 0; i < payload.length;) {
    if (i + 4 > payload.length) return null;
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(payload.slice(i + 2, i + 4)) || i + 4 + len > payload.length) return null;
    out.push({ id, value: payload.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

export function isPixPayload(s: string): boolean {
  return s.trim().startsWith('000201');
}

/** "PIX Copia e Cola": estrutura EMV válida, termina no campo 63 de 4 dígitos e o CRC confere. */
export function pixCrcOk(payload: string): boolean {
  const p = payload.trim();
  const fields = parseEmv(p);
  if (!fields || fields.length < 2 || fields[0].id !== '00' || fields[fields.length - 1].id !== '63') return false;
  if (fields[fields.length - 1].value.length !== 4) return false;
  return crc16ccitt(p.slice(0, -4)) === p.slice(-4).toUpperCase();
}

export type WifiAuth = 'WPA' | 'WEP' | 'nopass';
export const WIFI_AUTH: [WifiAuth, string][] = [['WPA', 'WPA/WPA2'], ['WEP', 'WEP'], ['nopass', 'Sem senha']];

const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');

/** `WIFI:T:<auth>;S:<rede>;P:<senha>;;` (sem senha: sem `P:`). */
export function wifiPayload(p: { ssid: string; password?: string; auth?: WifiAuth }): string {
  const ssid = p.ssid.trim();
  if (!ssid) throw new PayloadError('Informe o nome da rede (SSID)');
  const auth = p.auth ?? 'WPA';
  if (auth === 'nopass') return `WIFI:T:nopass;S:${wifiEscape(ssid)};;`;
  const pwd = p.password ?? '';
  if (!pwd) throw new PayloadError('Informe a senha da rede');
  return `WIFI:T:${auth};S:${wifiEscape(ssid)};P:${wifiEscape(pwd)};;`;
}

/** O texto a codificar a partir do modo e dos campos do formulário (os mesmos nomes de `QrConfig.fields`). */
export function buildPayload(kind: QrKind, f: Record<string, string>): string {
  const v = (k: string) => f[k] ?? '';
  switch (kind) {
    case 'link':
      return linkPayload(v('url'));
    case 'whatsapp':
      return whatsappPayload(v('phone'), v('message'));
    case 'pix':
      if (v('pixMode') === 'paste') {
        const p = v('pasted').replace(/\s+$/g, '').replace(/^\s+/g, '');
        if (!isPixPayload(p)) throw new PayloadError('Isto não parece um PIX Copia e Cola (deve começar com 000201)');
        if (!pixCrcOk(p)) throw new PayloadError('PIX Copia e Cola inválido: o código de verificação (CRC) não confere');
        return p;
      }
      return pixPayload({ key: v('key'), name: v('name'), city: v('city'), amount: parseAmount(v('amount')) });
    case 'wifi':
      return wifiPayload({ ssid: v('ssid'), password: v('password'), auth: (v('auth') || 'WPA') as WifiAuth });
  }
}

import { describe, expect, it } from 'vitest';
import {
  buildPayload, crc16ccitt, isPixPayload, linkPayload, normalizePixKey, parseAmount, parseEmv, PayloadError, pixCrcOk, pixPayload,
  whatsappPayload, wifiPayload,
} from '../src/qrPayloads';

describe('crc16ccitt', () => {
  it('valor de verificação padrão do CCITT-FALSE: "123456789" → 29B1', () => {
    expect(crc16ccitt('123456789')).toBe('29B1');
  });
  it('BR Code: mesmo valor do binascii.crc_hqx(dados, 0xFFFF) do Python (F012)', () => {
    const p = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***6304';
    expect(crc16ccitt(p)).toBe('F012');
  });
});

describe('link e WhatsApp', () => {
  it('link sem esquema ganha https://; com esquema fica como está; vazio é recusado', () => {
    expect(linkPayload(' www.lojateste.com.br ')).toBe('https://www.lojateste.com.br');
    expect(linkPayload('http://x.com/a?b=1')).toBe('http://x.com/a?b=1');
    expect(() => linkPayload('  ')).toThrow(PayloadError);
  });
  it('(11) 99999-9999 → https://wa.me/5511999999999?text=… com encodeURIComponent', () => {
    expect(whatsappPayload('(11) 99999-9999', 'Olá! Vi o anúncio')).toBe('https://wa.me/5511999999999?text=Ol%C3%A1!%20Vi%20o%20an%C3%BAncio');
    expect(whatsappPayload('+55 11 98888-7777')).toBe('https://wa.me/5511988887777');
    expect(whatsappPayload('011 3333-4444')).toBe('https://wa.me/551133334444');
    expect(() => whatsappPayload('1234')).toThrow(PayloadError);
  });
});

describe('PIX estático (BR Code)', () => {
  const p = pixPayload({ key: '+55 (11) 98888-7777', name: 'Loja Teste', city: 'São Paulo', amount: 19.9 });
  it('campos em ordem, com os tamanhos NN corretos, e CRC que confere', () => {
    const f = parseEmv(p)!;
    expect(f.map((x) => x.id)).toEqual(['00', '26', '52', '53', '54', '58', '59', '60', '62', '63']);
    expect(f.find((x) => x.id === '00')!.value).toBe('01');
    expect(parseEmv(f.find((x) => x.id === '26')!.value)).toEqual([{ id: '00', value: 'br.gov.bcb.pix' }, { id: '01', value: '+5511988887777' }]);
    expect(p).toContain('540519.90');
    expect(p).toContain('5802BR');
    expect(p).toContain('5910LOJA TESTE');
    expect(p).toContain('6009SAO PAULO');
    expect(p).toContain('62070503***');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(pixCrcOk(p)).toBe(true);
    expect(isPixPayload(p)).toBe(true);
  });
  it('sem valor não tem o campo 54; nome ≤ 25 e cidade ≤ 15 sem acento', () => {
    const q = pixPayload({ key: 'contato@loja.com', name: 'Comércio de Ãçúcar e Doces Finos Ltda', city: 'São José dos Campos' });
    const f = parseEmv(q)!;
    expect(f.some((x) => x.id === '54')).toBe(false);
    expect(f.find((x) => x.id === '59')!.value).toBe('COMERCIO DE ACUCAR E DOCE');
    expect(f.find((x) => x.id === '60')!.value).toBe('SAO JOSE DOS CA');
    expect(pixCrcOk(q)).toBe(true);
  });
  it('chaves: CPF/CNPJ só dígitos, e-mail minúsculo, telefone +…', () => {
    expect(normalizePixKey('123.456.789-09')).toBe('12345678909');
    expect(normalizePixKey('12.345.678/0001-90')).toBe('12345678000190');
    expect(normalizePixKey(' Contato@Loja.com ')).toBe('contato@loja.com');
    expect(normalizePixKey('+55 11 98888-7777')).toBe('+5511988887777');
  });
  it('sem chave, nome ou cidade → PayloadError', () => {
    expect(() => pixPayload({ key: '', name: 'a', city: 'b' })).toThrow(/chave/);
    expect(() => pixPayload({ key: 'x@y.z', name: ' ', city: 'b' })).toThrow(/nome/);
    expect(() => pixPayload({ key: 'x@y.z', name: 'a', city: '' })).toThrow(/cidade/);
  });
  it('Copia e Cola: válido é aceito como está; CRC adulterado ou estrutura quebrada é recusado', () => {
    expect(buildPayload('pix', { pixMode: 'paste', pasted: `  ${p}\n` })).toBe(p);
    const bad = p.slice(0, -1) + (p.endsWith('0') ? '1' : '0');
    expect(pixCrcOk(bad)).toBe(false);
    expect(() => buildPayload('pix', { pixMode: 'paste', pasted: bad })).toThrow(/CRC/);
    expect(() => buildPayload('pix', { pixMode: 'paste', pasted: 'https://x' })).toThrow(/000201/);
    expect(pixCrcOk('000201' + '6304ABCD')).toBe(false);
  });
  it('valor: "19,90", "1.234,56", "R$ 5" e vazio', () => {
    expect(parseAmount('19,90')).toBe(19.9);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('R$ 5')).toBe(5);
    expect(parseAmount('')).toBeUndefined();
    expect(() => parseAmount('abc')).toThrow(PayloadError);
  });
});

describe('Wi-Fi', () => {
  it('escapa \\ ; , : " e monta WIFI:T:…;S:…;P:…;;', () => {
    expect(wifiPayload({ ssid: 'MinhaLoja', password: 'senha123', auth: 'WPA' })).toBe('WIFI:T:WPA;S:MinhaLoja;P:senha123;;');
    expect(wifiPayload({ ssid: 'Loja;1', password: 'a;b,c:d"e\\f' })).toBe('WIFI:T:WPA;S:Loja\\;1;P:a\\;b\\,c\\:d\\"e\\\\f;;');
  });
  it('sem senha não tem P:; rede vazia é recusada', () => {
    expect(wifiPayload({ ssid: 'Clientes', auth: 'nopass' })).toBe('WIFI:T:nopass;S:Clientes;;');
    expect(() => wifiPayload({ ssid: ' ' })).toThrow(PayloadError);
  });
});

describe('buildPayload despacha pelo modo', () => {
  it('link, whatsapp, pix por chave e wifi', () => {
    expect(buildPayload('link', { url: 'loja.com' })).toBe('https://loja.com');
    expect(buildPayload('whatsapp', { phone: '11988887777', message: '' })).toBe('https://wa.me/5511988887777');
    expect(pixCrcOk(buildPayload('pix', { pixMode: 'key', key: 'x@y.com', name: 'N', city: 'C', amount: '' }))).toBe(true);
    expect(buildPayload('wifi', { ssid: 'S', auth: 'nopass' })).toBe('WIFI:T:nopass;S:S;;');
  });
});

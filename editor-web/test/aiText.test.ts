import { describe, expect, it } from 'vitest';
import { AiTextError, MAX_INPUT, parseCopy, parseVariants, REWRITE_STYLES, rewritePayload } from '../src/aiText';

describe('aiText', () => {
  it('builds the rewrite payload: trims, one variant for "fix", rejects empty or long text', () => {
    expect(rewritePayload('  Promoção  ', 'shorter')).toEqual({ text: 'Promoção', style: 'shorter', count: 3 });
    expect(rewritePayload('promocao', 'fix').count).toBe(1);
    expect(() => rewritePayload('   ', 'rewrite')).toThrow(AiTextError);
    expect(() => rewritePayload('a'.repeat(MAX_INPUT + 1), 'rewrite')).toThrow(AiTextError);
    expect(REWRITE_STYLES.map(([id]) => id)).toEqual(['rewrite', 'shorter', 'persuasive', 'formal', 'fun', 'fix']);
  });

  it('keeps distinct non-empty variants different from the original', () => {
    const r = { variants: ['Oi', ' Olá ', 'Olá', '', 3, 'Bem-vindo'] };
    expect(parseVariants(r, 'Oi', 'rewrite')).toEqual(['Olá', 'Bem-vindo']);
    expect(parseVariants({ variants: ['Oi'] }, 'Oi', 'fix')).toEqual(['Oi']);
    expect(() => parseVariants({}, 'Oi', 'rewrite')).toThrow(AiTextError);
  });

  it('reads the poster copy and requires every field', () => {
    expect(parseCopy({ title: ' Pão ', subtitle: 'Quentinho', cta: 'Peça já', servedBy: 'Gemma' }))
      .toEqual({ title: 'Pão', subtitle: 'Quentinho', cta: 'Peça já', servedBy: 'Gemma' });
    expect(() => parseCopy({ title: 'Pão', subtitle: 'x' })).toThrow(/cta/);
  });
});

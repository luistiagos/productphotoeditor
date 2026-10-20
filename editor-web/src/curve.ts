/**
 * Arco do texto curvo (ARQUITETURA §28 D). `amount` em -100..100 (0 = reto; 100 = meio círculo, para cima; negativo,
 * para baixo). O comprimento do arco é a largura do **texto**, não a da caixa do Textbox: o Fabric centraliza o texto no
 * caminho, e um arco mais comprido deixava as letras só no topo, acima do centro do objeto.
 */
export interface CurveArc {
  /** Caminho SVG do arco, de ponta a ponta. */
  d: string;
  radius: number;
  /** Ângulo do arco em radianos. */
  sweep: number;
  /** Flecha: distância entre a corda e o ponto mais alto (ou mais baixo) do arco. */
  sagitta: number;
}

export function curveArc(textWidth: number, amount: number): CurveArc | undefined {
  if (Math.abs(amount) < 1) return undefined;
  const w = Math.max(textWidth, 10);
  const radius = (w * 100) / (Math.abs(amount) * Math.PI);
  const sweep = w / radius;
  const half = Math.sin(sweep / 2) * radius;
  const sagitta = radius * (1 - Math.cos(sweep / 2));
  // para cima: pontas em y = flecha, topo em 0; para baixo: pontas em -flecha, fundo em 0
  const y = amount > 0 ? sagitta : -sagitta;
  const d = `M ${-half} ${y} A ${radius} ${radius} 0 0 ${amount > 0 ? 1 : 0} ${half} ${y}`;
  return { d, radius, sweep, sagitta };
}

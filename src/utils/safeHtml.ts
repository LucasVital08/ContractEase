/**
 * Renderização segura do "mini markdown" usado nas respostas da IA.
 *
 * [HIGH] Os componentes injetavam o texto do modelo direto em
 * `dangerouslySetInnerHTML`, aplicando só `**negrito**` e `\n → <br>`:
 *
 *   __html: message.text.replace(/\*\*(.+?)\*\*!/g, '<strong>$1</strong>')
 *                       .replace(/\n/g, '<br>')
 *
 * Qualquer `<img src=x onerror=...>` presente na saída era executado. E essa
 * saída não é confiável: o prompt inclui o CONTEÚDO DO CONTRATO, que pode ter
 * sido escrito por uma contraparte. Ou seja, um signatário conseguia embutir
 * instruções no texto do contrato (prompt injection) para que o modelo
 * devolvesse HTML ativo, executado no navegador de quem abrisse o documento.
 *
 * Como a chave secreta Stellar da carteira embarcada vive em `localStorage`,
 * um XSS aqui significa roubo de carteira — não só defacement.
 *
 * A ordem correta é: escapar TUDO primeiro, e só depois reintroduzir as poucas
 * tags que queremos permitir.
 */

/** Escapa os cinco caracteres que dão significado a HTML. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converte o subconjunto de markdown que a IA usa (`**negrito**` e quebras de
 * linha) em HTML seguro.
 *
 * @param text      Texto não confiável (saída do modelo, conteúdo de contrato…).
 * @param strongCls Classes CSS aplicadas ao `<strong>` gerado.
 */
export function renderInlineMarkdown(text: string, strongCls = 'text-white font-bold'): string {
  // 1. Escapa primeiro: a partir daqui não existe mais tag ativa no conteúdo.
  const escaped = escapeHtml(text ?? '');

  // 2. Reintroduz apenas <strong> e <br>, ambos sem atributos controláveis.
  //    A classe vem do nosso código, nunca do texto.
  return escaped
    .replace(/\*\*(.+?)\*\*/g, `<strong class="${strongCls}">$1</strong>`)
    .replace(/\n/g, '<br>');
}

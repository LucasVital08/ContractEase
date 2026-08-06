# Conteúdo pendente — VittaClin Estética

Tudo que ficou marcado como placeholder no site, organizado para levar à Denise
numa conversa só. Cada item tem **onde está**, **o que perguntar** e **o que fazer
com a resposta**.

Os itens marcados 🔴 **bloqueiam a publicação**. Os 🟡 podem entrar depois.

---

## 🔴 1. Bloqueiam a publicação

### 1.1 Validar o logo contra o arquivo original
- **Onde:** `assets/logo-simbolo.svg`, `assets/logo-vittaclin.svg`, `assets/favicon.svg`
- **Situação:** o logo foi **redesenhado em SVG vetorial a partir de uma foto do
  perfil do Instagram**, medindo a arte pixel a pixel. A geometria confere:
  losango de meia-diagonal 142 com linha branca inset a 73,4% do raio, e chevron
  com braços a 45° e pontas cortadas perpendicularmente ao eixo.
- **Perguntar:** *"Você tem o arquivo original do logo? Um `.ai`, `.eps`, `.pdf`
  ou `.svg` do designer que fez?"*
- **O que fazer:** se ela tiver o original, comparar e ajustar. Dois pontos a checar:
  1. **O magenta.** No print do Instagram a cor medida é `#E3497C`. No site foi
     usado `#D62B6B`, um tom mais fechado — o `#E3497C` só atinge **3,8:1** de
     contraste sobre branco e **reprova no critério AA** de acessibilidade para
     texto. Se o magenta oficial da marca for outro, avisar que valores muito
     claros vão reprovar em acessibilidade e precisam de um tom de apoio mais escuro
     para textos pequenos.
  2. **A fonte do "VITTACLIN".** No original é uma sans light e mais estreita que a
     Inter Light usada aqui. Se ela tiver o original vetorizado, dá para substituir
     o texto pelo desenho exato das letras.

### 1.2 Horário de funcionamento
- **Onde:** FAQ ("Posso ir depois do trabalho?"), seção Localização, rodapé,
  e no JSON-LD do `index.html` (procure por `openingHoursSpecification`)
- **Situação:** está como "Segunda a sexta, 9h às 18h" — um placeholder do briefing,
  não uma informação confirmada.
- **Perguntar:** *"Qual o horário real? Atende sábado? Tem horário estendido para
  quem sai do trabalho às 18h?"*
- **Importante:** o horário aparece em **4 lugares**, incluindo o código que o Google
  lê para mostrar "aberto agora" na busca. Trocar em todos.

### 1.3 CNPJ
- **Onde:** rodapé do `index.html`, `politica-de-privacidade.html`, `termos-de-uso.html`
- **Perguntar:** *"Qual o CNPJ e a razão social exata?"*
- **Por que importa:** as páginas legais precisam identificar quem é o responsável
  pelos dados. Sem isso, a política de privacidade não cumpre a LGPD.

### 1.4 Crédito de quem desenvolveu
- **Onde:** rodapé do `index.html`, linha "Site desenvolvido por"
- **O que fazer:** colocar seu nome ou o da agência, com link se quiser.

### 1.5 Coordenadas exatas no mapa
- **Onde:** `index.html`, no JSON-LD, campo `geo`
- **Situação:** estão `-8.0378, -34.9445` — coordenadas **aproximadas do bairro da
  Iputinga**, não do endereço exato. Foram colocadas para o código ficar válido.
- **O que fazer:** abrir o Google Maps, achar o ponto exato da clínica, clicar com o
  botão direito e copiar as coordenadas que aparecem. Substituir as duas.

---

## 🟡 2. Podem entrar depois, mas fazem falta

### 2.1 Depoimentos reais
- **Onde:** seção "O que as clientes dizem" — 3 cartões
- **Situação:** três placeholders escritos `[DEPOIMENTO 1 — SUBSTITUIR]`.
  **Nada foi inventado.**
- **Perguntar:** *"Podemos usar 3 avaliações do Google no site? Precisa avisar as
  clientes?"*
- **Recomendação:** copiar avaliações reais do perfil do Google, com o primeiro nome
  e a inicial do sobrenome. Pedir autorização por mensagem antes — é rápido e evita
  dor de cabeça.

### 2.2 Link direto do Google Meu Negócio
- **Onde:** `index.html`, botão "Ver as 44 avaliações no Google"
- **Situação:** hoje é um link de **busca** pelo nome e endereço. Funciona, mas cai
  numa página de resultados em vez do perfil.
- **O que fazer:** entrar no perfil do Google Meu Negócio → "Compartilhar" → copiar
  o link curto e colar no lugar.

### 2.3 Foto profissional para o topo
- **Onde:** `assets/denise-hero.jpg` e `assets/denise-hero.webp`
- **Situação:** está usando **um recorte de um print do Instagram** (post de ago/2024).
  A composição é ótima — ela sorrindo, fundo verde — mas a resolução é de print de
  celular e a foto é pessoal, não da clínica.
- **Medida exata:** **600 × 730 px** (proporção ~5:6, vertical)
- **Pedir:** foto vertical da Denise, de preferência **na clínica**, com jaleco ou
  roupa de trabalho, boa luz e espaço sobrando em volta. Enquadramento do peito para
  cima.

### 2.4 Foto da seção "Sobre"
- **Onde:** `assets/placeholder-sobre.svg` — hoje é um quadro pontilhado escrito
  "FOTO PENDENTE"
- **Medida exata:** **800 × 1000 px** (proporção 4:5, vertical)
- **Pedir:** a Denise **atendendo**, em ação. No feed dela já existem fotos assim
  (as de jaleco branco na maca). Uma delas em alta resolução resolve.
- **Como trocar:** instruções no `README.md`, seção 5.

### 2.5 Duração do design de sobrancelha com henna
- **Onde:** card "Design de sobrancelha + henna", terceiro benefício
- **Perguntar:** *"A henna dura em média quantos dias?"*
- **Cuidado com o texto:** manter a ressalva de que varia conforme o tipo de pele.
  Não trocar por um número seco.

### 2.6 Ponto de referência do endereço
- **Onde:** seção Localização
- **Perguntar:** *"Tem algum ponto de referência? 'Em frente ao...', 'ao lado do...'?
  Tem estacionamento? Qual ônibus passa perto?"*
- **Por que importa:** a Rua Bom Pastor é longa. Público que vem de ônibus ou de
  aplicativo acha o lugar mais rápido com uma referência.

### 2.7 Formação e tempo de atuação
- **Onde:** seção "Prazer, eu sou a Denise", primeiro parágrafo
- **Perguntar:** *"Qual sua formação exata e há quantos anos você atua?"*
- **⚠️ Cuidado:** escrever **exatamente** o que ela informar. Não arredondar anos para
  cima, não transformar curso em especialização, não usar "doutora" nem termo médico.
  Ela é esteticista — o site inteiro foi escrito para deixar isso claro, e essa
  honestidade é um diferencial dela.

### 2.8 Atendimento a homens
- **Onde:** FAQ, "Atende homens?"
- **Situação:** a resposta está escrita como "Atendo", com um `[CONFIRMAR COM A CLIENTE]`
  logo depois, porque **isso não estava no briefing** — foi uma suposição razoável,
  não uma informação dela.
- **Perguntar:** *"Você atende homens? Em quais tratamentos?"*
- **O que fazer:** se ela não atender, **reescrever a resposta inteira**, não só apagar
  o marcador.

### 2.9 Skinbooster — confirmar a técnica
- **Onde:** card "Skinbooster"
- **Situação:** o texto fala de hidratação profunda **sem descrever como é aplicado**.
  Isso foi proposital: "skinbooster" costuma se referir a microinjeções de ácido
  hialurônico, procedimento **fora do escopo de uma esteticista**.
- **Perguntar:** *"O skinbooster que você faz é injetável ou é um protocolo tópico
  ou com aparelho?"*
- **O que fazer:** se for injetável, **conversar sobre retirar o item do site** ou
  ajustar a descrição — é uma questão de habilitação profissional, não de redação.

### 2.10 Datas das páginas legais
- **Onde:** `politica-de-privacidade.html` e `termos-de-uso.html`, "Última atualização"
- **O que fazer:** colocar a data em que o site for publicado.

---

## 📐 3. Especificação das imagens

Para pedir na medida certa. Todas devem ficar **abaixo de 200 KB**.

| Imagem | Arquivo | Medida | Proporção | Formato | Observação |
|---|---|---|---|---|---|
| Foto do topo | `denise-hero.jpg` + `.webp` | **600 × 730 px** | 5:6 vertical | WebP + JPG | Retrato, peito para cima, luz natural |
| Foto do "Sobre" | `denise-sobre.jpg` + `.webp` | **800 × 1000 px** | 4:5 vertical | WebP + JPG | Denise atendendo, em ação |
| Imagem social | `og-vittaclin.jpg` | **1200 × 630 px** | 1,91:1 horizontal | JPG | Aparece ao compartilhar no WhatsApp |
| Favicon | `favicon.svg` + PNGs | 32, 180 e 512 px | quadrado | SVG + PNG | ✅ Já gerado a partir do losango |

**Enviar sempre o arquivo original, sem recortar.** É melhor recortar aqui do que
receber uma foto já reduzida.

**Como preparar:** usar o [Squoosh](https://squoosh.app) — gratuito, no navegador.
Exportar em WebP qualidade ~80 e também em JPG.

---

## ✅ 4. O que já está confirmado e não precisa perguntar

Levantado do briefing e conferido nos prints do Instagram:

- Endereço, CEP e WhatsApp
- Nota 5,0 com 44 avaliações no Google
- Formas de pagamento: Pix, débito, crédito e transferência
- Os 9 serviços e seus benefícios
- Benefícios do microagulhamento e da Enzima Botox (conferidos nos posts dela)
- A frase da limpeza de pele, ao pé da letra:
  *"Limpeza de pele não é milagre. É tratamento. E como todo tratamento, exige
  disciplina, constância e comprometimento."*
- A frase sobre ser escolhida pela mesma cliente (conferida no post dela)
- Participação no 3º CONFIDEFE, Recife, 18 e 19 de outubro de 2025
- Instagram `@vittaclinestetica`

---

## ⚖️ 5. Regras de conteúdo que o site segue

Se alguém for escrever texto novo, **manter estas regras**. Elas não são preciosismo
— são o que protege a Denise:

1. **Nunca prometer resultado garantido, cura ou efeito permanente.**
2. **Nunca usar linguagem médica.** Nada de "procedimento médico", "tratamento de
   doença", "paciente" ou "doutora". Ela é esteticista.
3. **Sempre que citar resultado, deixar claro que varia de pessoa para pessoa e
   depende de avaliação.** Existe um aviso fixo ao final da seção de serviços, outro
   no bloco do protocolo e outro no rodapé. **Não apagar nenhum dos três.**
4. **Não inventar depoimento, número, prêmio ou certificação.**
5. **Valores não são publicados.** Todos os caminhos levam a "consulte no WhatsApp".

---

## 🔎 6. Como achar os pendentes dentro do código

No site publicado, todo pendente aparece com **fundo amarelo**.

Nos arquivos, procure (Ctrl+F) por:

- `CONFIRMAR` — informação faltando
- `SUBSTITUIR` — depoimentos
- `marcador-pendente` — todas as marcações amarelas de uma vez

**Quando tudo estiver preenchido**, faça uma última busca por `marcador-pendente`.
Se não aparecer nenhum resultado nos arquivos `.html`, o site está limpo e pronto.

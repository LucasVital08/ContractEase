# Site da VittaClin Estética

Este é o site completo da clínica. São só arquivos de texto e imagens — não precisa
instalar nada, não precisa de programa especial, não tem banco de dados.

Este documento é escrito para quem **não é programador**. Se em algum momento você
travar, é só chamar quem cuidou do site.

---

## 1. Como colocar o site no ar (Netlify)

O Netlify é um serviço gratuito de hospedagem. Publicar leva uns 3 minutos.

1. Entre em **[app.netlify.com](https://app.netlify.com)** e crie uma conta
   (dá para entrar com e-mail ou com conta do Google).
2. Na tela inicial, procure a área escrita **"Deploy manually"** ou
   **"Drag and drop your site output folder here"**.
3. Abra o seu computador na pasta onde estão estes arquivos.
4. **Arraste a pasta inteira `vittaclin-estetica` para dentro daquela área do Netlify.**
5. Espere alguns segundos. O Netlify vai mostrar um endereço parecido com
   `random-nome-123.netlify.app`. **O site já está no ar.**

### Trocar o endereço para algo bonito

Ainda no Netlify: **Site configuration → Change site name**. Troque para algo como
`vittaclin-estetica`. O endereço vira `vittaclin-estetica.netlify.app`.

### Usar um domínio próprio (vittaclinestetica.com.br)

1. Compre o domínio (no [registro.br](https://registro.br), por exemplo).
2. No Netlify: **Domain management → Add a domain** e digite o domínio comprado.
3. O Netlify mostra dois ou mais endereços de "servidores DNS"
   (algo como `dns1.p01.nsone.net`).
4. Entre no registro.br, procure a área de **servidores DNS** e cole os endereços
   que o Netlify mostrou.
5. Espere. Pode levar de 30 minutos a algumas horas. O certificado de segurança
   (o cadeado 🔒) é criado automaticamente pelo Netlify, sem custo.

> **Importante depois de comprar o domínio:** procure no arquivo `index.html`
> por `vittaclinestetica.com.br` e troque pelo endereço real, se for outro.
> Ele aparece nas linhas de `canonical`, `og:url` e nos arquivos
> `sitemap.xml` e `robots.txt`.

### Publicar uma nova versão depois de editar

Repita o passo 4: arraste a pasta de novo para o Netlify, na aba **Deploys**.
A versão nova substitui a antiga. Se algo der errado, o Netlify guarda todas as
versões anteriores e dá para voltar com um clique.

---

## 2. O que é cada arquivo

| Arquivo | Para que serve |
|---|---|
| `index.html` | **A página principal.** É aqui que fica quase todo o texto do site. |
| `styles.css` | As cores, tamanhos e o visual. Só mexa se souber o que está fazendo. |
| `script.js` | O menu do celular, o botão flutuante e as animações. |
| `politica-de-privacidade.html` | Página da política de privacidade. |
| `termos-de-uso.html` | Página dos termos de uso. |
| `404.html` | A página que aparece quando alguém digita um endereço errado. |
| `assets/` | Todas as imagens e o logo. |
| `CONTEUDO-PENDENTE.md` | **Leia este.** Lista tudo que ainda falta confirmar com a Denise. |
| `robots.txt`, `sitemap.xml`, `netlify.toml` | Arquivos técnicos. Pode ignorar. |

---

## 3. Como trocar textos

Todo o texto do site está no arquivo `index.html`.

1. Abra `index.html` com o **Bloco de Notas** (Windows) ou o **TextEdit** (Mac).
   Se puder, use o [VS Code](https://code.visualstudio.com) — é gratuito e mostra
   as cores, o que ajuda muito a não se perder.
2. Use **Ctrl+F** (ou **Cmd+F** no Mac) para procurar o texto que quer trocar.
3. Troque **só o texto**, nunca as marcações entre `<` e `>`.

### Exemplo prático

Você vê isto no arquivo:

```html
<h3 class="cartao__titulo">Limpeza de pele</h3>
```

Para mudar o nome do tratamento, troque **apenas** `Limpeza de pele`:

```html
<h3 class="cartao__titulo">Limpeza de pele profunda</h3>
```

As partes `<h3 class="cartao__titulo">` e `</h3>` precisam continuar exatamente iguais.

### Os destaques amarelos

Alguns trechos aparecem no site com **fundo amarelo**, assim: `[CONFIRMAR]`.
São lembretes de informação que ainda falta. No arquivo eles estão assim:

```html
<span class="marcador-pendente">[CONFIRMAR]</span>
```

Quando tiver a informação real, apague o `<span ...>` e o `</span>` junto com o
texto entre colchetes, e escreva a informação certa no lugar. Exemplo:

```html
<!-- antes -->
<p>Segunda a sexta, 9h às 18h <span class="marcador-pendente">[CONFIRMAR]</span></p>

<!-- depois -->
<p>Segunda a sexta, 8h às 19h</p>
```

A lista completa desses pontos está em `CONTEUDO-PENDENTE.md`.

---

## 4. Como trocar o número do WhatsApp

O número aparece em **vários lugares** do site (cada botão tem o seu link, com uma
mensagem diferente já escrita).

1. Abra `index.html`.
2. Use **Ctrl+H** (Substituir) do seu editor.
3. Procure por: `5581988423424`
4. Substitua por: o número novo, no mesmo formato —
   **55** (Brasil) + **81** (DDD) + o número, tudo junto e sem espaço, traço ou parêntese.
5. Clique em "Substituir tudo".
6. Repita nos arquivos `politica-de-privacidade.html`, `termos-de-uso.html` e `404.html`.

Depois procure também por `(81) 9 8842-3424` — é o número que **aparece escrito**
no rodapé e nas páginas legais. Esse você troca no formato bonito mesmo.

### Mudar a mensagem que já vem escrita

Cada link tem uma mensagem depois de `?text=`. Ela precisa estar "codificada":
espaço vira `%20`, vírgula vira `%2C`, `ç` vira `%C3%A7`, `ã` vira `%C3%A3`.

O jeito mais fácil e sem erro:

1. Entre em **[wa.link](https://wa.link)** ou em qualquer gerador de link de WhatsApp.
2. Digite o número e a mensagem que você quer.
3. Copie o link pronto que ele gerar.
4. Cole no lugar do link antigo, dentro das aspas do `href="..."`.

---

## 5. Como trocar as fotos

As fotos ficam na pasta `assets/`.

**A regra de ouro:** salve a foto nova com **exatamente o mesmo nome** do arquivo
antigo e nas **mesmas medidas**. Aí não precisa mexer em mais nada.

| Arquivo | Onde aparece | Medida exata |
|---|---|---|
| `denise-hero.jpg` e `denise-hero.webp` | Foto grande do topo | **600 × 730 px** |
| `placeholder-sobre.svg` | Seção "Prazer, eu sou a Denise" | **800 × 1000 px** |
| `og-vittaclin.jpg` | Miniatura ao compartilhar no WhatsApp/Instagram | **1200 × 630 px** |

### Passo a passo

1. Recorte a foto na medida certa. Use o [Squoosh](https://squoosh.app) — é gratuito,
   funciona no navegador e não instala nada.
2. No Squoosh, escolha o formato **WebP** com qualidade em torno de 80, e salve.
3. Salve **também** uma versão em **JPG**, com o mesmo nome.
   (O WebP é mais leve; o JPG é a garantia para celulares antigos.)
4. Deixe cada arquivo **abaixo de 200 KB**.
5. Coloque os dois arquivos na pasta `assets/`, por cima dos antigos.

### Trocar o texto alternativo da foto

Toda imagem tem uma descrição para quem usa leitor de tela e para o Google.
Procure em `index.html` por `alt=` e atualize a descrição junto com a foto:

```html
alt="Denise de Paula, esteticista responsável pela VittaClin Estética, sorrindo"
```

### O quadro pontilhado da seção "Sobre"

O arquivo `placeholder-sobre.svg` é só um espaço reservado — aquele quadro branco
pontilhado escrito "FOTO PENDENTE". Quando tiver a foto real:

1. Salve a foto como `denise-sobre.jpg` e `denise-sobre.webp`, em **800 × 1000 px**.
2. Em `index.html`, procure por `placeholder-sobre.svg`.
3. Troque aquele bloco inteiro por:

```html
<picture>
  <source srcset="assets/denise-sobre.webp" type="image/webp">
  <img src="assets/denise-sobre.jpg" width="800" height="1000" loading="lazy" decoding="async"
       alt="Denise de Paula atendendo uma cliente na VittaClin Estética">
</picture>
```

---

## 6. Como colocar o Google Analytics ou o Pixel da Meta

Em todos os arquivos `.html` existe uma linha assim, perto do começo:

```html
<!-- GOOGLE ANALYTICS / META PIXEL AQUI -->
```

Cole o código que o Google ou a Meta te derem **logo abaixo dessa linha**, em cada
arquivo `.html`. Nada mais precisa ser mexido.

> Se você instalar qualquer ferramenta de rastreamento, **atualize a
> `politica-de-privacidade.html`**: hoje ela declara que o site não usa cookies
> próprios nem rastreamento. Isso deixa de ser verdade quando você instala o Pixel.

---

## 7. Ver o site no seu computador antes de publicar

Dê **dois cliques** no arquivo `index.html`. Ele abre no seu navegador.

Funciona quase tudo assim. Só o mapa do Google pode não carregar dessa forma —
no ar, no Netlify, ele funciona normalmente.

---

## 8. Detalhes técnicos (para quem for mexer de verdade)

- HTML, CSS e JavaScript puros. Sem framework, sem etapa de build, sem `npm`.
- Todas as cores, espaçamentos, raios e fontes são variáveis CSS no `:root`
  do `styles.css`. Mudar a paleta inteira é mudar seis linhas.
- Fontes: **Fraunces** (títulos) e **Inter** (texto), do Google Fonts, com
  `display=swap` e apenas os pesos usados. `opsz` fixado em 96 para reduzir o
  arquivo de 65 KB para 34 KB.
- O logo é SVG vetorial, redesenhado a partir da arte original: losango de
  meia-diagonal 142 com linha branca inset a 73,4% do raio, e chevron de braços
  a 45° com as pontas cortadas perpendicularmente ao eixo.
- O elemento visual assinatura é **a faceta**: um canto cortado a 45° (a aresta do
  losango) aplicado em fotos e cards via `clip-path`. Como `clip-path` também recorta
  `box-shadow`, os blocos facetados usam `box-shadow: inset` como borda-fio, e as
  fotos usam um eco de menta deslocado atrás em vez de sombra.
- O mapa do Google só é carregado quando a visitante clica em "Ver no mapa".
- Acessibilidade: HTML semântico, contraste mínimo AA, foco visível, `aria-expanded`
  no menu e no acordeão, e `prefers-reduced-motion` respeitado.
- O site funciona sem JavaScript: o acordeão usa `<details>` nativo e todos os
  links de WhatsApp são `<a href>` comuns.

---

## 9. Checklist antes de mostrar para a Denise

- [ ] Abrir `CONTEUDO-PENDENTE.md` e resolver os itens com ela
- [ ] Conferir o logo do site com o arquivo original da marca
- [ ] Substituir os 3 depoimentos pelas avaliações reais do Google
- [ ] Colocar o link direto do perfil do Google Meu Negócio
- [ ] Trocar a foto do topo por uma foto profissional
- [ ] Colocar a foto da seção "Sobre"
- [ ] Confirmar o horário de funcionamento
- [ ] Preencher o CNPJ no rodapé e nas páginas legais
- [ ] Preencher o crédito "Site desenvolvido por"
- [ ] Testar todos os botões de WhatsApp **no celular**

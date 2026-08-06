/* =========================================================================
   VittaClin Estética — comportamentos da página
   Sem dependências. Tudo é progressivo: se este arquivo não carregar,
   o site continua legível e todos os links do WhatsApp continuam funcionando.
   ========================================================================= */
(function () {
  'use strict';

  var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------------
     1. Menu em telas pequenas
     --------------------------------------------------------------------- */
  var botaoMenu = document.getElementById('hamburguer');
  var navegacao = document.getElementById('navegacao');

  if (botaoMenu && navegacao) {
    var alternarMenu = function (abrir) {
      botaoMenu.setAttribute('aria-expanded', String(abrir));
      botaoMenu.setAttribute('aria-label', abrir ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
      navegacao.classList.toggle('navegacao--aberta', abrir);
    };

    botaoMenu.addEventListener('click', function () {
      alternarMenu(botaoMenu.getAttribute('aria-expanded') !== 'true');
    });

    // Fecha ao escolher um destino
    navegacao.addEventListener('click', function (evento) {
      if (evento.target.closest('a')) alternarMenu(false);
    });

    // Fecha com Esc e devolve o foco ao botão
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && botaoMenu.getAttribute('aria-expanded') === 'true') {
        alternarMenu(false);
        botaoMenu.focus();
      }
    });

    // Fecha ao clicar fora do cabeçalho
    document.addEventListener('click', function (evento) {
      if (botaoMenu.getAttribute('aria-expanded') !== 'true') return;
      if (!evento.target.closest('.cabecalho')) alternarMenu(false);
    });

    // Ao voltar para o desktop, o painel não deve ficar preso aberto
    var telaLarga = window.matchMedia('(min-width: 900px)');
    var aoMudarLargura = function (consulta) { if (consulta.matches) alternarMenu(false); };
    if (telaLarga.addEventListener) telaLarga.addEventListener('change', aoMudarLargura);
    else if (telaLarga.addListener) telaLarga.addListener(aoMudarLargura);
  }

  /* ---------------------------------------------------------------------
     2. Cabeçalho ganha borda ao rolar + botão flutuante depois de 400px
     --------------------------------------------------------------------- */
  var cabecalho = document.getElementById('cabecalho');
  var flutuante = document.getElementById('flutuante');
  var LIMITE_FLUTUANTE = 400;
  var aguardandoQuadro = false;

  function aoRolar() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (cabecalho) cabecalho.classList.toggle('cabecalho--rolado', y > 8);
    if (flutuante) flutuante.classList.toggle('flutuante--visivel', y > LIMITE_FLUTUANTE);
    aguardandoQuadro = false;
  }

  window.addEventListener('scroll', function () {
    if (aguardandoQuadro) return;
    aguardandoQuadro = true;
    window.requestAnimationFrame(aoRolar);
  }, { passive: true });

  aoRolar();

  /* ---------------------------------------------------------------------
     3. Revelações no scroll e desenho do traço manuscrito
     --------------------------------------------------------------------- */
  var paraRevelar = document.querySelectorAll('.revelar');
  var tracos = document.querySelectorAll('.traco');

  function mostrarTudo() {
    for (var i = 0; i < paraRevelar.length; i++) paraRevelar[i].classList.add('visivel');
    for (var j = 0; j < tracos.length; j++) tracos[j].classList.add('tracado');
  }

  if (!('IntersectionObserver' in window) || semMovimento.matches) {
    mostrarTudo();
  } else {
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add(entrada.target.classList.contains('traco') ? 'tracado' : 'visivel');
        observador.unobserve(entrada.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    for (var k = 0; k < paraRevelar.length; k++) observador.observe(paraRevelar[k]);

    // O traço do hero já nasce na tela: desenha assim que a fonte assenta
    for (var m = 0; m < tracos.length; m++) {
      var traco = tracos[m];
      if (traco.getBoundingClientRect().top < window.innerHeight) {
        (function (elemento) {
          window.setTimeout(function () { elemento.classList.add('tracado'); }, 420);
        })(traco);
      } else {
        observador.observe(traco);
      }
    }
  }

  /* ---------------------------------------------------------------------
     4. Acordeão do FAQ
     O <details> nativo já funciona sem JS. Aqui só espelhamos o estado em
     aria-expanded e garantimos que um item aberto feche os outros.
     --------------------------------------------------------------------- */
  var itens = document.querySelectorAll('.acordeao__item');

  Array.prototype.forEach.call(itens, function (item) {
    var titulo = item.querySelector('.acordeao__titulo');
    if (!titulo) return;

    item.addEventListener('toggle', function () {
      titulo.setAttribute('aria-expanded', String(item.open));

      if (!item.open) return;
      Array.prototype.forEach.call(itens, function (outro) {
        if (outro !== item && outro.open) outro.open = false;
      });
    });
  });

  /* ---------------------------------------------------------------------
     5. Mapa sob demanda
     O iframe do Google só entra quando a visitante pede. Isso evita
     ~800 KB e várias conexões de terceiro no carregamento inicial.
     --------------------------------------------------------------------- */
  var botaoMapa = document.getElementById('carregar-mapa');

  if (botaoMapa) {
    botaoMapa.addEventListener('click', function () {
      var moldura = document.createElement('iframe');
      moldura.src = botaoMapa.getAttribute('data-mapa');
      moldura.title = 'Mapa com a localização da VittaClin Estética, na Rua Bom Pastor, 463, Iputinga, Recife';
      moldura.loading = 'lazy';
      moldura.referrerPolicy = 'no-referrer-when-downgrade';
      moldura.setAttribute('allowfullscreen', '');

      var fachada = document.getElementById('mapa-fachada');
      fachada.innerHTML = '';
      fachada.appendChild(moldura);
    });
  }

  /* ---------------------------------------------------------------------
     6. Ano do rodapé sempre atual
     --------------------------------------------------------------------- */
  var ano = document.getElementById('ano-atual');
  if (ano) ano.textContent = String(new Date().getFullYear());

})();

// Aplica a preferência da sidebar (recolhida/expandida) ANTES da primeira pintura,
// evitando salto de layout. Script estático do próprio domínio (CSP 'self').
try {
  if (localStorage.getItem("luumu:sidebar") === "collapsed") document.documentElement.dataset.sidebar = "collapsed";
} catch {}

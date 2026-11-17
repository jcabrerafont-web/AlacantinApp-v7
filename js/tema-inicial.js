// Aplica el tema guardado antes de pintar (evita el parpadeo). Script clásico y
// externo: la CSP de vercel.json no permite scripts en línea.
try { var t = localStorage.getItem('alacantinapp-tema'); if (t) document.documentElement.dataset.tema = t; } catch (e) {}

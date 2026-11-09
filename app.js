/* =====================================================================
   app.js — Lógica de la aplicación "Menú mediterráneo del mes"
   Depende de recetas.js (INGREDIENTES y RECETAS), que se carga antes.
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Constantes
     ------------------------------------------------------------------ */
  const CLAVE_GUARDADO = "menuMensual.v1";
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const TIPOS = ["comida", "cena"];
  const TIPO_TEXTO = { comida: "Comida", cena: "Cena" };
  const TIPO_ICONO = { comida: "☀️", cena: "🌙" };

  const CATEGORIAS = [
    { id: "frutas y verduras", nombre: "Frutas y verduras", icono: "🥬" },
    { id: "carne y pescado", nombre: "Carne y pescado", icono: "🐟" },
    { id: "lácteos", nombre: "Lácteos y huevos", icono: "🥚" },
    { id: "despensa", nombre: "Despensa", icono: "🫙" },
    { id: "congelados", nombre: "Congelados", icono: "❄️" },
    { id: "otros", nombre: "Otros", icono: "🛒" }
  ];

  const GRUPOS = {
    legumbres: "Legumbres", pasta: "Pasta", arroz: "Arroz", cereales: "Cereales",
    verduras: "Verduras", cremas: "Sopas y cremas", ensalada: "Ensalada",
    huevos: "Huevos", pescado: "Pescado", carne: "Carne", pan: "Tostas y bocadillos"
  };

  const PROTEINAS = {
    pescado: { texto: "Pescado o marisco", icono: "🐟" },
    blanca: { texto: "Carne blanca", icono: "🍗" },
    roja: { texto: "Carne roja", icono: "🥩" }
  };

  /* Objetivos semanales inspirados en la dieta mediterránea
     (14 platos: 7 comidas + 7 cenas). */
  const OBJETIVO = { legumbresMin: 3, pescadoMin: 3, pescadoMax: 4, blancaMin: 2, huevosMin: 3, rojaMax: 2, carneMax: 4 };

  /* Niveles de exigencia. Si en un hueco no hay ninguna receta que cumpla
     todas las reglas, se baja de nivel: primero se relaja la repetición
     (ventana de días sin repetir), luego el equilibrio de grupos y por
     último los límites de carne. */
  const NIVELES = [
    { ventana: 7, grupos: true, carne: true },
    { ventana: 5, grupos: true, carne: true },
    { ventana: 3, grupos: true, carne: true },
    { ventana: 2, grupos: true, carne: true },
    { ventana: 2, grupos: false, carne: true },
    { ventana: 2, grupos: false, carne: false },
    { ventana: 1, grupos: false, carne: false }
  ];

  /* ------------------------------------------------------------------
     Preparación de recetas: nutrición, proteína principal y validación
     ------------------------------------------------------------------ */
  const POR_ID = new Map();

  function gramosDe(ing, info) {
    if (info.unidad === "g" || info.unidad === "ml") return ing.cantidad;
    return ing.cantidad * (info.pesoUd || 0);
  }

  function calcularNutricion(receta) {
    const total = { kcal: 0, proteinas: 0, hidratos: 0, grasas: 0, fibra: 0 };
    receta.ingredientes.forEach(function (ing) {
      const info = INGREDIENTES[ing.nombre];
      if (!info || !info.por100) return;
      const f = gramosDe(ing, info) / 100;
      Object.keys(total).forEach(function (k) { total[k] += info.por100[k] * f; });
    });
    return redondearNutricion(total);
  }

  function redondearNutricion(n) {
    return {
      kcal: Math.round(n.kcal),
      proteinas: Math.round(n.proteinas * 10) / 10,
      hidratos: Math.round(n.hidratos * 10) / 10,
      grasas: Math.round(n.grasas * 10) / 10,
      fibra: Math.round(n.fibra * 10) / 10
    };
  }

  function proteinaPrincipal(receta) {
    const tipos = receta.ingredientes.map(function (i) {
      const info = INGREDIENTES[i.nombre];
      return info && info.animal;
    });
    if (tipos.indexOf("roja") >= 0) return "roja";
    if (tipos.indexOf("blanca") >= 0) return "blanca";
    if (tipos.indexOf("pescado") >= 0) return "pescado";
    return null;
  }

  RECETAS.forEach(function (r) {
    r.nutricion = r.nutricion || calcularNutricion(r);
    r.proteina = proteinaPrincipal(r);
    POR_ID.set(r.id, r);
    // Comprobaciones de coherencia de los datos (solo avisos en consola)
    r.ingredientes.forEach(function (i) {
      const info = INGREDIENTES[i.nombre];
      if (!info) { console.warn("Receta " + r.id + ": ingrediente sin datos nutricionales: " + i.nombre); return; }
      if (r.sinGluten && info.gluten) console.warn("Receta " + r.id + " marcada sin gluten pero lleva " + i.nombre);
      if (r.vegetariana && info.animal) console.warn("Receta " + r.id + " marcada vegetariana pero lleva " + i.nombre);
    });
  });

  /* ------------------------------------------------------------------
     Estado y guardado en localStorage
     ------------------------------------------------------------------ */
  function estadoInicial() {
    const hoy = new Date();
    return {
      version: 1,
      mes: hoy.getMonth(),
      anio: hoy.getFullYear(),
      comensales: 2,
      dietas: { vegetariano: false, sinGluten: false },
      menus: {},        // { "2026-11": { "2026-11-01": { comida: "c01", cena: "n05" } } }
      bloqueados: {},   // { "2026-11-01|comida": true }
      tachados: {},     // { "2026-11|mes|Tomate|g": true }
      alcance: "mes"    // "mes" o "s1", "s2"...
    };
  }

  function cargarEstado() {
    const base = estadoInicial();
    try {
      const raw = localStorage.getItem(CLAVE_GUARDADO);
      if (!raw) return base;
      const d = JSON.parse(raw);
      if (!d || typeof d !== "object") return base;
      const e = Object.assign(base, d);
      e.dietas = Object.assign({ vegetariano: false, sinGluten: false }, d.dietas);
      e.menus = e.menus && typeof e.menus === "object" ? e.menus : {};
      e.bloqueados = e.bloqueados && typeof e.bloqueados === "object" ? e.bloqueados : {};
      e.tachados = e.tachados && typeof e.tachados === "object" ? e.tachados : {};
      if (!(e.mes >= 0 && e.mes <= 11)) e.mes = base.mes;
      if (!(e.anio >= 1900 && e.anio <= 2200)) e.anio = base.anio;
      e.comensales = Math.min(6, Math.max(1, parseInt(e.comensales, 10) || 2));
      return e;
    } catch (err) {
      return base;
    }
  }

  function guardar() {
    try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado)); } catch (err) { /* sin almacenamiento */ }
  }

  let estado = cargarEstado();

  /* ------------------------------------------------------------------
     Utilidades de fechas
     ------------------------------------------------------------------ */
  function dos(n) { return (n < 10 ? "0" : "") + n; }
  function claveFecha(d) { return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()); }
  function fechaDeClave(k) { const p = k.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function desplazar(k, n) { const d = fechaDeClave(k); d.setDate(d.getDate() + n); return claveFecha(d); }
  function claveMes(anio, mes) { return anio + "-" + dos(mes + 1); }
  function mesActual() { return claveMes(estado.anio, estado.mes); }
  function diasDelMes(anio, mes) { return new Date(anio, mes + 1, 0).getDate(); }
  function diaSemana(d) { return (d.getDay() + 6) % 7; } // 0 = lunes
  function clavesDelMes() {
    const n = diasDelMes(estado.anio, estado.mes), out = [];
    for (let i = 1; i <= n; i++) out.push(claveFecha(new Date(estado.anio, estado.mes, i)));
    return out;
  }
  function lunesDe(k) { const d = fechaDeClave(k); return desplazar(k, -diaSemana(d)); }
  function textoFecha(k) {
    const d = fechaDeClave(k);
    return DIAS[diaSemana(d)] + ", " + d.getDate() + " de " + MESES[d.getMonth()];
  }
  function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ------------------------------------------------------------------
     Acceso al menú
     ------------------------------------------------------------------ */
  function platoId(k, tipo) {
    const m = estado.menus[k.slice(0, 7)];
    return m && m[k] ? m[k][tipo] : null;
  }
  function plato(k, tipo) { const id = platoId(k, tipo); return id ? POR_ID.get(id) || null : null; }
  function ponerPlato(k, tipo, id) {
    const mk = k.slice(0, 7);
    if (!estado.menus[mk]) estado.menus[mk] = {};
    if (!estado.menus[mk][k]) estado.menus[mk][k] = { comida: null, cena: null };
    estado.menus[mk][k][tipo] = id;
  }
  function claveBloqueo(k, tipo) { return k + "|" + tipo; }
  function estaBloqueado(k, tipo) { return !!estado.bloqueados[claveBloqueo(k, tipo)]; }
  function hayMenu() {
    const m = estado.menus[mesActual()];
    return !!m && Object.keys(m).some(function (k) { return m[k].comida || m[k].cena; });
  }

  /* ------------------------------------------------------------------
     Dietas
     ------------------------------------------------------------------ */
  function cumpleDieta(r) {
    if (estado.dietas.vegetariano && !r.vegetariana) return false;
    if (estado.dietas.sinGluten && !r.sinGluten) return false;
    return true;
  }
  function recetasValidas(tipo) {
    return RECETAS.filter(function (r) { return r.tipo === tipo && cumpleDieta(r); });
  }

  /* ------------------------------------------------------------------
     Algoritmo de generación
     ------------------------------------------------------------------ */
  function cumpleReglas(r, k, tipo, nivel) {
    // 1) No repetir el mismo plato dentro de la ventana de días
    for (let off = 1; off < nivel.ventana; off++) {
      if (platoId(desplazar(k, -off), tipo) === r.id) return false;
      if (platoId(desplazar(k, off), tipo) === r.id) return false;
    }
    // 2) Equilibrio: mismo grupo no en la otra comida del día ni en los días contiguos
    if (nivel.grupos) {
      const vecinos = [
        plato(k, tipo === "comida" ? "cena" : "comida"),
        plato(desplazar(k, -1), "comida"), plato(desplazar(k, -1), "cena"),
        plato(desplazar(k, 1), "comida"), plato(desplazar(k, 1), "cena")
      ];
      if (vecinos.some(function (v) { return v && v.grupo === r.grupo; })) return false;
    }
    // 3) Carne: máximo semanal (solo afecta si la dieta incluye carne)
    if (nivel.carne && (r.proteina === "roja" || r.proteina === "blanca")) {
      const s = recuentoSemana(k, tipo);
      if (s.carne >= OBJETIVO.carneMax) return false;
      if (r.proteina === "roja" && s.roja >= OBJETIVO.rojaMax) return false;
    }
    return true;
  }

  /* Recuento de la semana (lunes a domingo) que contiene k, sin contar el hueco actual. */
  function recuentoSemana(k, tipoExcluido) {
    const lunes = lunesDe(k);
    const s = { legumbres: 0, huevos: 0, pescado: 0, roja: 0, carne: 0 };
    for (let i = 0; i < 7; i++) {
      const dk = desplazar(lunes, i);
      TIPOS.forEach(function (t) {
        if (dk === k && t === tipoExcluido) return;
        const p = plato(dk, t);
        if (!p) return;
        if (p.grupo === "legumbres") s.legumbres++;
        if (p.grupo === "huevos") s.huevos++;
        if (p.proteina === "pescado") s.pescado++;
        if (p.proteina === "roja") { s.roja++; s.carne++; }
        if (p.proteina === "blanca") s.carne++;
      });
    }
    return s;
  }

  function diasDesdeUso(id, k, tipo, max) {
    for (let off = 1; off <= max; off++) {
      if (platoId(desplazar(k, -off), tipo) === id || platoId(desplazar(k, off), tipo) === id) return off;
    }
    return max;
  }

  function puntuar(r, k, tipo) {
    const s = recuentoSemana(k, tipo);
    let p = Math.random() * 2;
    if (r.grupo === "legumbres" && s.legumbres < OBJETIVO.legumbresMin) p += 2;
    if (r.grupo === "huevos" && s.huevos < OBJETIVO.huevosMin) p += 1.5;
    if (r.proteina === "pescado") {
      if (s.pescado < OBJETIVO.pescadoMin) p += 2.5;
      else if (s.pescado >= OBJETIVO.pescadoMax) p -= 2;
    }
    if (r.proteina === "blanca" && s.carne < OBJETIVO.blancaMin) p += 2;
    if (r.proteina === "roja" && s.roja >= 1) p -= 1.5;
    p += diasDesdeUso(r.id, k, tipo, 21) / 21 * 1.5; // preferir platos que hace tiempo que no salen
    return p;
  }

  /* Elige la mejor receta para un hueco. Devuelve { receta, nivel } o null. */
  function elegirReceta(k, tipo, excluirId) {
    const candidatas = recetasValidas(tipo).filter(function (r) { return r.id !== excluirId; });
    if (!candidatas.length) return null;
    for (let n = 0; n < NIVELES.length; n++) {
      const validas = candidatas.filter(function (r) { return cumpleReglas(r, k, tipo, NIVELES[n]); });
      if (validas.length) {
        let mejor = null, mejorP = -Infinity;
        validas.forEach(function (r) {
          const p = puntuar(r, k, tipo);
          if (p > mejorP) { mejorP = p; mejor = r; }
        });
        return { receta: mejor, nivel: n };
      }
    }
    return { receta: candidatas[0], nivel: NIVELES.length - 1 };
  }

  function generarMenu() {
    const mk = mesActual();
    const claves = clavesDelMes();
    if (!recetasValidas("comida").length || !recetasValidas("cena").length) {
      mostrarAviso("No hay recetas que cumplan la dieta elegida.", "error");
      return;
    }
    // Conservar solo los platos bloqueados
    const anterior = estado.menus[mk] || {};
    const nuevo = {};
    claves.forEach(function (k) {
      nuevo[k] = { comida: null, cena: null };
      TIPOS.forEach(function (t) {
        const id = anterior[k] && anterior[k][t];
        if (id && POR_ID.has(id) && estaBloqueado(k, t)) nuevo[k][t] = id;
        else delete estado.bloqueados[claveBloqueo(k, t)];
      });
    });
    estado.menus[mk] = nuevo;

    const relajado = { repeticion: 0, grupos: 0, carne: 0 };
    claves.forEach(function (k) {
      TIPOS.forEach(function (t) {
        if (nuevo[k][t]) return;
        const res = elegirReceta(k, t, null);
        if (!res) return;
        nuevo[k][t] = res.receta.id;
        const nv = NIVELES[res.nivel];
        if (nv.ventana < 7) relajado.repeticion++;
        if (!nv.grupos) relajado.grupos++;
        if (!nv.carne) relajado.carne++;
      });
    });

    estado.alcance = "mes";
    guardar();
    renderTodo();

    const msgs = [];
    if (relajado.repeticion) msgs.push("Con la dieta elegida hay pocas recetas: en " + relajado.repeticion +
      " ocasiones se ha repetido un plato antes de 7 días.");
    if (relajado.grupos) msgs.push("En " + relajado.grupos + " ocasiones no se ha podido evitar repetir el mismo tipo de plato en días seguidos.");
    if (relajado.carne) msgs.push("En " + relajado.carne + " ocasiones se ha superado el límite semanal de carne.");
    const incompatibles = bloqueadosIncompatibles();
    if (incompatibles.length) msgs.push("Se mantienen " + incompatibles.length + " platos bloqueados que no cumplen la dieta actual.");
    if (msgs.length) mostrarAviso(msgs.join(" "), "aviso");
    else mostrarAviso("Menú de " + MESES[estado.mes] + " generado.", "ok");
  }

  function cambiarPlato(k, tipo) {
    const actual = platoId(k, tipo);
    const res = elegirReceta(k, tipo, actual);
    if (!res) { mostrarAviso("No hay otra receta disponible con la dieta actual.", "aviso"); return false; }
    ponerPlato(k, tipo, res.receta.id);
    guardar();
    return true;
  }

  function bloqueadosIncompatibles() {
    const out = [];
    Object.keys(estado.bloqueados).forEach(function (kb) {
      if (!estado.bloqueados[kb]) return;
      const partes = kb.split("|");
      const r = plato(partes[0], partes[1]);
      if (r && !cumpleDieta(r)) out.push({ k: partes[0], tipo: partes[1], receta: r });
    });
    out.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
    return out;
  }

  /* ------------------------------------------------------------------
     Referencias al DOM
     ------------------------------------------------------------------ */
  const $ = function (id) { return document.getElementById(id); };
  const el = {
    form: $("form-opciones"), selMes: $("sel-mes"), inpAnio: $("inp-anio"),
    selComensales: $("sel-comensales"), dietaVeg: $("dieta-veg"), dietaSg: $("dieta-sg"),
    disponibles: $("recetas-disponibles"), reiniciar: $("btn-reiniciar"),
    avisos: $("avisos"), tituloCal: $("titulo-calendario"), rejilla: $("cal-rejilla"),
    calVacio: $("cal-vacio"), resumen: $("resumen-nutricional"),
    dlgDia: $("dialogo-dia"), dlgDiaTitulo: $("dia-titulo"), dlgDiaCuerpo: $("dia-cuerpo"),
    dlgConflicto: $("dialogo-conflicto"), conflictoLista: $("conflicto-lista"),
    btnDesbloquear: $("btn-desbloquear"), btnMantener: $("btn-mantener"),
    selAlcance: $("sel-alcance"), compraInfo: $("compra-info"), listaCompra: $("lista-compra"),
    btnCopiar: $("btn-copiar"), btnImprimir: $("btn-imprimir"), estadoCompra: $("estado-compra"),
    tituloImpresion: $("titulo-impresion")
  };

  function crear(tag, attrs, hijos) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (a) {
      if (a === "texto") n.textContent = attrs[a];
      else if (a === "clase") n.className = attrs[a];
      else n.setAttribute(a, attrs[a]);
    });
    (hijos || []).forEach(function (h) { if (h) n.appendChild(typeof h === "string" ? document.createTextNode(h) : h); });
    return n;
  }

  /* ------------------------------------------------------------------
     Avisos
     ------------------------------------------------------------------ */
  function mostrarAviso(texto, tipo) {
    el.avisos.innerHTML = "";
    const cerrar = crear("button", { type: "button", clase: "aviso-cerrar", "aria-label": "Cerrar aviso", texto: "×" });
    cerrar.addEventListener("click", function () { el.avisos.innerHTML = ""; });
    el.avisos.appendChild(crear("div", { clase: "aviso aviso-" + (tipo || "ok") }, [crear("p", { texto: texto }), cerrar]));
  }

  /* ------------------------------------------------------------------
     Controles
     ------------------------------------------------------------------ */
  function renderControles() {
    if (!el.selMes.options.length) {
      MESES.forEach(function (m, i) { el.selMes.appendChild(crear("option", { value: String(i), texto: capitalizar(m) })); });
      for (let i = 1; i <= 6; i++) el.selComensales.appendChild(crear("option", { value: String(i), texto: String(i) }));
    }
    el.selMes.value = String(estado.mes);
    el.inpAnio.value = String(estado.anio);
    el.selComensales.value = String(estado.comensales);
    el.dietaVeg.checked = estado.dietas.vegetariano;
    el.dietaSg.checked = estado.dietas.sinGluten;
    el.disponibles.textContent = "Recetas disponibles con esta dieta: " +
      recetasValidas("comida").length + " comidas y " + recetasValidas("cena").length + " cenas.";
  }

  /* ------------------------------------------------------------------
     Etiquetas y nutrición
     ------------------------------------------------------------------ */
  function etiquetas(r) {
    const ul = crear("ul", { clase: "etiquetas", "aria-label": "Características" });
    ul.appendChild(crear("li", { clase: "etq etq-tiempo", texto: "⏱ " + r.tiempo + " min" }));
    if (r.vegetariana) ul.appendChild(crear("li", { clase: "etq etq-veg", texto: "🌱 Vegetariano" }));
    if (r.sinGluten) ul.appendChild(crear("li", { clase: "etq etq-sg", texto: "🌾 Sin gluten" }));
    if (r.proteina) ul.appendChild(crear("li", { clase: "etq etq-prot", texto: PROTEINAS[r.proteina].icono + " " + PROTEINAS[r.proteina].texto }));
    else if (r.grupo === "legumbres") ul.appendChild(crear("li", { clase: "etq etq-prot", texto: "🫘 Legumbres" }));
    if (!cumpleDieta(r)) ul.appendChild(crear("li", { clase: "etq etq-alerta", texto: "⚠ No cumple la dieta actual" }));
    return ul;
  }

  function fmtNum(n, dec) {
    return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: dec == null ? 1 : dec });
  }

  function tablaNutricion(n, titulo) {
    const items = [
      ["Energía", fmtNum(n.kcal, 0) + " kcal"],
      ["Proteínas", fmtNum(n.proteinas) + " g"],
      ["Hidratos", fmtNum(n.hidratos) + " g"],
      ["Grasas", fmtNum(n.grasas) + " g"],
      ["Fibra", fmtNum(n.fibra) + " g"]
    ];
    const dl = crear("dl", { clase: "nutri", "aria-label": titulo });
    items.forEach(function (it, i) {
      dl.appendChild(crear("div", { clase: "nutri-item" + (i === 0 ? " nutri-kcal" : "") }, [crear("dt", { texto: it[0] }), crear("dd", { texto: it[1] })]));
    });
    return dl;
  }

  function sumarNutricion(lista) {
    const t = { kcal: 0, proteinas: 0, hidratos: 0, grasas: 0, fibra: 0 };
    lista.forEach(function (n) { if (n) Object.keys(t).forEach(function (k) { t[k] += n[k]; }); });
    return t;
  }

  /* ------------------------------------------------------------------
     Calendario
     ------------------------------------------------------------------ */
  function renderCalendario() {
    el.tituloCal.textContent = capitalizar(MESES[estado.mes]) + " " + estado.anio;
    el.rejilla.innerHTML = "";
    const claves = clavesDelMes();
    const offset = diaSemana(fechaDeClave(claves[0]));
    const hoy = claveFecha(new Date());
    const conMenu = hayMenu();
    el.calVacio.hidden = conMenu;

    for (let i = 0; i < offset; i++) el.rejilla.appendChild(crear("li", { clase: "cal-hueco", "aria-hidden": "true" }));

    claves.forEach(function (k) {
      const d = fechaDeClave(k);
      const btn = crear("button", { type: "button", clase: "dia", "data-fecha": k });
      if (k === hoy) btn.classList.add("dia-hoy");
      if (diaSemana(d) >= 5) btn.classList.add("dia-finde");
      const partesLabel = [capitalizar(textoFecha(k))];

      btn.appendChild(crear("span", { clase: "dia-cab" }, [
        crear("span", { clase: "dia-num", texto: String(d.getDate()) }),
        crear("span", { clase: "dia-nombre", texto: capitalizar(DIAS[diaSemana(d)]) }),
        k === hoy ? crear("span", { clase: "dia-hoy-txt", texto: "Hoy" }) : null
      ]));

      const nutris = [];
      TIPOS.forEach(function (t) {
        const r = plato(k, t);
        if (!r) return;
        nutris.push(r.nutricion);
        const bloq = estaBloqueado(k, t);
        const marca = (bloq ? " 🔒" : "") + (!cumpleDieta(r) ? " ⚠" : "");
        btn.appendChild(crear("span", { clase: "mini mini-" + t }, [
          crear("span", { clase: "mini-icono", "aria-hidden": "true", texto: TIPO_ICONO[t] }),
          crear("span", { clase: "mini-nombre", texto: r.nombre }),
          marca ? crear("span", { clase: "mini-marca", "aria-hidden": "true", texto: marca }) : null
        ]));
        partesLabel.push(TIPO_TEXTO[t] + ": " + r.nombre + (bloq ? " (bloqueado)" : "") + (!cumpleDieta(r) ? " (no cumple la dieta)" : ""));
      });
      if (nutris.length) {
        const kcal = Math.round(sumarNutricion(nutris).kcal);
        btn.appendChild(crear("span", { clase: "dia-kcal", texto: fmtNum(kcal, 0) + " kcal" }));
        partesLabel.push(fmtNum(kcal, 0) + " kilocalorías");
      } else {
        btn.appendChild(crear("span", { clase: "dia-sin", texto: "Sin menú" }));
      }
      btn.setAttribute("aria-label", partesLabel.join(". "));
      btn.addEventListener("click", function () { abrirDia(k); });
      el.rejilla.appendChild(crear("li", { clase: "cal-celda" }, [btn]));
    });
  }

  // Navegación con flechas por los días del calendario
  function navegarTeclado(e) {
    const btn = e.target.closest ? e.target.closest(".dia") : null;
    if (!btn) return;
    const lista = Array.prototype.slice.call(el.rejilla.querySelectorAll(".dia"));
    const i = lista.indexOf(btn);
    const enLista = window.matchMedia("(max-width: 720px)").matches;
    let j = null;
    if (e.key === "ArrowRight") j = i + 1;
    else if (e.key === "ArrowLeft") j = i - 1;
    else if (e.key === "ArrowDown") j = i + (enLista ? 1 : 7);
    else if (e.key === "ArrowUp") j = i - (enLista ? 1 : 7);
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = lista.length - 1;
    if (j === null) return;
    e.preventDefault();
    j = Math.max(0, Math.min(lista.length - 1, j));
    lista[j].focus();
  }

  /* ------------------------------------------------------------------
     Diálogo del día
     ------------------------------------------------------------------ */
  let diaAbierto = null;

  function abrirDia(k) {
    diaAbierto = k;
    renderDia();
    if (typeof el.dlgDia.showModal === "function") {
      if (!el.dlgDia.open) el.dlgDia.showModal();
    } else {
      el.dlgDia.setAttribute("open", "");
    }
    const primero = el.dlgDia.querySelector(".btn-cambiar, .btn-candado");
    if (primero) primero.focus();
  }

  function cerrarDia() {
    const k = diaAbierto;
    if (el.dlgDia.open && typeof el.dlgDia.close === "function") el.dlgDia.close();
    else el.dlgDia.removeAttribute("open");
    diaAbierto = null;
    const b = k && el.rejilla.querySelector('.dia[data-fecha="' + k + '"]');
    if (b) b.focus();
  }

  function renderDia(focoSelector) {
    const k = diaAbierto;
    if (!k) return;
    el.dlgDiaTitulo.textContent = capitalizar(textoFecha(k));
    el.dlgDiaCuerpo.innerHTML = "";
    const nutris = [];

    TIPOS.forEach(function (t) {
      const r = plato(k, t);
      const art = crear("article", { clase: "plato plato-" + t, "aria-labelledby": "plato-" + t + "-nombre" });
      art.appendChild(crear("p", { clase: "plato-tipo", texto: TIPO_ICONO[t] + " " + TIPO_TEXTO[t] }));
      if (!r) {
        art.appendChild(crear("h3", { id: "plato-" + t + "-nombre", texto: "Sin plato asignado" }));
        art.appendChild(crear("p", { clase: "ayuda", texto: "Pulsa «Generar menú» para rellenar el mes." }));
        el.dlgDiaCuerpo.appendChild(art);
        return;
      }
      nutris.push(r.nutricion);
      const bloq = estaBloqueado(k, t);
      art.appendChild(crear("h3", { id: "plato-" + t + "-nombre", texto: r.nombre }));
      art.appendChild(etiquetas(r));
      art.appendChild(crear("h4", { clase: "subtitulo", texto: "Información nutricional por ración" }));
      art.appendChild(tablaNutricion(r.nutricion, "Información nutricional de " + r.nombre));

      const n = estado.comensales;
      const det = crear("details", { clase: "ingredientes", open: "" });
      det.appendChild(crear("summary", { texto: "Ingredientes (" + n + (n === 1 ? " persona)" : " personas)") }));
      const ul = crear("ul");
      r.ingredientes.forEach(function (i) {
        ul.appendChild(crear("li", {}, [crear("span", { texto: i.nombre }), crear("span", { clase: "cant", texto: formatearCantidad(i.cantidad * n, i.unidad) })]));
      });
      det.appendChild(ul);
      art.appendChild(det);

      const cambiar = crear("button", { type: "button", clase: "btn btn-secundario btn-cambiar", "data-tipo": t,
        "aria-label": "Cambiar " + TIPO_TEXTO[t].toLowerCase() + ": " + r.nombre, texto: "🔄 Cambiar" });
      if (bloq) { cambiar.disabled = true; cambiar.title = "Desbloquea el plato para poder cambiarlo"; }
      cambiar.addEventListener("click", function () {
        if (cambiarPlato(k, t)) { renderDia(".btn-cambiar[data-tipo='" + t + "']"); renderCalendario(); renderResumen(); renderCompra(); }
      });
      const candado = crear("button", { type: "button", clase: "btn btn-candado" + (bloq ? " activo" : ""), "data-tipo": t,
        "aria-pressed": bloq ? "true" : "false",
        "aria-label": (bloq ? "Desbloquear " : "Bloquear ") + TIPO_TEXTO[t].toLowerCase() + ": " + r.nombre,
        texto: bloq ? "🔒 Bloqueado" : "🔓 Bloquear" });
      candado.addEventListener("click", function () {
        const kb = claveBloqueo(k, t);
        if (estado.bloqueados[kb]) delete estado.bloqueados[kb]; else estado.bloqueados[kb] = true;
        guardar();
        renderDia(".btn-candado[data-tipo='" + t + "']");
        renderCalendario();
      });
      art.appendChild(crear("div", { clase: "plato-acciones" }, [cambiar, candado]));
      el.dlgDiaCuerpo.appendChild(art);
    });

    if (nutris.length) {
      const total = redondearNutricion(sumarNutricion(nutris));
      el.dlgDiaCuerpo.appendChild(crear("section", { clase: "dia-total", "aria-labelledby": "dia-total-titulo" }, [
        crear("h3", { id: "dia-total-titulo", texto: "Total del día por persona (comida + cena)" }),
        tablaNutricion(total, "Total nutricional del día"),
        crear("p", { clase: "ayuda", texto: "Valores aproximados. No incluyen desayuno, meriendas, pan ni postre." })
      ]));
    }
    if (focoSelector) {
      const f = el.dlgDiaCuerpo.querySelector(focoSelector);
      if (f && !f.disabled) f.focus();
    }
  }

  /* ------------------------------------------------------------------
     Resumen nutricional del mes
     ------------------------------------------------------------------ */
  function renderResumen() {
    el.resumen.innerHTML = "";
    if (!hayMenu()) { el.resumen.hidden = true; return; }
    el.resumen.hidden = false;
    const claves = clavesDelMes();
    const nutris = [];
    const c = { legumbres: 0, pescado: 0, blanca: 0, roja: 0, huevos: 0, vegetarianos: 0, total: 0 };
    let dias = 0;
    claves.forEach(function (k) {
      let algo = false;
      TIPOS.forEach(function (t) {
        const r = plato(k, t);
        if (!r) return;
        algo = true;
        nutris.push(r.nutricion);
        c.total++;
        if (r.grupo === "legumbres") c.legumbres++;
        if (r.grupo === "huevos") c.huevos++;
        if (r.proteina) c[r.proteina]++;
        if (r.vegetariana) c.vegetarianos++;
      });
      if (algo) dias++;
    });
    const t = sumarNutricion(nutris);
    const media = redondearNutricion({ kcal: t.kcal / dias, proteinas: t.proteinas / dias, hidratos: t.hidratos / dias, grasas: t.grasas / dias, fibra: t.fibra / dias });
    const energia = media.proteinas * 4 + media.hidratos * 4 + media.grasas * 9 || 1;
    const pct = function (g, f) { return Math.round(g * f / energia * 100); };
    const semanas = dias / 7;
    const porSemana = function (n) { return fmtNum(n / semanas, 1); };

    el.resumen.appendChild(crear("h2", { id: "titulo-resumen", texto: "Resumen nutricional del mes" }));
    el.resumen.appendChild(crear("p", { clase: "ayuda", texto: "Media diaria por persona de comida + cena (" + dias + " días). Valores orientativos." }));
    el.resumen.appendChild(tablaNutricion(media, "Media diaria"));
    el.resumen.appendChild(crear("p", { clase: "reparto", texto: "Reparto de la energía: proteínas " + pct(media.proteinas, 4) +
      " %, hidratos " + pct(media.hidratos, 4) + " %, grasas " + pct(media.grasas, 9) + " % (sobre todo de aceite de oliva y frutos secos)." }));

    const filas = [
      ["🫘 Legumbres", porSemana(c.legumbres), "3 o más"],
      ["🐟 Pescado o marisco", porSemana(c.pescado), estado.dietas.vegetariano ? "—" : "3 o más"],
      ["🍗 Carne blanca", porSemana(c.blanca), estado.dietas.vegetariano ? "—" : "2-3"],
      ["🥩 Carne roja", porSemana(c.roja), estado.dietas.vegetariano ? "—" : "2 o menos"],
      ["🥚 Platos de huevo", porSemana(c.huevos), "3-4"],
      ["🌱 Platos vegetarianos", porSemana(c.vegetarianos), "—"]
    ];
    const tabla = crear("table", { clase: "tabla-frecuencias" });
    tabla.appendChild(crear("caption", { texto: "Frecuencia media por semana frente a la recomendación mediterránea" }));
    tabla.appendChild(crear("thead", {}, [crear("tr", {}, [crear("th", { scope: "col", texto: "Tipo" }), crear("th", { scope: "col", texto: "Veces por semana" }), crear("th", { scope: "col", texto: "Recomendado" })])]));
    const tb = crear("tbody");
    filas.forEach(function (f) { tb.appendChild(crear("tr", {}, [crear("th", { scope: "row", texto: f[0] }), crear("td", { texto: f[1] }), crear("td", { texto: f[2] })])); });
    tabla.appendChild(tb);
    el.resumen.appendChild(crear("div", { clase: "tabla-scroll" }, [tabla]));
  }

  /* ------------------------------------------------------------------
     Lista de la compra
     ------------------------------------------------------------------ */
  function semanasDelMes() {
    const claves = clavesDelMes(), semanas = [];
    let actual = null;
    claves.forEach(function (k) {
      if (!actual || diaSemana(fechaDeClave(k)) === 0) { actual = []; semanas.push(actual); }
      actual.push(k);
    });
    return semanas;
  }

  function clavesDelAlcance() {
    if (estado.alcance === "mes") return clavesDelMes();
    const n = parseInt(estado.alcance.slice(1), 10);
    const s = semanasDelMes()[n - 1];
    return s || clavesDelMes();
  }

  function textoAlcance() {
    if (estado.alcance === "mes") return "mes completo";
    const s = clavesDelAlcance();
    return "semana " + estado.alcance.slice(1) + " (" + fechaDeClave(s[0]).getDate() + "–" + fechaDeClave(s[s.length - 1]).getDate() + " de " + MESES[estado.mes] + ")";
  }

  function renderSelectorAlcance() {
    const semanas = semanasDelMes();
    el.selAlcance.innerHTML = "";
    el.selAlcance.appendChild(crear("option", { value: "mes", texto: "Mes completo" }));
    semanas.forEach(function (s, i) {
      el.selAlcance.appendChild(crear("option", { value: "s" + (i + 1),
        texto: "Semana " + (i + 1) + " (" + fechaDeClave(s[0]).getDate() + "–" + fechaDeClave(s[s.length - 1]).getDate() + " " + MESES[estado.mes].slice(0, 3) + ")" }));
    });
    if (estado.alcance !== "mes" && parseInt(estado.alcance.slice(1), 10) > semanas.length) estado.alcance = "mes";
    el.selAlcance.value = estado.alcance;
  }

  function calcularCompra() {
    const mapa = new Map();
    const n = estado.comensales;
    clavesDelAlcance().forEach(function (k) {
      TIPOS.forEach(function (t) {
        const r = plato(k, t);
        if (!r) return;
        r.ingredientes.forEach(function (i) {
          const clave = i.nombre + "|" + i.unidad;
          const prev = mapa.get(clave);
          if (prev) prev.cantidad += i.cantidad * n;
          else mapa.set(clave, { clave: clave, nombre: i.nombre, unidad: i.unidad, categoria: i.categoria, cantidad: i.cantidad * n });
        });
      });
    });
    const grupos = CATEGORIAS.map(function (c) {
      return { categoria: c, items: [] };
    });
    mapa.forEach(function (item) {
      const g = grupos.find(function (x) { return x.categoria.id === item.categoria; }) || grupos[grupos.length - 1];
      g.items.push(item);
    });
    grupos.forEach(function (g) { g.items.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); }); });
    return grupos.filter(function (g) { return g.items.length; });
  }

  function formatearCantidad(c, unidad) {
    if (unidad === "g" || unidad === "ml") {
      const grande = unidad === "g" ? "kg" : "l";
      if (c >= 1000) return fmtNum(Math.round(c / 100) / 10, 1) + " " + grande;
      let r;
      if (c < 10) r = Math.round(c * 2) / 2;
      else if (c < 100) r = Math.round(c / 5) * 5;
      else r = Math.round(c / 10) * 10;
      return fmtNum(r, 1) + " " + unidad;
    }
    const u = Math.ceil(c - 1e-9);
    if (unidad === "diente") return u + (u === 1 ? " diente" : " dientes");
    return u + " ud";
  }

  function claveTachado(item) { return mesActual() + "|" + estado.alcance + "|" + item.clave; }

  function renderCompra() {
    renderSelectorAlcance();
    el.listaCompra.innerHTML = "";
    const grupos = calcularCompra();
    const comens = estado.comensales + (estado.comensales === 1 ? " comensal" : " comensales");
    el.tituloImpresion.textContent = capitalizar(MESES[estado.mes]) + " " + estado.anio + " · " + textoAlcance() + " · " + comens;
    if (!grupos.length) {
      el.compraInfo.textContent = "Genera el menú para ver la lista de la compra.";
      el.btnCopiar.disabled = true; el.btnImprimir.disabled = true;
      return;
    }
    el.btnCopiar.disabled = false; el.btnImprimir.disabled = false;
    let total = 0, hechos = 0;
    grupos.forEach(function (g) {
      const idTit = "cat-" + CATEGORIAS.indexOf(g.categoria);
      const sec = crear("section", { clase: "cat", "aria-labelledby": idTit });
      sec.appendChild(crear("h3", { id: idTit }, [crear("span", { "aria-hidden": "true", texto: g.categoria.icono + " " }), g.categoria.nombre]));
      const ul = crear("ul", { clase: "productos" });
      g.items.forEach(function (item, idx) {
        total++;
        const id = "prod-" + CATEGORIAS.indexOf(g.categoria) + "-" + idx;
        const tachado = !!estado.tachados[claveTachado(item)];
        if (tachado) hechos++;
        const chk = crear("input", { type: "checkbox", id: id });
        chk.checked = tachado;
        chk.addEventListener("change", function () {
          const kt = claveTachado(item);
          if (chk.checked) estado.tachados[kt] = true; else delete estado.tachados[kt];
          guardar();
          li.classList.toggle("tachado", chk.checked);
          actualizarInfoCompra();
        });
        const li = crear("li", { clase: tachado ? "tachado" : "" }, [
          chk,
          crear("label", { for: id }, [crear("span", { clase: "prod-nombre", texto: item.nombre }), crear("span", { clase: "prod-cant", texto: formatearCantidad(item.cantidad, item.unidad) })])
        ]);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      el.listaCompra.appendChild(sec);
    });
    actualizarInfoCompra();
  }

  function actualizarInfoCompra() {
    const todos = el.listaCompra.querySelectorAll("input[type=checkbox]");
    const hechos = el.listaCompra.querySelectorAll("input[type=checkbox]:checked").length;
    const comens = estado.comensales + (estado.comensales === 1 ? " comensal" : " comensales");
    el.compraInfo.textContent = capitalizar(textoAlcance()) + " · " + comens + " · " + todos.length + " productos, " +
      hechos + " ya los tienes.";
  }

  function textoLista() {
    const grupos = calcularCompra();
    const comens = estado.comensales + (estado.comensales === 1 ? " comensal" : " comensales");
    const lineas = ["LISTA DE LA COMPRA — " + capitalizar(MESES[estado.mes]) + " " + estado.anio + " (" + textoAlcance() + ", " + comens + ")", ""];
    let omitidos = 0;
    grupos.forEach(function (g) {
      const pendientes = g.items.filter(function (i) { if (estado.tachados[claveTachado(i)]) { omitidos++; return false; } return true; });
      if (!pendientes.length) return;
      lineas.push(g.categoria.nombre.toUpperCase());
      pendientes.forEach(function (i) { lineas.push("- " + i.nombre + ": " + formatearCantidad(i.cantidad, i.unidad)); });
      lineas.push("");
    });
    if (omitidos) lineas.push("(Se omiten " + omitidos + " productos que ya tienes.)");
    return lineas.join("\n").trim();
  }

  function copiarLista() {
    const texto = textoLista();
    const ok = function () { el.estadoCompra.textContent = "Lista copiada al portapapeles."; };
    const alternativo = function () {
      const ta = crear("textarea", { "aria-hidden": "true", readonly: "" });
      ta.value = texto;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let exito = false;
      try { exito = document.execCommand("copy"); } catch (err) { exito = false; }
      document.body.removeChild(ta);
      if (exito) ok(); else el.estadoCompra.textContent = "No se ha podido copiar automáticamente. Selecciona la lista y cópiala a mano.";
    };
    if (navigator.clipboard && window.isSecureContext !== false) {
      navigator.clipboard.writeText(texto).then(ok, alternativo);
    } else {
      alternativo();
    }
  }

  /* ------------------------------------------------------------------
     Cambio de dieta con platos bloqueados incompatibles
     ------------------------------------------------------------------ */
  function alCambiarDieta() {
    estado.dietas.vegetariano = el.dietaVeg.checked;
    estado.dietas.sinGluten = el.dietaSg.checked;
    guardar();
    renderControles();
    const incompatibles = bloqueadosIncompatibles();
    if (incompatibles.length) {
      el.conflictoLista.innerHTML = "";
      incompatibles.forEach(function (x) {
        el.conflictoLista.appendChild(crear("li", { texto: capitalizar(textoFecha(x.k)) + " · " + TIPO_TEXTO[x.tipo] + ": " + x.receta.nombre }));
      });
      if (typeof el.dlgConflicto.showModal === "function") el.dlgConflicto.showModal();
      else el.dlgConflicto.setAttribute("open", "");
      el.btnDesbloquear.focus();
    } else if (hayMenu()) {
      const n = contarIncompatiblesMes();
      if (n) mostrarAviso("Has cambiado la dieta: " + n + " platos del menú actual no la cumplen (marcados con ⚠). Pulsa «Generar menú» para actualizarlo.", "aviso");
    }
    renderCalendario();
  }

  function contarIncompatiblesMes() {
    let n = 0;
    clavesDelMes().forEach(function (k) { TIPOS.forEach(function (t) { const r = plato(k, t); if (r && !cumpleDieta(r)) n++; }); });
    return n;
  }

  function cerrarConflicto() {
    if (el.dlgConflicto.open && typeof el.dlgConflicto.close === "function") el.dlgConflicto.close();
    else el.dlgConflicto.removeAttribute("open");
  }

  function desbloquearIncompatibles() {
    const lista = bloqueadosIncompatibles();
    lista.forEach(function (x) { delete estado.bloqueados[claveBloqueo(x.k, x.tipo)]; });
    lista.forEach(function (x) { cambiarPlato(x.k, x.tipo); });
    guardar();
    cerrarConflicto();
    renderTodo();
    mostrarAviso("Se han desbloqueado y sustituido " + lista.length + " platos por otros compatibles con la dieta.", "ok");
    el.dietaVeg.focus();
  }

  /* ------------------------------------------------------------------
     Render general y eventos
     ------------------------------------------------------------------ */
  function renderTodo() {
    renderControles();
    renderCalendario();
    renderResumen();
    renderCompra();
  }

  el.form.addEventListener("submit", function (e) { e.preventDefault(); generarMenu(); });
  el.selMes.addEventListener("change", function () {
    estado.mes = parseInt(el.selMes.value, 10); estado.alcance = "mes"; guardar(); el.avisos.innerHTML = ""; renderTodo();
  });
  el.inpAnio.addEventListener("change", function () {
    const a = parseInt(el.inpAnio.value, 10);
    if (a >= 1900 && a <= 2200) { estado.anio = a; estado.alcance = "mes"; guardar(); el.avisos.innerHTML = ""; renderTodo(); }
    else el.inpAnio.value = String(estado.anio);
  });
  el.selComensales.addEventListener("change", function () {
    estado.comensales = parseInt(el.selComensales.value, 10); guardar(); renderCompra();
  });
  el.dietaVeg.addEventListener("change", alCambiarDieta);
  el.dietaSg.addEventListener("change", alCambiarDieta);
  el.btnDesbloquear.addEventListener("click", desbloquearIncompatibles);
  el.btnMantener.addEventListener("click", function () {
    cerrarConflicto();
    mostrarAviso("Los platos bloqueados se mantienen aunque no cumplan la dieta (marcados con ⚠).", "aviso");
    el.dietaVeg.focus();
  });
  el.reiniciar.addEventListener("click", function () {
    if (!window.confirm("¿Seguro que quieres borrar el menú, los bloqueos, la lista tachada y las preferencias guardadas?")) return;
    try { localStorage.removeItem(CLAVE_GUARDADO); } catch (err) { /* nada */ }
    estado = estadoInicial();
    renderTodo();
    mostrarAviso("Se han borrado todos los datos guardados.", "ok");
  });
  el.rejilla.addEventListener("keydown", navegarTeclado);
  el.dlgDia.addEventListener("close", function () { if (diaAbierto) cerrarDia(); });
  el.dlgDia.addEventListener("click", function (e) { if (e.target === el.dlgDia) cerrarDia(); });
  document.getElementById("btn-cerrar-dia").addEventListener("click", cerrarDia);
  el.selAlcance.addEventListener("change", function () { estado.alcance = el.selAlcance.value; guardar(); renderCompra(); });
  el.btnCopiar.addEventListener("click", copiarLista);
  el.btnImprimir.addEventListener("click", function () { window.print(); });

  renderTodo();

  // Acceso para pruebas desde la consola
  window.MenuApp = { generarMenu: generarMenu, estado: function () { return estado; }, recetas: POR_ID };
})();

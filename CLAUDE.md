# CLAUDE.md

"Menú mediterráneo del mes": a static web app that generates monthly lunch/dinner
menus (Mediterranean, ≤30 min recipes) with nutrition info and a shopping list.
Plain HTML + CSS + vanilla JS, no dependencies, no build step, no server.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App markup. Loads `recetas.js` then `app.js` with classic `<script>` tags. |
| `recetas.js` | Data only: `INGREDIENTES` (category, unit, nutrients per 100 g/ml) and `RECETAS` (126 recipes, quantities per person). |
| `app.js` | All logic in one IIFE (`"use strict"`): generator, calendar, nutrition, shopping list, localStorage. |
| `styles.css` | Styles: CSS custom properties, dark mode, mobile layout, print. |
| `ayuda.html` | User help page (replaces a README). Explains usage, how to add recipes, and the generator rules. |
| `menu-mediterraneo.zip` | Downloadable copy of the five files above. Must be regenerated when they change (see below). |

## Hard constraints

- **Must work opened from disk via `file://`** (double-click `index.html`). So: no ES modules,
  no `fetch`/XHR of local files, no bundler, no npm packages, no CDN dependencies.
  Shared data goes through globals (`INGREDIENTES`, `RECETAS`) defined in `recetas.js`.
- Keep it to plain HTML/CSS/JS. Don't add frameworks, TypeScript, or a `package.json`.
- Persisted state lives in `localStorage` under key `menuMensual.v1` (`CLAVE_GUARDADO` in
  `app.js`). If you change the stored shape incompatibly, bump the version and handle old data.

## Commands

There is no build and no test suite. Run these to check changes:

```bash
# Syntax check
node --check app.js && node --check recetas.js

# Recipe data validation: duplicate ids, time > 30, unknown ingredients,
# recipes flagged sinGluten/vegetariana that contain gluten/animal ingredients
node -e '
const vm=require("vm"),fs=require("fs");const c={console};vm.createContext(c);
vm.runInContext(fs.readFileSync("recetas.js","utf8")+";this.R=RECETAS;this.I=INGREDIENTES;",c);
const ids=new Set();let err=0;for(const r of c.R){if(ids.has(r.id)){console.log("dup",r.id);err++}ids.add(r.id);
if(r.tiempo>30){console.log("tiempo",r.id);err++}
for(const i of r.ingredientes){const n=i.nombre;const inf=c.I[n];if(!inf){console.log("falta",r.id,n);err++;continue}
if(r.sinGluten&&inf.gluten){console.log("gluten",r.id,n);err++}if(r.vegetariana&&inf.animal){console.log("veg",r.id,n);err++}}}
console.log(c.R.length,"recetas,",err,"problemas");process.exit(err?1:0)'

# Headless smoke test: load the page, generate a menu, report console warnings/errors
# (app.js console.warn()s recipe inconsistencies at load time)
node -e '
const {chromium}=require("playwright");(async()=>{const b=await chromium.launch();const p=await b.newPage();const msgs=[];
p.on("console",m=>{if(m.type()!=="log")msgs.push(m.type()+": "+m.text())});p.on("pageerror",e=>msgs.push("pageerror: "+e.message));
await p.goto("file://"+process.cwd()+"/index.html");await p.click("button[type=submit]");
console.log("celdas:",await p.locator("#cal-rejilla li").count());console.log(msgs.join("\n")||"sin errores");
await b.close();process.exit(msgs.length?1:0)})()'
```

To view it manually, open `index.html` in a browser (or `python3 -m http.server` if needed).

### Regenerating the ZIP

After committing changes to any of the five app files, rebuild the ZIP from that commit
and commit it in a follow-up:

```bash
git archive --format=zip --prefix=menu-mediterraneo/ -o menu-mediterraneo.zip HEAD -- \
  app.js ayuda.html index.html recetas.js styles.css
```

Only those five files go in (not `CLAUDE.md`, not the ZIP itself).

## Code style

- **Everything is in Spanish**: UI text, identifiers (`generarMenu`, `estado`, `recetasValidas`),
  comments, CSS classes/custom properties (`--primario`, `.panel-cab`), and commit messages.
- JS: ES5-style `function` declarations and `function () {}` callbacks (no arrow functions),
  `const`/`let`, double quotes, semicolons, 2-space indent. DOM built with the local `crear()`
  helper and `$()` = `getElementById`; avoid `innerHTML` with dynamic content.
- Section banners: `/* ---- Título ---- */` blocks as in existing files.
- CSS: use the color tokens in `:root`, and give any new token a dark-mode value in the
  `prefers-color-scheme: dark` block. Keep print styles (`.solo-impresion`) working.
- Accessibility matters: labels on all inputs, `aria-live` status regions, keyboard navigation
  on the calendar (arrow keys), visible focus, sufficient contrast. Keep this standard.

## Domain rules (keep `ayuda.html` in sync if you change them)

- Recipes: `id` unique (`c…` = comida, `n…` = cena), `tipo` `"comida"|"cena"`, `tiempo` ≤ 30,
  `vegetariana`/`sinGluten` consistent with ingredients, `grupo` one of the keys of `GRUPOS`
  in `app.js`, `ingredientes` as `["Nombre", cantidadPorPersona]` with names existing in
  `INGREDIENTES`. Nutrition is computed, never hard-coded per recipe.
- Generator: no repeated dish within 7 days; same `grupo` not on adjacent days nor lunch+dinner
  same day; ≤4 meat dishes/week, ≤2 red; aim for ≥3 legumes and 3–4 fish/week. When recipes run
  short, rules relax in order (`NIVELES` in `app.js`): repetition → group balance → meat limits,
  and the user is notified.
- Nutrition values are approximate; the footer disclaimer must stay.

## Git

- Commit messages: Spanish, imperative, short summary line (e.g. "Añadir ZIP descargable del proyecto").

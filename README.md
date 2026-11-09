# Menú mediterráneo del mes

Aplicación web para generar menús mensuales de comidas y cenas mediterráneas sencillas (máximo 30 minutos), con información nutricional y lista de la compra. Está hecha solo con HTML, CSS y JavaScript, sin dependencias ni servidor.

## Cómo abrirla

Haz doble clic en `index.html` o arrástralo a cualquier navegador moderno (Chrome, Firefox, Edge o Safari). No hace falta instalar nada. Los datos se guardan en el `localStorage` de ese navegador.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Estilos, versión móvil e impresión |
| `recetas.js` | Datos: base de ingredientes (categoría y nutrientes) y recetas |
| `app.js` | Lógica: generación del menú, calendario, nutrición y lista de la compra |

## Cómo añadir una receta

1. Abre `recetas.js` y copia una receta del mismo tipo:

   ```js
   { id: "c65", nombre: "Mi receta", tipo: "comida", tiempo: 20, vegetariana: true, sinGluten: true, grupo: "legumbres",
     ingredientes: [["Garbanzos cocidos (bote)", 150], ["Tomate", 100], ["Aceite de oliva virgen extra", 10]] },
   ```

2. Rellena los campos:
   - `id`: identificador único. Usa `c…` para comidas y `n…` para cenas.
   - `tipo`: `"comida"` o `"cena"`.
   - `tiempo`: minutos de preparación (30 como máximo).
   - `grupo`: tipo de plato, para que no se repita en días seguidos. Puede ser `legumbres`, `pasta`, `arroz`, `cereales`, `verduras`, `cremas`, `ensalada`, `huevos`, `pescado`, `carne` o `pan`.
   - `ingredientes`: lista de pares `["Nombre", cantidad por persona]`. El nombre tiene que existir en `INGREDIENTES`. La unidad y la categoría se toman de ahí, y las calorías y los nutrientes se calculan automáticamente.
3. Si un ingrediente no existe, añádelo a `INGREDIENTES` con sus valores por cada 100 g o 100 ml:

   ```js
   "Calabacín": I(FV, "g", 17, 1.2, 3.1, 0.3, 1),   // kcal, proteínas, hidratos, grasas, fibra
   ```

   Si contiene gluten, añade `{ gluten: true }`. Si es carne o pescado, añade `{ animal: "pescado" | "blanca" | "roja" }`.
4. Marca `vegetariana` y `sinGluten` según los ingredientes. Si hay alguna incoherencia, la aplicación avisa en la consola del navegador (F12).

## Reglas del generador

- Solo se usan recetas que cumplen las dietas marcadas. Sin ninguna dieta marcada, se usan todas.
- El mismo plato no se repite en 7 días seguidos.
- El mismo tipo de plato no aparece en días contiguos ni en la comida y la cena del mismo día.
- Como máximo hay 4 platos de carne a la semana, de los cuales 2 como mucho de carne roja.
- Se prioriza llegar a 3 o más legumbres y unos 3 o 4 pescados por semana, más huevos y carne blanca con moderación.
- Si no hay suficientes recetas, las reglas se relajan en este orden: primero la repetición, luego el equilibrio de tipos de plato y por último el límite de carne. Cuando ocurre, la aplicación lo avisa.

Los valores nutricionales son orientativos.

# Laboratorio de programación lineal

Herramienta web interactiva para formular y resolver modelos de programación lineal. Presenta el procedimiento simplex, la construcción del dual, el método de dos fases, la interpretación de sensibilidad y la visualización gráfica de la región factible.

## Funcionalidades

- Selección entre maximizar y minimizar la función objetivo.
- Edición de coeficientes, variables y restricciones.
- Desarrollo del simplex con tableaux, pivotes y operaciones entre filas.
- Construcción y solución del modelo dual según el sentido del objetivo.
- Análisis de precios sombra y holgura complementaria.
- Gráfico de restricciones, región factible, óptimo y recta objetivo.
- Presentación de los cálculos en fracciones o decimales.
- Caso guía precargado.

## Modelos admitidos

La herramienta admite modelos lineales continuos con variables no negativas y lados derechos no negativos:

- **Maximización:** restricciones de tipo `≤`.
- **Minimización:** restricciones de tipo `≥`.

Permite hasta 12 variables de decisión. El método gráfico está disponible cuando el primal o el dual tiene dos variables.

## Uso

Abre `index.html` en un navegador moderno, ingresa los datos del modelo y selecciona **Resolver primal y dual**. No requiere instalación ni compilación. KaTeX se carga desde jsDelivr para componer las operaciones; si el CDN no está disponible, se muestran en texto plano.

## Estructura

- `index.html`: estructura de la aplicación.
- `styles.css`: estilos y diseño adaptable.
- `js/app.js`: formulario, validación y presentación de resultados.
- `js/simplex.js`: tableaux, pivotes, simplex, fases I y II, y formulación primal-dual.
- `js/graph.js`: restricciones, región factible y función objetivo en el plano.
- `js/number-format.js`: formato de fracciones y decimales.

## GitHub Pages

El repositorio puede publicarse como sitio estático desde **Settings → Pages**, usando la rama `main` y la carpeta raíz (`/`).

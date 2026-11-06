# Laboratorio de programación lineal

Aplicación educativa para construir y estudiar modelos de programación lineal. El desarrollo matemático está separado de la interfaz para que los procedimientos se puedan leer y modificar por partes.

## Empezar

No requiere Node, compilación ni paquetes externos:

1. Descarga o clona el repositorio.
2. Abre `index.html` en un navegador moderno.
3. Ingresa un modelo o carga **Caso guía**.
4. Pulsa **Resolver primal y dual** y explora las pestañas.

Cada tableau explica la variable entrante, la razón mínima, el pivote y las operaciones entre filas. Los resultados se pueden mostrar como fracciones o decimales.

## Estructura del proyecto

- `index.html`: estructura de la página y carga de los scripts.
- `styles.css`: diseño y comportamiento adaptable.
- `js/simplex.js`: forma estándar, tableaux, pivotes, simplex, fases I y II, construcción del primal y el dual.
- `js/graph.js`: líneas de restricciones, región factible y recta de la función objetivo.
- `js/number-format.js`: formato de fracciones y decimales.
- `js/app.js`: formulario, validación y explicaciones de los resultados.

Cada archivo tiene una responsabilidad concreta y comentarios junto a las operaciones matemáticas principales. Los scripts se cargan en orden desde `index.html`; no hay dependencias externas.

## Procedimientos incluidos

1. **Primal:** agrega holguras a restricciones de recursos `≤` y aplica la prueba de optimalidad y la razón mínima en cada pivote.
2. **Dual:** construye `min bᵀy`, sujeto a `Aᵀy ≥ c`, `y ≥ 0`.
3. **Dos fases:** agrega variables de exceso y artificiales cuando se requiere una base inicial para el dual; después retira artificiales y optimiza el objetivo original.
4. **Interpretación:** compara los óptimos primal y dual, calcula precios sombra, excesos duales y productos de holgura complementaria.
5. **Gráfico:** si el primal o el dual tiene dos variables, grafica restricciones, región factible, punto óptimo e isocurva de la función objetivo.

## Alcance

La herramienta está orientada a modelos lineales continuos de maximización con variables no negativas, restricciones de recursos tipo `≤` y lados derechos no negativos. Permite hasta 12 variables de decisión. El análisis presenta precios sombra en el óptimo; todavía no calcula los intervalos completos de sensibilidad.

Es una herramienta de estudio. Contrasta los resultados con el procedimiento de clase en modelos degenerados, casos especiales o decisiones importantes.

## Publicar en GitHub Pages

1. Publica `index.html`, `styles.css`, la carpeta `js/`, `README.md` y `.gitignore`.
2. En GitHub, abre **Settings → Pages**.
3. Selecciona **Deploy from a branch**, la rama que publicarás y la carpeta raíz (`/`).
4. Guarda y espera a que GitHub Pages genere la URL del sitio.

No requiere un paso de compilación. Los archivos estáticos pueden abrirse directamente o publicarse en un alojamiento estático.

## Seguridad y privacidad

- Los cálculos se ejecutan en el navegador. La aplicación no tiene backend, cuentas, almacenamiento persistente ni llamadas de red propias.
- Los coeficientes no se envían desde el código a un servicio externo. El proveedor de alojamiento puede aplicar sus propias políticas y registros de acceso.
- No publiques contraseñas, tokens, claves privadas, archivos `.env` ni datos personales.
- Los adjuntos locales de Codex están excluidos por `.gitignore`.
- Antes de publicar, revisa los archivos que Git incluiría con `git status --short`.


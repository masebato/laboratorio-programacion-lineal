/*
 * app.js
 * Conecta el formulario, los resultados de estudio y el solucionador.
 */
(function () {
  const Solver = window.LinearProgrammingSolver;
  const Graph = window.LinearProgrammingGraph;
  const NumberFormat = window.ModelNumberFormat;
  const byId = (id) => document.getElementById(id);

  let variableCount = 2;
  let constraintCount = 1;
  let lastSolution = null;
  let graphView = 'primal';

  const guideModel = {
    objective: [50, 40, 60, 30, 70],
    constraints: [
      { coefficients: [2, 1, 3, 1, 2], rhs: 120 },
      { coefficients: [1, 2, 1, 1, 3], rhs: 100 },
    ],
  };

  function makeNumberInput(value, className, accessibleName) {
    const input = document.createElement('input');
    input.className = `field ${className}`;
    input.type = 'number';
    input.step = 'any';
    input.value = value ?? '';
    input.setAttribute('aria-label', accessibleName);
    return input;
  }

  function readFormValues() {
    return {
      direction: byId('objective-direction').value,
      objective: [...byId('objective-variables').querySelectorAll('.objective-coefficient')]
        .map((input) => input.value.trim() === '' ? NaN : Number(input.value)),
      constraints: [...byId('constraint-rows').querySelectorAll('.constraint-data-row')].map((row) => ({
        coefficients: [...row.querySelectorAll('.constraint-coefficient')]
          .map((input) => input.value.trim() === '' ? NaN : Number(input.value)),
        rhs: row.querySelector('.constraint-rhs').value.trim() === ''
          ? NaN
          : Number(row.querySelector('.constraint-rhs').value),
      })),
    };
  }

  function renderForm(model = null) {
    if (model?.direction) byId('objective-direction').value = model.direction;
    const direction = byId('objective-direction').value;
    const objectiveContainer = byId('objective-variables');
    const constraintContainer = byId('constraint-rows');
    objectiveContainer.replaceChildren();
    constraintContainer.replaceChildren();

    const constraintHeader = document.createElement('div');
    constraintHeader.className = `constraint-row constraint-header-row${variableCount >= 5 ? ' many-variables' : ''}`;
    constraintHeader.style.setProperty('--variable-count', variableCount);
    for (let variable = 0; variable < variableCount; variable += 1) {
      const label = document.createElement('span');
      label.className = 'coefficient-column-label';
      label.textContent = `x${variable + 1}`;
      constraintHeader.append(label);
    }
    const relationLabel = document.createElement('span');
    relationLabel.className = 'relation-column-label';
    relationLabel.textContent = 'sentido';
    constraintHeader.append(relationLabel);
    const rhsLabel = document.createElement('span');
    rhsLabel.className = 'rhs-column-label';
    rhsLabel.textContent = 'límite';
    constraintHeader.append(rhsLabel);
    constraintHeader.append(document.createElement('span'));
    constraintContainer.append(constraintHeader);

    for (let variable = 0; variable < variableCount; variable += 1) {
      const variableRow = document.createElement('div');
      variableRow.className = 'objective-variable';

      const name = document.createElement('span');
      name.textContent = `x${variable + 1}`;
      variableRow.append(name);
      variableRow.append(makeNumberInput(
        model?.objective[variable],
        'objective-coefficient',
        `Coeficiente de x${variable + 1}`,
      ));

      const removeButton = document.createElement('button');
      removeButton.className = 'remove-button variable-remove';
      removeButton.type = 'button';
      removeButton.textContent = '×';
      removeButton.title = `Eliminar x${variable + 1}`;
      removeButton.setAttribute('aria-label', removeButton.title);
      removeButton.disabled = variableCount <= 1;
      removeButton.addEventListener('click', () => removeVariable(variable));
      variableRow.append(removeButton);
      objectiveContainer.append(variableRow);
    }

    for (let constraint = 0; constraint < constraintCount; constraint += 1) {
      const constraintRow = document.createElement('div');
      constraintRow.className = `constraint-row constraint-data-row${variableCount >= 5 ? ' many-variables' : ''}`;
      constraintRow.style.setProperty('--variable-count', variableCount);

      for (let variable = 0; variable < variableCount; variable += 1) {
        const value = model?.constraints[constraint]?.coefficients[variable];
        constraintRow.append(makeNumberInput(
          value,
          'constraint-coefficient',
          `Restricción ${constraint + 1}, coeficiente de x${variable + 1}`,
        ));
      }

      const relation = document.createElement('span');
      relation.className = 'relation-symbol';
      relation.textContent = relationSymbol(direction);
      relation.setAttribute('aria-label', direction === 'max' ? 'menor o igual que' : 'mayor o igual que');
      constraintRow.append(relation);
      constraintRow.append(makeNumberInput(
        model?.constraints[constraint]?.rhs,
        'constraint-rhs',
        `Disponibilidad de la restricción ${constraint + 1}`,
      ));

      const removeButton = document.createElement('button');
      removeButton.className = 'remove-button';
      removeButton.type = 'button';
      removeButton.textContent = '×';
      removeButton.title = `Eliminar restricción ${constraint + 1}`;
      removeButton.setAttribute('aria-label', removeButton.title);
      removeButton.disabled = constraintCount <= 1;
      removeButton.addEventListener('click', () => removeConstraint(constraint));
      constraintRow.append(removeButton);
      constraintContainer.append(constraintRow);
    }

    byId('input-hint').textContent = direction === 'max'
      ? 'Maximizar: restricciones de recursos ≤ y variables no negativas.'
      : 'Minimizar: restricciones de requerimientos ≥ y variables no negativas.';
  }

  function relationSymbol(direction) {
    return direction === 'max' ? '≤' : '≥';
  }

  function removeVariable(index) {
    if (variableCount <= 1) return;
    const model = readFormValues();
    model.objective.splice(index, 1);
    model.constraints.forEach((constraint) => constraint.coefficients.splice(index, 1));
    variableCount -= 1;
    renderForm(model);
  }

  function removeConstraint(index) {
    if (constraintCount <= 1) return;
    const model = readFormValues();
    model.constraints.splice(index, 1);
    constraintCount -= 1;
    renderForm(model);
  }

  function validateModel(model) {
    if (model.objective.some((value) => !Number.isFinite(value))) {
      return 'Completa cada coeficiente de la función objetivo con un número.';
    }
    if (model.constraints.some((constraint) =>
      !Number.isFinite(constraint.rhs) ||
      constraint.coefficients.some((value) => !Number.isFinite(value)))) {
      return 'Completa cada coeficiente y disponibilidad con un número.';
    }
    if (model.constraints.some((constraint) => constraint.rhs < 0)) {
      return 'En estas formas canónicas, el lado derecho de cada restricción debe ser no negativo.';
    }
    if (model.constraints.some((constraint) =>
      constraint.coefficients.every((value) => Math.abs(value) < 1e-12))) {
      return 'Cada restricción debe tener al menos un coeficiente distinto de cero.';
    }
    return '';
  }

  function formatLinearExpression(coefficients, variableName) {
    const terms = [];
    coefficients.forEach((coefficient, index) => {
      if (Math.abs(coefficient) < 1e-12) return;
      terms.push({
        sign: coefficient < 0 ? '−' : '+',
        value: `${NumberFormat.formatNumber(Math.abs(coefficient))}${variableName(index)}`,
      });
    });

    if (terms.length === 0) return '0';
    return terms.map((term, index) => {
      if (index === 0) return `${term.sign === '−' ? '−' : ''}${term.value}`;
      return ` ${term.sign} ${term.value}`;
    }).join('');
  }

  function renderTableau(tableau, basis, variableNames, objectiveLabel) {
    const rows = tableau.map((row, rowIndex) => {
      const label = rowIndex === tableau.length - 1
        ? objectiveLabel
        : variableNames[basis[rowIndex]];
      const cells = row.map((value) => `<td>${NumberFormat.formatNumber(value)}</td>`).join('');
      return `<tr><th scope="row">${label}</th>${cells}</tr>`;
    }).join('');
    const headings = variableNames.map((name) => `<th scope="col">${name}</th>`).join('');

    return `<div class="table-scroll"><table class="tableau"><thead><tr><th>Base</th>${headings}<th scope="col">Sol.</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderOperationEquation(expression, fallbackText) {
    if (window.katex?.renderToString) {
      try {
        const rendered = window.katex.renderToString(expression, {
          displayMode: true,
          throwOnError: false,
        });
        return `<div class="operation-equation">${rendered}</div>`;
      } catch (error) {
        // Keep the operation readable if the mathematical typesetting fails.
      }
    }
    return `<div class="operation-equation operation-equation-fallback">${fallbackText}</div>`;
  }

  function renderSimplexSteps(steps, variableNames, title, objectiveLabel) {
    if (!steps) return '';

    return steps.map((step, index) => {
      let pivotExplanation;
      if (step.enteringVariable === null) {
        const isPhaseOne = title.includes('Fase I');
        const auxiliaryValue = step.tableau.at(-1).at(-1);
        pivotExplanation = `
          <div class="pivot-explanation">
            <b>Criterio de parada.</b>
            No hay coeficientes negativos en la fila objetivo. No existe otra variable entrante que mejore el objetivo.
            ${isPhaseOne ? `El objetivo auxiliar final es ${NumberFormat.formatNumber(auxiliaryValue)}; al ser cero, existe una base factible para el problema original.` : ''}
          </div>`;
      } else {
        const pivotRow = step.leavingRow;
        const enteringColumn = step.enteringVariable;
        const pivotValue = step.tableau[pivotRow][enteringColumn];
        const rhsColumn = step.tableau[0].length - 1;
        const eligibleRatios = step.tableau.slice(0, -1)
          .map((row, rowIndex) => ({ row, rowIndex }))
          .filter(({ row }) => row[enteringColumn] > 1e-9)
          .map(({ row, rowIndex }) => ({
            name: variableNames[step.basis[rowIndex]],
            rowIndex,
            rhs: row[rhsColumn],
            coefficient: row[enteringColumn],
            ratio: row[rhsColumn] / row[enteringColumn],
          }));

        const ratioTable = `
          <div class="table-scroll"><table class="ratio-table">
            <thead><tr><th>Fila básica</th><th>bᵢ</th><th>aᵢⱼ</th><th>Razón bᵢ/aᵢⱼ</th></tr></thead>
            <tbody>${eligibleRatios.map((ratio) => `
              <tr><th scope="row">${ratio.name}</th>
                <td>${NumberFormat.formatNumber(ratio.rhs)}</td>
                <td>${NumberFormat.formatNumber(ratio.coefficient)}</td>
                <td>${NumberFormat.formatNumber(ratio.ratio)}${ratio.rowIndex === pivotRow ? ' ← sale' : ''}</td>
              </tr>`).join('')}</tbody>
          </table></div>`;

        const formatMathNumber = (value) => {
          const formatted = NumberFormat.formatNumber(value);
          const fraction = formatted.match(/^(-?\d+)\/(\d+)$/);
          return fraction ? `\\frac{${fraction[1]}}{${fraction[2]}}` : formatted;
        };
        const formatRowValues = (values) => `\\left[${values.map((value) => formatMathNumber(value)).join(',\\;')}\\right]`;
        const formatPlainRowValues = (values) => `[${values.map((value) => NumberFormat.formatNumber(value)).join(', ')}]`;
        const originalPivotRow = step.tableau[pivotRow];
        const normalizedPivotRow = originalPivotRow.map((value) => value / pivotValue);
        const normalizePivotMath = `R_{${pivotRow + 1}}^{\\text{nueva}} = ${formatRowValues(originalPivotRow)} \\div ${formatMathNumber(pivotValue)} = ${formatRowValues(normalizedPivotRow)}`;
        const normalizePivotFallback = `R${pivotRow + 1} nueva = ${formatPlainRowValues(originalPivotRow)} ÷ ${NumberFormat.formatNumber(pivotValue)} = ${formatPlainRowValues(normalizedPivotRow)}`;
        const normalizePivotRow = renderOperationEquation(normalizePivotMath, normalizePivotFallback);
        const rowOperations = step.tableau.map((row, rowIndex) => {
          if (rowIndex === pivotRow) return '';
          const isObjectiveRow = rowIndex === step.tableau.length - 1;
          const rowName = isObjectiveRow
            ? `\\mathrm{${objectiveLabel.replace('−', '-')}}`
            : `R_{${rowIndex + 1}}`;
          const plainRowName = isObjectiveRow ? objectiveLabel : `R${rowIndex + 1}`;
          const factor = row[enteringColumn];
          const updatedRow = row.map((value, column) => value - factor * normalizedPivotRow[column]);
          const math = `${rowName}^{\\text{nueva}} &= ${formatRowValues(row)} - (${formatMathNumber(factor)}) \\times ${formatRowValues(normalizedPivotRow)} = ${formatRowValues(updatedRow)}`;
          const fallback = `${plainRowName} nueva = ${formatPlainRowValues(row)} − (${NumberFormat.formatNumber(factor)}) × ${formatPlainRowValues(normalizedPivotRow)} = ${formatPlainRowValues(updatedRow)}`;
          return { math, fallback };
        }).filter(Boolean);
        const rowOperationsMath = `\\begin{aligned}${rowOperations.map((operation) => operation.math).join(' \\\\ ')}\\end{aligned}`;
        const rowOperationsFallback = rowOperations.map((operation) => operation.fallback).join(' · ');
        const rowOperationsMarkup = renderOperationEquation(rowOperationsMath, rowOperationsFallback);

        pivotExplanation = `
          <div class="pivot-explanation">
            <b>1. Variable entrante.</b>
            Entra ${variableNames[enteringColumn]}, porque tiene el coeficiente más negativo en la fila objetivo:
            ${NumberFormat.formatNumber(step.tableau.at(-1)[enteringColumn])}.
            Aumentar esta variable mejora el objetivo transformado.
            <br><b>2. Variable saliente.</b>
            Para conservar la factibilidad, se compara bᵢ/aᵢⱼ solo donde aᵢⱼ &gt; 0. La menor razón no negativa indica la fila que sale.
            ${ratioTable}
            <b>3. Pivote.</b>
            El pivote es ${NumberFormat.formatNumber(pivotValue)}, en la intersección de ${variableNames[enteringColumn]} y ${step.leavingVariable}.
            <br><b>4. Convertimos el pivote en 1.</b> Dividimos toda la fila pivote entre ${NumberFormat.formatNumber(pivotValue)}:
            ${normalizePivotRow}
            <b>5. Hacemos cero el resto de la columna.</b> Usamos la fila pivote ya normalizada, primero en las filas de arriba y abajo y también en la fila objetivo:
            ${rowOperationsMarkup}
          </div>`;
      }

      const pivotLabel = step.enteringVariable === null
        ? 'tableau final'
        : `entra ${variableNames[step.enteringVariable]}, sale ${step.leavingVariable}`;
      const open = index === 0 || index === steps.length - 1 ? 'open' : '';
      const beforeTableau = `
        <div class="tableau-stage">
          <h4>${step.enteringVariable === null ? 'Tableau actual' : 'Tableau antes de la operación'}</h4>
          ${renderTableau(step.tableau, step.basis, variableNames, objectiveLabel)}
        </div>`;
      const afterStep = steps[index + 1];
      const afterTableau = step.enteringVariable === null || !afterStep ? '' : `
        <div class="tableau-stage">
          <h4>Tableau después de la operación</h4>
          ${renderTableau(afterStep.tableau, afterStep.basis, variableNames, objectiveLabel)}
        </div>`;

      return `
        <details class="iteration" ${open}>
          <summary>${title} · iteración ${index} · ${pivotLabel}</summary>
          ${beforeTableau}
          ${pivotExplanation}
          ${afterTableau}
        </details>`;
    }).join('');
  }

  function renderReducedCostGuide(isMaximization) {
    return `
      <section class="study-card">
        <h4>¿Por qué algunos coeficientes salen negativos?</h4>
        <p>Ejemplo: si quieres maximizar Z = 5x₁ + 3x₂, el tableau pasa todo al lado izquierdo para dejar la ecuación igualada a cero:</p>
        <div class="math-line">Z − 5x₁ − 3x₂ = 0</div>
        <p>Por eso ves −5 y −3: son los coeficientes originales con el signo cambiado. En el simplex, un número negativo en esa fila indica que esa variable todavía puede ayudar a mejorar el objetivo; se elige el más negativo para entrar. Cuando ya no quedan negativos, se llega al óptimo.</p>
        ${isMaximization
          ? '<p>Si un coeficiente original ya era negativo, al cambiarle el signo aparecerá positivo en la fila.</p>'
          : '<p>Como el modelo minimiza, primero se transforma en maximizar −Z. Por eso los signos de la fila se interpretan respecto a −Z.</p>'}
        <p>La Fase I usa la misma idea con su objetivo auxiliar.</p>
      </section>`;
  }

  function renderPrimalPanel(model) {
    const isMaximization = model.direction === 'max';
    const objective = formatLinearExpression(model.objective, (index) => `x${index + 1}`);
    const relation = relationSymbol(model.direction);
    const constraintLines = model.constraints.map((constraint, index) => `
      <div class="math-line">R${index + 1}: ${formatLinearExpression(constraint.coefficients, (variable) => `x${variable + 1}`)} ${relation} ${NumberFormat.formatNumber(constraint.rhs)}</div>`).join('');
    const slackEquations = model.constraints.map((constraint, index) => `
      <div class="math-line">R${index + 1}: ${formatLinearExpression(constraint.coefficients, (variable) => `x${variable + 1}`)} ${isMaximization ? '+' : '−'} ${isMaximization ? 's' : 'e'}${index + 1}${isMaximization ? '' : ` + r${index + 1}`} = ${NumberFormat.formatNumber(constraint.rhs)}</div>`).join('');
    const simplex = model.primal.simplex;
    const variableNames = simplex.phaseTwoNames;
    const phaseOneSteps = simplex.phaseOne
      ? renderSimplexSteps(simplex.phaseOne.steps, simplex.phaseOneNames, 'Fase I', 'V')
      : '';
    const phaseOneGuide = simplex.phaseOne
      ? (isMaximization
        ? '<p>Al normalizar una restricción, se requiere una artificial para iniciar la base. La Fase I busca llevarla a cero.</p>'
        : '<p>Las restricciones ≥ agregan variables de exceso y artificiales. La Fase I busca llevar las artificiales a cero.</p>')
      : '<p>Las holguras forman una base inicial factible; no se necesita Fase I.</p>';
    const transformedObjective = isMaximization ? 'Z' : '−Z';
    const phaseTwoTitle = isMaximization ? 'Primal · simplex' : 'Primal · maximizar −Z';

    byId('primal-panel').innerHTML = `
      <h3 class="section-title">2. Resolución del primal · simplex</h3>
      <section class="study-card">
        <h4>Paso 1 · Formula el problema</h4>
        <div class="math-line">${isMaximization ? 'Maximizar' : 'Minimizar'} Z = ${objective}</div>
        ${constraintLines}
        <div class="math-line">xⱼ ≥ 0 para cada actividad j.</div>
        <ol>
          <li>Las variables x representan cantidades de decisión.</li>
          <li>La función objetivo suma el aporte de cada actividad.</li>
          <li>${isMaximization ? 'Cada restricción limita el uso máximo disponible de un recurso.' : 'Cada restricción establece un requerimiento mínimo que debe cubrirse.'}</li>
        </ol>
      </section>
      <section class="study-card">
        <h4>Paso 2 · Pasa a forma estándar</h4>
        <p>${isMaximization ? 'Se agrega una holgura sᵢ ≥ 0 a cada restricción ≤:' : 'Se resta una variable de exceso eᵢ ≥ 0 en cada restricción ≥:'}</p>
        ${slackEquations}
        ${phaseOneGuide}
        <p>Las variables de decisión comienzan en cero.</p>
      </section>
      ${renderReducedCostGuide(isMaximization)}
      ${phaseOneSteps}
      <p class="procedure-hint"><b>Regla simplex:</b> se optimiza ${transformedObjective}. Entra la variable con costo reducido más negativo; sale la variable básica asociada a la menor razón positiva.</p>
      ${renderSimplexSteps(simplex.steps, variableNames, phaseTwoTitle, transformedObjective)}
      <div class="result-metrics">
        <div class="metric"><small>Variables de decisión</small><strong>${model.primal.variables.map((value, index) => `x${index + 1} = ${NumberFormat.formatNumber(value)}`).join(' · ')}</strong></div>
        <div class="metric"><small>${isMaximization ? 'Valor máximo' : 'Valor mínimo'}</small><strong>${NumberFormat.formatNumber(model.primal.objectiveValue)}</strong><small>unidades del objetivo</small></div>
      </div>
      <div class="note">En cada iteración, las variables de la columna «Base» son básicas; las demás valen cero. La columna «Sol.» muestra sus valores.</div>`;
  }

  function renderDualPanel(model) {
    const isMaximization = model.direction === 'max';
    const dualDirection = isMaximization ? 'Minimizar' : 'Maximizar';
    const dualRelation = isMaximization ? '≥' : '≤';
    const objectiveLabel = isMaximization ? '−W' : 'W';
    const dualObjective = formatLinearExpression(
      model.constraints.map((constraint) => constraint.rhs),
      (index) => `y${index + 1}`,
    );
    const dualConstraints = model.objective.map((coefficient, variable) => {
      const dualCoefficients = model.constraints.map((constraint) => constraint.coefficients[variable]);
      return `<div class="math-line">${formatLinearExpression(dualCoefficients, (index) => `y${index + 1}`)} ${dualRelation} ${NumberFormat.formatNumber(coefficient)}</div>`;
    }).join('');
    const simplex = model.dual.simplex;
    const variableNames = simplex.phaseTwoNames;
    const phaseOneSteps = simplex.phaseOne
      ? renderSimplexSteps(simplex.phaseOne.steps, simplex.phaseOneNames, 'Fase I del dual', 'V')
      : '';
    const phaseOneGuide = simplex.phaseOne
      ? '<p>Las variables artificiales se minimizan mediante V = −Σrᵢ. Si V* = 0, se encontró una base factible y se retiran las artificiales.</p>'
      : '<p>La base de holguras ya es factible; en este caso no se necesita Fase I.</p>';

    byId('dual-panel').innerHTML = `
      <h3 class="section-title">3. Formulación y resolución del dual</h3>
      <section class="study-card">
        <h4>Paso 1 · Construye el dual</h4>
        <p>Se asigna una variable yᵢ ≥ 0 a cada restricción del primal. Cada variable xⱼ genera una restricción dual.</p>
        <div class="math-line">${dualDirection} W = ${dualObjective}</div>
        ${dualConstraints}
        <p>${isMaximization
          ? 'En un primal de maximización con restricciones ≤, el dual es una minimización con restricciones ≥.'
          : 'En un primal de minimización con restricciones ≥, el dual es una maximización con restricciones ≤.'}</p>
      </section>
      <section class="study-card">
        <h4>${simplex.phaseOne ? 'Paso 2 · Fase I: base factible' : 'Paso 2 · Base inicial'}</h4>
        <p>Las restricciones duales determinan si se puede empezar con holguras o si se necesita una base artificial.</p>
        ${phaseOneGuide}
      </section>
      ${phaseOneSteps}
      <section class="study-card">
        <h4>${simplex.phaseOne ? 'Paso 3 · Fase II: optimiza el dual' : 'Paso 3 · Optimiza el dual'}</h4>
        <p>${isMaximization
          ? 'El tableau maximiza −W, equivalente a minimizar W. Se detiene cuando no quedan costos reducidos negativos.'
          : 'El tableau maximiza W directamente. Se detiene cuando no quedan costos reducidos negativos.'}</p>
        <p>En el dual se usa la misma regla: el tableau cambia los signos del objetivo que está maximizando (${isMaximization ? '−W' : 'W'}). Un valor negativo en su fila indica una mejora posible para ese objetivo.</p>
      </section>
      ${renderSimplexSteps(simplex.steps, variableNames, simplex.phaseOne ? 'Fase II del dual' : 'Simplex dual', objectiveLabel)}
      <div class="result-metrics">
        <div class="metric"><small>Precios sombra</small><strong>${model.dual.variables.map((value, index) => `y${index + 1} = ${NumberFormat.formatNumber(value)}`).join(' · ')}</strong></div>
        <div class="metric"><small>${isMaximization ? 'Valor dual mínimo' : 'Valor dual máximo'}</small><strong>${NumberFormat.formatNumber(model.dual.objectiveValue)}</strong><small>unidades del objetivo</small></div>
        <div class="metric"><small>Brecha primal − dual</small><strong>${NumberFormat.formatNumber(model.primal.objectiveValue - model.dual.objectiveValue)}</strong></div>
      </div>
      <div class="note">La dualidad fuerte afirma que los óptimos primal y dual tienen el mismo valor.</div>`;
  }

  function renderSensitivityPanel(model) {
    const activityRows = model.objective.map((coefficient, index) => {
      const value = model.primal.variables[index];
      const dualSlack = model.dual.slacks[index];
      const product = value * dualSlack;
      return `<tr><th scope="row">x${index + 1}</th><td>${NumberFormat.formatNumber(value)}</td><td>${NumberFormat.formatNumber(dualSlack)}</td><td>${NumberFormat.formatNumber(product)} ${Math.abs(product) < 1e-6 ? '✓' : ''}</td></tr>`;
    }).join('');

    const resourceRows = model.constraints.map((constraint, index) => {
      const used = constraint.coefficients.reduce((sum, coefficient, variable) =>
        sum + coefficient * model.primal.variables[variable], 0);
      const slack = model.primal.slacks[index];
      const price = model.dual.variables[index];
      const product = slack * price;
      return `<tr><th scope="row">R${index + 1}</th>
        <td>${NumberFormat.formatNumber(constraint.rhs)}</td>
        <td>${NumberFormat.formatNumber(used)}</td>
        <td>${NumberFormat.formatNumber(slack)}</td>
        <td>${NumberFormat.formatNumber(price)}</td>
        <td>${NumberFormat.formatNumber(product)} ${Math.abs(product) < 1e-6 ? '✓' : ''}</td></tr>`;
    }).join('');

    byId('sensitivity-panel').innerHTML = `
      <h3 class="section-title">4. Sensibilidad y holgura complementaria</h3>
      <div class="result-metrics">
        ${model.dual.variables.map((value, index) => `
          <div class="metric"><small>Precio sombra y${index + 1}</small>
            <strong>${NumberFormat.formatNumber(value)}</strong><small>por unidad del recurso ${index + 1}</small></div>`).join('')}
        <div class="metric"><small>Objetivos en el óptimo</small>
          <strong>${NumberFormat.formatNumber(model.primal.objectiveValue)} = ${NumberFormat.formatNumber(model.dual.objectiveValue)}</strong></div>
      </div>
      <section class="study-card">
        <h4>Complementariedad por actividad</h4>
        <p>La holgura dual es ${model.direction === 'max' ? 'Aᵀy − c' : 'c − Aᵀy'}. Para cada actividad debe cumplirse xⱼ · holguraDualⱼ = 0.</p>
        <div class="table-scroll"><table><thead><tr><th>Actividad</th><th>xⱼ</th><th>Holgura dual</th><th>Producto complementario</th></tr></thead><tbody>${activityRows}</tbody></table></div>
      </section>
      <section class="study-card">
        <h4>Complementariedad por recurso</h4>
        <p>La holgura es ${model.direction === 'max' ? 'capacidad disponible menos capacidad usada' : 'capacidad usada menos el requerimiento mínimo'}. Para cada recurso debe cumplirse yᵢ · holguraᵢ = 0.</p>
        <div class="table-scroll"><table><thead><tr><th>Recurso</th><th>${model.direction === 'max' ? 'Máximo disponible' : 'Mínimo requerido'}</th><th>Usado</th><th>Holgura</th><th>Precio sombra</th><th>Producto complementario</th></tr></thead><tbody>${resourceRows}</tbody></table></div>
      </section>
      <section class="study-card">
        <h4>Cómo interpretar el precio sombra</h4>
        <p>${model.direction === 'max'
          ? 'yᵢ estima cuánto aumentaría el beneficio óptimo al agregar una unidad de disponibilidad del recurso i.'
          : 'yᵢ estima cuánto aumentaría el costo mínimo al elevar en una unidad el requerimiento del recurso i.'} La interpretación es marginal y supone que la base óptima se mantiene.</p>
        <p>Una holgura positiva implica precio sombra cero. Un precio sombra positivo implica que la restricción del recurso es vinculante.</p>
      </section>
      <div class="note">Los precios sombra describen el entorno de la solución actual. Esta versión no calcula los intervalos completos de sensibilidad.</div>`;
  }

  function renderResult(model) {
    lastSolution = model;
    const optimumLabel = model.direction === 'max' ? 'Máximo Z' : 'Mínimo Z';
    byId('objective-result').textContent = `${optimumLabel} = ${NumberFormat.formatNumber(model.primal.objectiveValue)}`;
    byId('variable-result').textContent = model.primal.variables
      .map((value, index) => `x${index + 1} = ${NumberFormat.formatNumber(value)}`).join(' · ');

    renderPrimalPanel(model);
    renderDualPanel(model);
    renderSensitivityPanel(model);
    renderGraphPanel(model);
  }

  function renderGraphPanel(model) {
    byId('graph-panel').innerHTML = Graph.renderGraph(model, graphView, NumberFormat.formatNumber);
    const selector = byId('graph-model');
    if (!selector) return;
    graphView = selector.value;
    selector.addEventListener('change', () => {
      graphView = selector.value;
      renderGraphPanel(model);
    });
  }

  function solveCurrentModel() {
    const model = readFormValues();
    const validationMessage = validateModel(model);
    byId('model-error').innerHTML = validationMessage
      ? `<div class="error-message" role="alert">${validationMessage}</div>`
      : '';
    if (validationMessage) return;

    const result = Solver.solveLinearProgram(model.objective, model.constraints, model.direction);
    if (result.status !== 'optimal') {
      byId('model-error').innerHTML = `<div class="error-message" role="alert">${describeSolverStatus(result.status)}</div>`;
      return;
    }

    renderResult(result);
  }

  function clearResults() {
    lastSolution = null;
    byId('objective-result').textContent = 'Ingresa un modelo';
    byId('variable-result').textContent = '';
    byId('model-error').replaceChildren();
    const emptyPanel = '<div class="empty"><div><i>⌁</i>Completa los datos del modelo y selecciona «Resolver primal y dual» para ver el procedimiento paso a paso.</div></div>';
    ['primal-panel', 'dual-panel', 'graph-panel', 'sensitivity-panel']
      .forEach((id) => { byId(id).innerHTML = emptyPanel; });
    selectPanel('primal-panel');
  }

  function describeSolverStatus(status) {
    const messages = {
      infeasible: 'El modelo no tiene una solución factible.',
      unbounded: 'El modelo es no acotado: el objetivo puede mejorar sin límite.',
      'iteration-limit': 'El método alcanzó el límite de iteraciones.',
    };
    return messages[status] || `El solucionador terminó con estado: ${status}.`;
  }

  function selectPanel(panelName) {
    document.querySelectorAll('.tab-button').forEach((button) => {
      const isSelected = button.dataset.panel === panelName;
      button.classList.toggle('active', isSelected);
      button.setAttribute('aria-selected', String(isSelected));
    });
    document.querySelectorAll('.result-panel').forEach((panel) => {
      panel.hidden = panel.id !== panelName;
    });
  }

  function loadGuideModel() {
    byId('objective-direction').value = 'max';
    variableCount = guideModel.objective.length;
    constraintCount = guideModel.constraints.length;
    renderForm(guideModel);
    solveCurrentModel();
  }

  function clearModel() {
    byId('objective-direction').value = 'max';
    variableCount = 2;
    constraintCount = 1;
    renderForm({ objective: [], constraints: [] });
    clearResults();
  }

  function addVariable() {
    if (variableCount >= 12) return;
    const model = readFormValues();
    model.objective.push(null);
    model.constraints.forEach((constraint) => constraint.coefficients.push(null));
    variableCount += 1;
    renderForm(model);
  }

  function addConstraint() {
    const model = readFormValues();
    model.constraints.push({ coefficients: Array(variableCount).fill(null), rhs: null });
    constraintCount += 1;
    renderForm(model);
  }

  function connectControls() {
    byId('objective-direction').addEventListener('change', () => {
      const model = readFormValues();
      renderForm(model);
      clearResults();
    });
    byId('solve-model').addEventListener('click', solveCurrentModel);
    byId('load-guide').addEventListener('click', loadGuideModel);
    byId('add-variable').addEventListener('click', addVariable);
    byId('add-constraint').addEventListener('click', addConstraint);
    byId('clear-model').addEventListener('click', clearModel);
    byId('number-format').addEventListener('change', () => {
      if (lastSolution) renderResult(lastSolution);
    });

    document.querySelectorAll('.tab-button').forEach((button) => {
      button.addEventListener('click', () => selectPanel(button.dataset.panel));
    });
  }

  function startApplication() {
    renderForm();
    connectControls();
    clearResults();
  }

  startApplication();
})();

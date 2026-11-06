/*
 * app.js
 * Conecta el formulario, los resultados de estudio y el solucionador.
 */
(function () {
  const Solver = window.LinearProgrammingSolver;
  const Graph = window.LinearProgrammingGraph;
  const NumberFormat = window.ModelNumberFormat;
  const byId = (id) => document.getElementById(id);

  let variableCount = 5;
  let constraintCount = 2;
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
    input.value = value;
    input.setAttribute('aria-label', accessibleName);
    return input;
  }

  function readFormValues() {
    return {
      objective: [...byId('objective-variables').querySelectorAll('.objective-coefficient')]
        .map((input) => Number(input.value)),
      constraints: [...byId('constraint-rows').children].map((row) => ({
        coefficients: [...row.querySelectorAll('.constraint-coefficient')]
          .map((input) => Number(input.value)),
        rhs: Number(row.querySelector('.constraint-rhs').value),
      })),
    };
  }

  function renderForm(model = null) {
    const objectiveContainer = byId('objective-variables');
    const constraintContainer = byId('constraint-rows');
    objectiveContainer.replaceChildren();
    constraintContainer.replaceChildren();

    for (let variable = 0; variable < variableCount; variable += 1) {
      const variableRow = document.createElement('div');
      variableRow.className = 'objective-variable';

      const name = document.createElement('span');
      name.textContent = `x${variable + 1}`;
      variableRow.append(name);
      variableRow.append(makeNumberInput(
        model?.objective[variable] ?? guideModel.objective[variable] ?? 0,
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
      constraintRow.className = `constraint-row${variableCount >= 5 ? ' many-variables' : ''}`;
      constraintRow.style.setProperty('--variable-count', variableCount);

      for (let variable = 0; variable < variableCount; variable += 1) {
        const defaultCoefficient = guideModel.constraints[constraint]?.coefficients[variable] ?? 0;
        const value = model?.constraints[constraint]?.coefficients[variable] ?? defaultCoefficient;
        constraintRow.append(makeNumberInput(
          value,
          'constraint-coefficient',
          `Restricción ${constraint + 1}, coeficiente de x${variable + 1}`,
        ));
      }

      const relation = document.createElement('span');
      relation.className = 'relation-symbol';
      relation.textContent = '≤';
      relation.setAttribute('aria-label', 'menor o igual que');
      constraintRow.append(relation);
      constraintRow.append(makeNumberInput(
        model?.constraints[constraint]?.rhs ?? guideModel.constraints[constraint]?.rhs ?? 0,
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
      return 'Las disponibilidades del primal deben ser no negativas.';
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

        const rowOperations = step.tableau.map((row, rowIndex) => {
          const rowName = rowIndex === step.tableau.length - 1 ? objectiveLabel : `R${rowIndex + 1}`;
          if (rowIndex === pivotRow) {
            return `<div class="math-line">R${rowIndex + 1} nueva = R${rowIndex + 1} anterior ÷ ${NumberFormat.formatNumber(pivotValue)}</div>`;
          }
          return `<div class="math-line">${rowName} nueva = ${rowName} anterior − (${NumberFormat.formatNumber(row[enteringColumn])}) × R${pivotRow + 1} nueva</div>`;
        }).join('');

        pivotExplanation = `
          <div class="pivot-explanation">
            <b>1. Variable entrante.</b>
            Entra ${variableNames[enteringColumn]}, porque tiene el coeficiente más negativo en la fila objetivo:
            ${NumberFormat.formatNumber(step.tableau.at(-1)[enteringColumn])}.
            Aumentar esta variable mejora el objetivo transformado.
            <br><b>2. Variable saliente.</b>
            Para conservar la factibilidad, se compara bᵢ/aᵢⱼ solo donde aᵢⱼ &gt; 0. La menor razón no negativa indica la fila que sale.
            ${ratioTable}
            <b>3. Pivote y operaciones.</b>
            El pivote es ${NumberFormat.formatNumber(pivotValue)}, en la intersección de ${variableNames[enteringColumn]} y ${step.leavingVariable}.
            Cada paso normaliza la fila pivote y elimina esa columna de las demás filas:
            ${rowOperations}
          </div>`;
      }

      const pivotLabel = step.enteringVariable === null
        ? 'tableau final'
        : `entra ${variableNames[step.enteringVariable]}, sale ${step.leavingVariable}`;
      const open = index === 0 || index === steps.length - 1 ? 'open' : '';

      return `
        <details class="iteration" ${open}>
          <summary>${title} · iteración ${index} · ${pivotLabel}</summary>
          ${pivotExplanation}
          ${renderTableau(step.tableau, step.basis, variableNames, objectiveLabel)}
        </details>`;
    }).join('');
  }

  function renderPrimalPanel(model) {
    const objective = formatLinearExpression(model.objective, (index) => `x${index + 1}`);
    const constraintLines = model.constraints.map((constraint, index) => `
      <div class="math-line">R${index + 1}: ${formatLinearExpression(constraint.coefficients, (variable) => `x${variable + 1}`)} ≤ ${NumberFormat.formatNumber(constraint.rhs)}</div>`).join('');
    const slackEquations = model.constraints.map((constraint, index) => `
      <div class="math-line">R${index + 1}: ${formatLinearExpression(constraint.coefficients, (variable) => `x${variable + 1}`)} + s${index + 1} = ${NumberFormat.formatNumber(constraint.rhs)}</div>`).join('');
    const simplex = model.primal.simplex;
    const variableNames = simplex.phaseTwoNames;

    byId('primal-panel').innerHTML = `
      <h3 class="section-title">2. Resolución del primal · simplex</h3>
      <section class="study-card">
        <h4>Paso 1 · Formula el problema</h4>
        <div class="math-line">Maximizar Z = ${objective}</div>
        ${constraintLines}
        <div class="math-line">xⱼ ≥ 0 para cada actividad j.</div>
        <ol>
          <li>Las variables x representan cantidades de decisión.</li>
          <li>La función objetivo suma el aporte de cada actividad.</li>
          <li>Cada restricción limita el consumo de un recurso.</li>
        </ol>
      </section>
      <section class="study-card">
        <h4>Paso 2 · Pasa a forma estándar</h4>
        <p>Se agrega una holgura sᵢ ≥ 0 a cada restricción de tipo ≤:</p>
        ${slackEquations}
        <p>Las holguras forman la base inicial; las variables de decisión comienzan en cero.</p>
      </section>
      <p class="procedure-hint"><b>Regla simplex:</b> entra la variable con costo reducido más negativo. Sale la variable básica asociada a la menor razón positiva.</p>
      ${renderSimplexSteps(simplex.steps, variableNames, 'Primal', 'Z')}
      <div class="result-metrics">
        <div class="metric"><small>Variables de decisión</small><strong>${model.primal.variables.map((value, index) => `x${index + 1} = ${NumberFormat.formatNumber(value)}`).join(' · ')}</strong></div>
        <div class="metric"><small>Beneficio máximo</small><strong>${NumberFormat.formatNumber(model.primal.objectiveValue)}</strong><small>unidades del objetivo</small></div>
      </div>
      <div class="note">En cada iteración, las variables de la columna «Base» son básicas; las demás valen cero. La columna «Sol.» muestra sus valores.</div>`;
  }

  function renderDualPanel(model) {
    const objective = formatLinearExpression(
      model.constraints.map((constraint) => constraint.rhs),
      (index) => `y${index + 1}`,
    );
    const dualConstraints = model.objective.map((coefficient, variable) => {
      const dualCoefficients = model.constraints.map((constraint) => constraint.coefficients[variable]);
      return `<div class="math-line">${formatLinearExpression(dualCoefficients, (index) => `y${index + 1}`)} ≥ ${NumberFormat.formatNumber(coefficient)}</div>`;
    }).join('');
    const simplex = model.dual.simplex;
    const variableNames = simplex.phaseTwoNames;
    const phaseOneSteps = simplex.phaseOne
      ? renderSimplexSteps(simplex.phaseOne.steps, simplex.phaseOneNames, 'Fase I', 'V')
      : '';

    byId('dual-panel').innerHTML = `
      <h3 class="section-title">3. Formulación y resolución del dual</h3>
      <section class="study-card">
        <h4>Paso 1 · Construye el dual</h4>
        <p>Se asigna una variable yᵢ ≥ 0 a cada recurso. Cada actividad del primal genera una restricción dual.</p>
        <div class="math-line">Minimizar W = ${objective}</div>
        ${dualConstraints}
        <p>Los precios y valoran marginalmente los recursos. El objetivo dual es el valor total imputado a la capacidad disponible.</p>
      </section>
      <section class="study-card">
        <h4>Paso 2 · Fase I: encuentra una base factible</h4>
        <p>Las restricciones ≥ incorporan variables de exceso y artificiales. La función auxiliar V = −Σrᵢ busca llevar todas las artificiales a cero.</p>
        <p>Si el óptimo auxiliar vale cero, existe una solución factible del dual y se pueden retirar las columnas artificiales.</p>
      </section>
      ${phaseOneSteps}
      <section class="study-card">
        <h4>Paso 3 · Fase II: optimiza el dual</h4>
        <p>El tableau maximiza −W, equivalente a minimizar W. Se continúa pivotando hasta que la fila objetivo no tenga coeficientes negativos.</p>
      </section>
      ${renderSimplexSteps(simplex.steps, variableNames, 'Fase II', '−W')}
      <div class="result-metrics">
        <div class="metric"><small>Precios sombra</small><strong>${model.dual.variables.map((value, index) => `y${index + 1} = ${NumberFormat.formatNumber(value)}`).join(' · ')}</strong></div>
        <div class="metric"><small>Valor dual mínimo</small><strong>${NumberFormat.formatNumber(model.dual.objectiveValue)}</strong><small>unidades del objetivo</small></div>
        <div class="metric"><small>Brecha primal − dual</small><strong>${NumberFormat.formatNumber(model.dual.objectiveValue - model.primal.objectiveValue)}</strong></div>
      </div>
      <div class="note">La dualidad fuerte afirma que Z* = W*. La igualdad de ambos valores certifica que las soluciones primal y dual son óptimas.</div>`;
  }

  function renderSensitivityPanel(model) {
    const activityRows = model.objective.map((coefficient, index) => {
      const value = model.primal.variables[index];
      const excess = model.dual.excesses[index];
      const product = value * excess;
      return `<tr><th scope="row">x${index + 1}</th><td>${NumberFormat.formatNumber(value)}</td><td>${NumberFormat.formatNumber(excess)}</td><td>${NumberFormat.formatNumber(product)} ${Math.abs(product) < 1e-6 ? '✓' : ''}</td></tr>`;
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
        <p>El exceso dual es Aᵀy − c. Para cada actividad debe cumplirse xⱼ(Aᵀy − cⱼ) = 0.</p>
        <div class="table-scroll"><table><thead><tr><th>Actividad</th><th>xⱼ</th><th>Exceso dual</th><th>Producto complementario</th></tr></thead><tbody>${activityRows}</tbody></table></div>
      </section>
      <section class="study-card">
        <h4>Complementariedad por recurso</h4>
        <p>La holgura es capacidad disponible menos capacidad usada. Para cada recurso debe cumplirse yᵢ · holguraᵢ = 0.</p>
        <div class="table-scroll"><table><thead><tr><th>Recurso</th><th>Disponible</th><th>Usado</th><th>Holgura</th><th>Precio sombra</th><th>Producto complementario</th></tr></thead><tbody>${resourceRows}</tbody></table></div>
      </section>
      <section class="study-card">
        <h4>Cómo interpretar el precio sombra</h4>
        <p>yᵢ estima cuánto aumentaría el valor óptimo si se agregara una unidad del recurso i, siempre que el cambio sea pequeño y la base óptima se mantenga.</p>
        <p>Una holgura positiva implica precio sombra cero. Un precio sombra positivo implica que el recurso se usa por completo.</p>
      </section>
      <div class="note">Los precios sombra describen el entorno de la solución actual. Esta versión no calcula los intervalos completos de sensibilidad.</div>`;
  }

  function renderResult(model) {
    lastSolution = model;
    byId('objective-result').textContent = `Z* = ${NumberFormat.formatNumber(model.primal.objectiveValue)}`;
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

    const result = Solver.solveLinearProgram(model.objective, model.constraints);
    if (result.status !== 'optimal') {
      byId('model-error').innerHTML = `<div class="error-message" role="alert">${describeSolverStatus(result.status)}</div>`;
      return;
    }

    renderResult(result);
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
    variableCount = guideModel.objective.length;
    constraintCount = guideModel.constraints.length;
    renderForm(guideModel);
    solveCurrentModel();
  }

  function addVariable() {
    if (variableCount >= 12) return;
    const model = readFormValues();
    model.objective.push(0);
    model.constraints.forEach((constraint) => constraint.coefficients.push(0));
    variableCount += 1;
    renderForm(model);
  }

  function addConstraint() {
    const model = readFormValues();
    model.constraints.push({ coefficients: Array(variableCount).fill(0), rhs: 0 });
    constraintCount += 1;
    renderForm(model);
  }

  function connectControls() {
    byId('solve-model').addEventListener('click', solveCurrentModel);
    byId('load-guide').addEventListener('click', loadGuideModel);
    byId('add-variable').addEventListener('click', addVariable);
    byId('add-constraint').addEventListener('click', addConstraint);
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
    solveCurrentModel();
  }

  startApplication();
})();


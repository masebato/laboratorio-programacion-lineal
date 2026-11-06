/*
 * graph.js
 * Dibuja las restricciones, la región factible y una isocurva objetivo.
 * También permite ver el primal o el dual cuando tienen dos variables.
 */
(function () {
  const COLORS = [
    '#c26b3c', '#5285a0', '#8562a2', '#b19735', '#587f65', '#b05269',
    '#717b35', '#5670b3', '#a16d3c', '#537d8b', '#8c6696', '#987b39',
  ];

  function availableViews(model) {
    const views = [];
    if (model.objective.length === 2) views.push('primal');
    if (model.constraints.length === 2) views.push('dual');
    return views;
  }

  function getGraphProblem(model, view) {
    if (view === 'primal') {
      return {
        kind: 'primal',
        variableNames: ['x₁', 'x₂'],
        objectiveName: 'Z',
        objective: model.objective,
        optimum: model.primal.variables,
        relation: model.direction === 'max' ? 'le' : 'ge',
        objectiveDirection: model.direction,
        constraints: model.constraints.map((constraint, index) => ({
          coefficients: constraint.coefficients,
          rhs: constraint.rhs,
          label: `R${index + 1}`,
        })),
      };
    }

    return {
      kind: 'dual',
      variableNames: ['y₁', 'y₂'],
      objectiveName: 'W',
      objective: model.constraints.map((constraint) => constraint.rhs),
      optimum: model.dual.variables,
      relation: model.direction === 'max' ? 'ge' : 'le',
      objectiveDirection: model.direction === 'max' ? 'min' : 'max',
      // Cada variable primal genera una restricción en el dual.
      constraints: model.objective.map((coefficient, variableIndex) => ({
        coefficients: model.constraints.map((constraint) =>
          constraint.coefficients[variableIndex]),
        rhs: coefficient,
        label: `D${variableIndex + 1} (x${variableIndex + 1})`,
      })),
    };
  }

  function axisMaximum(problem, axis) {
    const intercepts = problem.constraints
      .map((constraint) => constraint.coefficients[axis] === 0
        ? 0
        : constraint.rhs / constraint.coefficients[axis])
      .filter((intercept) => intercept > 0);
    const optimum = Math.max(0, problem.optimum[axis] || 0);

    if (problem.relation === 'le') {
      const feasibleLimit = intercepts.length ? Math.min(...intercepts) : optimum * 1.35;
      return Math.max(1, optimum * 1.3, feasibleLimit * 1.08);
    }

    const visibleLimit = intercepts.length ? Math.max(...intercepts) : optimum * 1.3;
    return Math.max(1, optimum * 1.35, visibleLimit * 1.08);
  }

  function clipFeasibleRegion(constraints, relation, maxX, maxY) {
    // Empezamos con el rectángulo visible y recortamos por cada semiplano.
    let polygon = [[0, 0], [maxX, 0], [maxX, maxY], [0, maxY]];

    constraints.forEach((constraint) => {
      const [coefficientX, coefficientY] = constraint.coefficients;
      const isInside = ([x, y]) => {
        const difference = coefficientX * x + coefficientY * y - constraint.rhs;
        return relation === 'le' ? difference <= 1e-8 : difference >= -1e-8;
      };
      const clipped = [];

      for (let index = 0; index < polygon.length; index += 1) {
        const start = polygon[index];
        const end = polygon[(index + 1) % polygon.length];
        const startIsInside = isInside(start);
        const endIsInside = isInside(end);

        if (startIsInside && endIsInside) {
          clipped.push(end);
        } else if (startIsInside !== endIsInside) {
          const startValue = coefficientX * start[0] + coefficientY * start[1] - constraint.rhs;
          const endValue = coefficientX * end[0] + coefficientY * end[1] - constraint.rhs;
          const fractionAlongEdge = startValue / (startValue - endValue);
          const intersection = [
            start[0] + fractionAlongEdge * (end[0] - start[0]),
            start[1] + fractionAlongEdge * (end[1] - start[1]),
          ];
          clipped.push(intersection);
          if (!startIsInside && endIsInside) clipped.push(end);
        }
      }
      polygon = clipped;
    });

    return removeDuplicatePoints(polygon);
  }

  function removeDuplicatePoints(points) {
    const unique = [];
    points.forEach((point) => {
      const isDuplicate = unique.some((other) =>
        Math.hypot(point[0] - other[0], point[1] - other[1]) < 1e-7);
      if (!isDuplicate) unique.push(point);
    });
    return unique;
  }

  function lineInsideWindow(coefficientX, coefficientY, rhs, maxX, maxY) {
    const intersections = [];

    if (Math.abs(coefficientY) > 1e-12) {
      intersections.push([0, rhs / coefficientY]);
      intersections.push([maxX, (rhs - coefficientX * maxX) / coefficientY]);
    }
    if (Math.abs(coefficientX) > 1e-12) {
      intersections.push([rhs / coefficientX, 0]);
      intersections.push([(rhs - coefficientY * maxY) / coefficientX, maxY]);
    }

    const visible = removeDuplicatePoints(intersections.filter(([x, y]) =>
      Number.isFinite(x) && Number.isFinite(y) &&
      x >= -1e-8 && x <= maxX + 1e-8 && y >= -1e-8 && y <= maxY + 1e-8));
    if (visible.length < 2) return null;

    let farthestPair = [visible[0], visible[1]];
    let longestDistance = 0;
    for (let first = 0; first < visible.length; first += 1) {
      for (let second = first + 1; second < visible.length; second += 1) {
        const distance = Math.hypot(
          visible[first][0] - visible[second][0],
          visible[first][1] - visible[second][1],
        );
        if (distance > longestDistance) {
          longestDistance = distance;
          farthestPair = [visible[first], visible[second]];
        }
      }
    }
    return farthestPair;
  }

  function buildGrid(formatNumber, scale, width, height, padding) {
    const x = (value) => padding.left + value / scale.x * (width - padding.left - padding.right);
    const y = (value) => height - padding.bottom - value / scale.y * (height - padding.top - padding.bottom);
    let markup = '';

    for (let tick = 0; tick <= 4; tick += 1) {
      const xValue = scale.x * tick / 4;
      const yValue = scale.y * tick / 4;
      markup += `
        <line x1="${x(xValue)}" y1="${padding.top}" x2="${x(xValue)}" y2="${height - padding.bottom}" stroke="#edf0eb" />
        <text x="${x(xValue)}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="#718078" font-size="10">${formatNumber(xValue)}</text>
        <line x1="${padding.left}" y1="${y(yValue)}" x2="${width - padding.right}" y2="${y(yValue)}" stroke="#edf0eb" />
        <text x="${padding.left - 8}" y="${y(yValue) + 3}" text-anchor="end" fill="#718078" font-size="10">${formatNumber(yValue)}</text>`;
    }
    return { markup, x, y };
  }

  function renderGraph(model, selectedView, formatNumber) {
    const views = availableViews(model);
    if (views.length === 0) {
      return '<div class="empty"><div><i>⌁</i>El método gráfico requiere dos variables en el primal o en el dual. El simplex admite modelos con más variables.</div></div>';
    }

    const view = views.includes(selectedView) ? selectedView : views[0];
    const problem = getGraphProblem(model, view);
    const maxX = axisMaximum(problem, 0);
    const maxY = axisMaximum(problem, 1);
    const width = 740;
    const height = 365;
    const padding = { left: 56, right: 20, top: 20, bottom: 44 };
    const scale = { x: maxX, y: maxY };
    const grid = buildGrid(formatNumber, scale, width, height, padding);
    const feasibleRegion = clipFeasibleRegion(problem.constraints, problem.relation, maxX, maxY);
    const constraintLines = problem.constraints.map((constraint, index) => {
      const segment = lineInsideWindow(
        constraint.coefficients[0], constraint.coefficients[1], constraint.rhs, maxX, maxY);
      if (!segment) return '';
      const [start, end] = segment;
      const labelX = (grid.x(start[0]) + grid.x(end[0])) / 2 + 5;
      const labelY = (grid.y(start[1]) + grid.y(end[1])) / 2 - 5;
      const color = COLORS[index % COLORS.length];
      return `
        <line x1="${grid.x(start[0])}" y1="${grid.y(start[1])}" x2="${grid.x(end[0])}" y2="${grid.y(end[1])}" stroke="${color}" stroke-width="2" />
        <text x="${labelX}" y="${labelY}" font-size="10" font-weight="700" fill="${color}" paint-order="stroke" stroke="white" stroke-width="3">${constraint.label}</text>`;
    }).join('');

    const objectiveValue = problem.objective.reduce((sum, coefficient, index) =>
      sum + coefficient * (problem.optimum[index] || 0), 0);
    const objectiveSegment = lineInsideWindow(
      problem.objective[0], problem.objective[1], objectiveValue, maxX, maxY);
    const objectiveLine = objectiveSegment
      ? `<line x1="${grid.x(objectiveSegment[0][0])}" y1="${grid.y(objectiveSegment[0][1])}" x2="${grid.x(objectiveSegment[1][0])}" y2="${grid.y(objectiveSegment[1][1])}" stroke="#176b52" stroke-width="2.5" stroke-dasharray="7 5" />
         <text x="${grid.x(objectiveSegment[1][0]) - 4}" y="${grid.y(objectiveSegment[1][1]) - 8}" text-anchor="end" font-size="11" font-weight="800" fill="#176b52" paint-order="stroke" stroke="white" stroke-width="3">${problem.objectiveName} = ${formatNumber(objectiveValue)}</text>`
      : '';

    const polygon = feasibleRegion.length >= 3
      ? `<polygon points="${feasibleRegion.map(([x, y]) => `${grid.x(x)},${grid.y(y)}`).join(' ')}" fill="#9bcbb3" fill-opacity=".42" stroke="#5b9b7a" stroke-width="1.5" />`
      : '';
    const viewOptions = views.map((option) =>
      `<option value="${option}" ${option === view ? 'selected' : ''}>${option === 'primal' ? 'Primal (x₁, x₂)' : 'Dual (y₁, y₂)'}</option>`
    ).join('');
    const relationDescription = problem.relation === 'le'
      ? 'Se conserva el semiplano que satisface las restricciones ≤.'
      : 'Se conserva el semiplano que satisface las restricciones ≥.';
    const objectiveDescription = problem.objectiveDirection === 'max'
      ? `La recta ${problem.objectiveName} se desplaza hacia valores mayores hasta tocar el óptimo.`
      : `La recta ${problem.objectiveName} se desplaza hacia valores menores hasta tocar el óptimo.`;
    const description = `${relationDescription} ${objectiveDescription}`;
    const axisNames = problem.variableNames;

    return `
      <h3 class="section-title">Método gráfico · restricciones y objetivo</h3>
      <div class="graph-controls">
        <label for="graph-model">Modelo representado</label>
        <select id="graph-model" class="field">${viewOptions}</select>
      </div>
      <div class="study">
        <b>Cómo leer el gráfico.</b>
        <ol>
          <li>Cada recta de color representa una restricción. En el dual, hay una por cada actividad del primal.</li>
          <li>El área sombreada muestra la intersección de los semiplanos con las condiciones de no negatividad: ${relationDescription}</li>
          <li>La línea punteada es una recta de nivel de la función objetivo que pasa por el óptimo. ${objectiveDescription}</li>
        </ol>
      </div>
      <div class="legend">● Restricciones &nbsp; <span style="color:#5b9b7a">■ Región factible</span> &nbsp; <span style="color:#176b52">┄ Función objetivo en el óptimo</span></div>
      <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Restricciones, región factible y función objetivo">
        ${grid.markup}
        ${polygon}
        ${constraintLines}
        ${objectiveLine}
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#35443e" />
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${padding.left}" y2="${padding.top}" stroke="#35443e" />
        <circle cx="${grid.x(problem.optimum[0])}" cy="${grid.y(problem.optimum[1])}" r="6" fill="#176b52" stroke="white" stroke-width="2" />
        <text x="${grid.x(problem.optimum[0]) + 9}" y="${grid.y(problem.optimum[1]) - 9}" font-size="11" font-weight="700" fill="#176b52" paint-order="stroke" stroke="white" stroke-width="3">Óptimo (${formatNumber(problem.optimum[0])}, ${formatNumber(problem.optimum[1])})</text>
        <text x="${width / 2}" y="${height - 4}" text-anchor="middle" font-size="11">${axisNames[0]}</text>
        <text x="13" y="${height / 2}" transform="rotate(-90 13 ${height / 2})" text-anchor="middle" font-size="11">${axisNames[1]}</text>
      </svg>
      <div class="note">El punto y el valor de la recta objetivo corresponden al óptimo obtenido por simplex.</div>`;
  }

  window.LinearProgrammingGraph = { renderGraph, availableViews };
})();

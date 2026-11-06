/*
 * simplex.js
 * Algoritmos de programación lineal usados por el laboratorio.
 * No contiene código de interfaz ni depende de bibliotecas externas.
 */
(function () {
  const TOLERANCE = 1e-9;
  const MAX_ITERATIONS = 500;

  /**
   * Convierte un problema en forma estándar a un tableau y aplica simplex.
   * El problema que recibe siempre es de maximización.
   */
  function runSimplex(matrix, rightHandSide, objective, initialBasis, variableNames) {
    const numberOfVariables = objective.length;
    const numberOfConstraints = rightHandSide.length;
    const tableau = matrix.map((row, index) => [...row, rightHandSide[index]]);

    // La fila de Z empieza como Z - c*x = 0.
    const objectiveRow = [...objective.map((coefficient) => -coefficient), 0];

    // Ajusta la fila de Z para que las variables básicas tengan coeficiente cero.
    initialBasis.forEach((basicVariable, rowIndex) => {
      const basicCost = objective[basicVariable] || 0;
      if (basicCost === 0) return;

      for (let column = 0; column <= numberOfVariables; column += 1) {
        objectiveRow[column] += basicCost * tableau[rowIndex][column];
      }
    });
    tableau.push(objectiveRow);

    const basis = [...initialBasis];
    const steps = [];
    const saveStep = () => steps.push({
      tableau: tableau.map((row) => [...row]),
      basis: [...basis],
      enteringVariable: null,
      leavingRow: null,
      leavingVariable: null,
    });
    saveStep();

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
      const currentObjective = tableau[numberOfConstraints];

      // Para maximizar, cualquier coeficiente negativo puede mejorar Z.
      let enteringColumn = -1;
      for (let column = 0; column < numberOfVariables; column += 1) {
        if (currentObjective[column] < -TOLERANCE &&
            (enteringColumn < 0 || currentObjective[column] < currentObjective[enteringColumn])) {
          enteringColumn = column;
        }
      }

      if (enteringColumn < 0) {
        return { status: 'optimal', tableau, basis, steps, variableNames };
      }

      // Prueba de la razón mínima: solo se consideran coeficientes positivos.
      let leavingRow = -1;
      let smallestRatio = Infinity;
      for (let row = 0; row < numberOfConstraints; row += 1) {
        const pivotColumnValue = tableau[row][enteringColumn];
        if (pivotColumnValue <= TOLERANCE) continue;

        const ratio = tableau[row][numberOfVariables] / pivotColumnValue;
        if (ratio < smallestRatio - TOLERANCE) {
          smallestRatio = ratio;
          leavingRow = row;
        }
      }

      if (leavingRow < 0) {
        return { status: 'unbounded', tableau, basis, steps, variableNames };
      }

      const currentStep = steps[steps.length - 1];
      currentStep.enteringVariable = enteringColumn;
      currentStep.leavingRow = leavingRow;
      currentStep.leavingVariable = variableNames[basis[leavingRow]];

      pivot(tableau, leavingRow, enteringColumn);
      basis[leavingRow] = enteringColumn;
      saveStep();
    }

    return { status: 'iteration-limit', tableau, basis, steps, variableNames };
  }

  /** Hace un pivote Gauss-Jordan sobre un tableau. */
  function pivot(tableau, pivotRow, pivotColumn) {
    const pivotValue = tableau[pivotRow][pivotColumn];

    for (let column = 0; column < tableau[pivotRow].length; column += 1) {
      tableau[pivotRow][column] /= pivotValue;
    }

    for (let row = 0; row < tableau.length; row += 1) {
      if (row === pivotRow) continue;
      const factor = tableau[row][pivotColumn];
      if (Math.abs(factor) <= TOLERANCE) continue;

      for (let column = 0; column < tableau[row].length; column += 1) {
        tableau[row][column] -= factor * tableau[pivotRow][column];
      }
    }
  }

  /**
   * Construye holguras o excesos. Las restricciones >= requieren también
   * artificiales para obtener una base inicial; esas artificiales se retiran
   * al terminar la Fase I.
   */
  function solveStandardForm(matrix, rightHandSide, senses, objective, decisionNames) {
    const numberOfConstraints = rightHandSide.length;
    const numberOfDecisions = objective.length;
    const normalizedRows = [];

    for (let row = 0; row < numberOfConstraints; row += 1) {
      let coefficients = [...matrix[row]];
      let rhs = rightHandSide[row];
      let sense = senses[row];

      // Multiplicar una fila con RHS negativo por -1 cambia el sentido.
      if (rhs < 0) {
        coefficients = coefficients.map((value) => -value);
        rhs = -rhs;
        sense = sense === 'le' ? 'ge' : 'le';
      }
      normalizedRows.push({ coefficients, rhs, sense });
    }

    const artificialCount = normalizedRows.filter((row) => row.sense === 'ge').length;
    const slackStart = numberOfDecisions;
    const artificialStart = numberOfDecisions + numberOfConstraints;
    const totalVariables = artificialStart + artificialCount;
    const rows = [];
    const rhs = [];
    const basis = [];
    const artificialColumns = [];
    let nextArtificialColumn = artificialStart;

    normalizedRows.forEach((constraint, rowIndex) => {
      const row = Array(totalVariables).fill(0);
      constraint.coefficients.forEach((value, column) => { row[column] = value; });

      if (constraint.sense === 'le') {
        row[slackStart + rowIndex] = 1;
        basis[rowIndex] = slackStart + rowIndex;
      } else {
        row[slackStart + rowIndex] = -1;
        row[nextArtificialColumn] = 1;
        basis[rowIndex] = nextArtificialColumn;
        artificialColumns.push(nextArtificialColumn);
        nextArtificialColumn += 1;
      }

      rows.push(row);
      rhs.push(constraint.rhs);
    });

    const variableNames = [
      ...decisionNames,
      ...Array.from({ length: numberOfConstraints }, (_, index) => `s${index + 1}`),
      ...Array.from({ length: artificialCount }, (_, index) => `r${index + 1}`),
    ];

    if (artificialColumns.length === 0) {
      const fullObjective = [...objective, ...Array(totalVariables - numberOfDecisions).fill(0)];
      const result = runSimplex(rows, rhs, fullObjective, basis, variableNames);
      result.phaseOne = null;
      result.phaseOneNames = null;
      result.phaseTwoNames = variableNames;
      return result;
    }

    // Fase I: maximizar -suma(r). El óptimo debe ser exactamente cero.
    const phaseOneObjective = Array(totalVariables).fill(0);
    artificialColumns.forEach((column) => { phaseOneObjective[column] = -1; });
    const phaseOne = runSimplex(rows, rhs, phaseOneObjective, basis, variableNames);

    if (phaseOne.status !== 'optimal') {
      return { status: phaseOne.status, phaseOne, phaseOneNames: variableNames };
    }

    const phaseOneValue = phaseOne.tableau[phaseOne.tableau.length - 1][totalVariables];
    if (phaseOneValue < -TOLERANCE) {
      return { status: 'infeasible', phaseOne, phaseOneNames: variableNames };
    }

    // Una artificial básica con valor cero se pivotea fuera de la base.
    // Si no queda otra columna disponible, su fila es redundante y se elimina.
    const phaseOneBasis = [...phaseOne.basis];
    for (let row = phaseOneBasis.length - 1; row >= 0; row -= 1) {
      if (!artificialColumns.includes(phaseOneBasis[row])) continue;

      if (phaseOne.tableau[row][totalVariables] > TOLERANCE) {
        return { status: 'infeasible', phaseOne, phaseOneNames: variableNames };
      }

      let replacementColumn = -1;
      for (let column = 0; column < totalVariables; column += 1) {
        if (artificialColumns.includes(column)) continue;
        if (Math.abs(phaseOne.tableau[row][column]) > TOLERANCE) {
          replacementColumn = column;
          break;
        }
      }

      if (replacementColumn >= 0) {
        pivot(phaseOne.tableau, row, replacementColumn);
        phaseOneBasis[row] = replacementColumn;
      } else {
        phaseOne.tableau.splice(row, 1);
        phaseOneBasis.splice(row, 1);
      }
    }

    const retainedColumns = Array.from({ length: totalVariables }, (_, column) => column)
      .filter((column) => !artificialColumns.includes(column));
    const phaseTwoRows = phaseOne.tableau.slice(0, phaseOneBasis.length)
      .map((row) => retainedColumns.map((column) => row[column]));
    const phaseTwoRhs = phaseOne.tableau.slice(0, phaseOneBasis.length)
      .map((row) => row[totalVariables]);
    const phaseTwoBasis = phaseOneBasis.map((column) => retainedColumns.indexOf(column));
    const phaseTwoNames = retainedColumns.map((column) => variableNames[column]);
    const phaseTwoObjective = retainedColumns.map((column) =>
      column < numberOfDecisions ? objective[column] : 0);

    const phaseTwo = runSimplex(
      phaseTwoRows,
      phaseTwoRhs,
      phaseTwoObjective,
      phaseTwoBasis,
      phaseTwoNames,
    );

    phaseTwo.phaseOne = phaseOne;
    phaseTwo.phaseOneNames = variableNames;
    phaseTwo.phaseTwoNames = phaseTwoNames;
    return phaseTwo;
  }

  function readBasicSolution(result, numberOfVariables) {
    const values = Array(numberOfVariables).fill(0);
    const rhsColumn = result.tableau[0].length - 1;

    result.basis.forEach((variable, row) => {
      if (variable < numberOfVariables) values[variable] = result.tableau[row][rhsColumn];
    });
    return values;
  }

  /** Resuelve el primal y construye su dual a partir de A, b y c. */
  function solveLinearProgram(objective, constraints) {
    const numberOfVariables = objective.length;
    const numberOfConstraints = constraints.length;
    const matrix = constraints.map((constraint) => constraint.coefficients);
    const rhs = constraints.map((constraint) => constraint.rhs);
    const decisionNames = Array.from({ length: numberOfVariables }, (_, index) => `x${index + 1}`);

    const primal = solveStandardForm(
      matrix,
      rhs,
      Array(numberOfConstraints).fill('le'),
      objective,
      decisionNames,
    );

    if (primal.status !== 'optimal') return { status: primal.status, primal };

    const primalVariables = readBasicSolution(primal, numberOfVariables);
    const primalValue = objective.reduce((sum, coefficient, index) =>
      sum + coefficient * primalVariables[index], 0);
    const primalSlacks = constraints.map((constraint) => constraint.rhs -
      constraint.coefficients.reduce((sum, coefficient, index) =>
        sum + coefficient * primalVariables[index], 0));

    // Dual del primal max c*x, A*x <= b, x >= 0:
    // min b*y, A^T*y >= c, y >= 0.
    // El tableau resuelve max(-W), que tiene el mismo óptimo que min(W).
    const dualMatrix = Array.from({ length: numberOfVariables }, (_, variable) =>
      constraints.map((constraint) => constraint.coefficients[variable]));
    const dual = solveStandardForm(
      dualMatrix,
      [...objective],
      Array(numberOfVariables).fill('ge'),
      constraints.map((constraint) => -constraint.rhs),
      Array.from({ length: numberOfConstraints }, (_, index) => `y${index + 1}`),
    );

    if (dual.status !== 'optimal') return { status: dual.status, primal, dual };

    const dualVariables = readBasicSolution(dual, numberOfConstraints);
    const dualValue = constraints.reduce((sum, constraint, index) =>
      sum + constraint.rhs * dualVariables[index], 0);
    const dualExcesses = objective.map((coefficient, variable) =>
      constraints.reduce((sum, constraint, index) =>
        sum + constraint.coefficients[variable] * dualVariables[index], 0) - coefficient);

    return {
      status: 'optimal',
      objective,
      constraints,
      primal: {
        variables: primalVariables,
        objectiveValue: primalValue,
        slacks: primalSlacks,
        simplex: primal,
      },
      dual: {
        variables: dualVariables,
        objectiveValue: dualValue,
        excesses: dualExcesses,
        simplex: dual,
      },
    };
  }

  window.LinearProgrammingSolver = { solveLinearProgram };
})();


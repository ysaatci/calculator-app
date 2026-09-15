package calculator

import "math"

// AddOperation implements Operation for addition.
type AddOperation struct{}

func (AddOperation) Name() string { return "add" }
func (AddOperation) Arity() int   { return 2 }

func (AddOperation) Apply(operands ...float64) (float64, error) {
	return operands[0] + operands[1], nil
}

// SubtractOperation implements Operation for subtraction.
type SubtractOperation struct{}

func (SubtractOperation) Name() string { return "subtract" }
func (SubtractOperation) Arity() int   { return 2 }

func (SubtractOperation) Apply(operands ...float64) (float64, error) {
	return operands[0] - operands[1], nil
}

// MultiplyOperation implements Operation for multiplication.
type MultiplyOperation struct{}

func (MultiplyOperation) Name() string { return "multiply" }
func (MultiplyOperation) Arity() int   { return 2 }

func (MultiplyOperation) Apply(operands ...float64) (float64, error) {
	return operands[0] * operands[1], nil
}

// DivideOperation implements Operation for division.
type DivideOperation struct{}

func (DivideOperation) Name() string { return "divide" }
func (DivideOperation) Arity() int   { return 2 }

func (DivideOperation) Apply(operands ...float64) (float64, error) {
	if operands[1] == 0 {
		return 0, ErrDivisionByZero
	}
	return operands[0] / operands[1], nil
}

// PowerOperation implements Operation for exponentiation (a to the power b).
type PowerOperation struct{}

func (PowerOperation) Name() string { return "power" }
func (PowerOperation) Arity() int   { return 2 }

func (PowerOperation) Apply(operands ...float64) (float64, error) {
	// math.Pow reports undefined cases (e.g. a negative base with a
	// fractional exponent) as NaN and overflow as Inf; the API layer
	// rejects non-finite results, so they surface as a client error.
	return math.Pow(operands[0], operands[1]), nil
}

// SqrtOperation implements Operation for square roots.
type SqrtOperation struct{}

func (SqrtOperation) Name() string { return "sqrt" }
func (SqrtOperation) Arity() int   { return 1 }

func (SqrtOperation) Apply(operands ...float64) (float64, error) {
	if operands[0] < 0 {
		return 0, ErrNegativeSquareRoot
	}
	return math.Sqrt(operands[0]), nil
}

// PercentOperation implements Operation for converting a value to its
// percentage form, matching the "%" key on a pocket calculator: 50 -> 0.5.
type PercentOperation struct{}

func (PercentOperation) Name() string { return "percent" }
func (PercentOperation) Arity() int   { return 1 }

func (PercentOperation) Apply(operands ...float64) (float64, error) {
	return operands[0] / 100, nil
}

package calculator

// AddOperation implements Operation for addition.
type AddOperation struct{}

func (AddOperation) Name() string { return "add" }

func (AddOperation) Apply(a, b float64) (float64, error) {
	return a + b, nil
}

// SubtractOperation implements Operation for subtraction.
type SubtractOperation struct{}

func (SubtractOperation) Name() string { return "subtract" }

func (SubtractOperation) Apply(a, b float64) (float64, error) {
	return a - b, nil
}

// MultiplyOperation implements Operation for multiplication.
type MultiplyOperation struct{}

func (MultiplyOperation) Name() string { return "multiply" }

func (MultiplyOperation) Apply(a, b float64) (float64, error) {
	return a * b, nil
}

// DivideOperation implements Operation for division.
type DivideOperation struct{}

func (DivideOperation) Name() string { return "divide" }

func (DivideOperation) Apply(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return a / b, nil
}

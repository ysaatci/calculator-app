package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestOperations_Apply(t *testing.T) {
	tests := []struct {
		name     string
		op       Operation
		operands []float64
		want     float64
		wantErr  error
	}{
		{"add positive", AddOperation{}, []float64{2, 3}, 5, nil},
		{"add negative", AddOperation{}, []float64{-2, -3}, -5, nil},
		{"add with zero", AddOperation{}, []float64{5, 0}, 5, nil},
		{"add floats", AddOperation{}, []float64{1.5, 2.25}, 3.75, nil},

		{"subtract positive", SubtractOperation{}, []float64{5, 3}, 2, nil},
		{"subtract to negative", SubtractOperation{}, []float64{3, 5}, -2, nil},
		{"subtract with zero", SubtractOperation{}, []float64{5, 0}, 5, nil},

		{"multiply positive", MultiplyOperation{}, []float64{4, 3}, 12, nil},
		{"multiply by zero", MultiplyOperation{}, []float64{4, 0}, 0, nil},
		{"multiply negatives", MultiplyOperation{}, []float64{-4, -3}, 12, nil},

		{"divide exact", DivideOperation{}, []float64{6, 3}, 2, nil},
		{"divide fractional", DivideOperation{}, []float64{1, 4}, 0.25, nil},
		{"divide by zero", DivideOperation{}, []float64{5, 0}, 0, ErrDivisionByZero},
		{"divide zero by zero", DivideOperation{}, []float64{0, 0}, 0, ErrDivisionByZero},

		{"power squared", PowerOperation{}, []float64{2, 10}, 1024, nil},
		{"power of zero", PowerOperation{}, []float64{5, 0}, 1, nil},
		{"power negative exponent", PowerOperation{}, []float64{2, -2}, 0.25, nil},
		{"power fractional exponent", PowerOperation{}, []float64{9, 0.5}, 3, nil},
		{"power negative base", PowerOperation{}, []float64{-2, 3}, -8, nil},

		{"sqrt exact", SqrtOperation{}, []float64{9}, 3, nil},
		{"sqrt of zero", SqrtOperation{}, []float64{0}, 0, nil},
		{"sqrt irrational", SqrtOperation{}, []float64{2}, math.Sqrt2, nil},
		{"sqrt of negative", SqrtOperation{}, []float64{-1}, 0, ErrNegativeSquareRoot},

		{"percent of whole", PercentOperation{}, []float64{50}, 0.5, nil},
		{"percent of zero", PercentOperation{}, []float64{0}, 0, nil},
		{"percent of negative", PercentOperation{}, []float64{-25}, -0.25, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.op.Apply(tt.operands...)

			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Apply(%v) error = %v, want %v", tt.operands, err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("Apply(%v) unexpected error: %v", tt.operands, err)
			}
			if math.Abs(got-tt.want) > 1e-9 {
				t.Fatalf("Apply(%v) = %v, want %v", tt.operands, got, tt.want)
			}
		})
	}
}

// Every registered operation must report the operand count it actually
// consumes, since the API layer validates requests against it.
func TestOperations_NameAndArity(t *testing.T) {
	tests := []struct {
		op        Operation
		wantName  string
		wantArity int
	}{
		{AddOperation{}, "add", 2},
		{SubtractOperation{}, "subtract", 2},
		{MultiplyOperation{}, "multiply", 2},
		{DivideOperation{}, "divide", 2},
		{PowerOperation{}, "power", 2},
		{SqrtOperation{}, "sqrt", 1},
		{PercentOperation{}, "percent", 1},
	}
	for _, tt := range tests {
		if got := tt.op.Name(); got != tt.wantName {
			t.Errorf("Name() = %q, want %q", got, tt.wantName)
		}
		if got := tt.op.Arity(); got != tt.wantArity {
			t.Errorf("%s: Arity() = %d, want %d", tt.wantName, got, tt.wantArity)
		}
	}
}

func TestRegistry_Get(t *testing.T) {
	reg := DefaultRegistry()

	for _, name := range []string{"add", "subtract", "multiply", "divide", "power", "sqrt", "percent"} {
		op, err := reg.Get(name)
		if err != nil {
			t.Fatalf("Get(%q) unexpected error: %v", name, err)
		}
		if op.Name() != name {
			t.Fatalf("Get(%q) returned operation named %q", name, op.Name())
		}
	}

	if _, err := reg.Get("factorial"); !errors.Is(err, ErrUnknownOperation) {
		t.Fatalf("Get(%q) error = %v, want %v", "factorial", err, ErrUnknownOperation)
	}
}

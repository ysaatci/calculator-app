package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestOperations_Apply(t *testing.T) {
	tests := []struct {
		name    string
		op      Operation
		a, b    float64
		want    float64
		wantErr error
	}{
		{"add positive", AddOperation{}, 2, 3, 5, nil},
		{"add negative", AddOperation{}, -2, -3, -5, nil},
		{"add with zero", AddOperation{}, 5, 0, 5, nil},
		{"add floats", AddOperation{}, 1.5, 2.25, 3.75, nil},

		{"subtract positive", SubtractOperation{}, 5, 3, 2, nil},
		{"subtract to negative", SubtractOperation{}, 3, 5, -2, nil},
		{"subtract with zero", SubtractOperation{}, 5, 0, 5, nil},

		{"multiply positive", MultiplyOperation{}, 4, 3, 12, nil},
		{"multiply by zero", MultiplyOperation{}, 4, 0, 0, nil},
		{"multiply negatives", MultiplyOperation{}, -4, -3, 12, nil},

		{"divide exact", DivideOperation{}, 6, 3, 2, nil},
		{"divide fractional", DivideOperation{}, 1, 4, 0.25, nil},
		{"divide by zero", DivideOperation{}, 5, 0, 0, ErrDivisionByZero},
		{"divide zero by zero", DivideOperation{}, 0, 0, 0, ErrDivisionByZero},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.op.Apply(tt.a, tt.b)

			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Apply(%v, %v) error = %v, want %v", tt.a, tt.b, err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("Apply(%v, %v) unexpected error: %v", tt.a, tt.b, err)
			}
			if math.Abs(got-tt.want) > 1e-9 {
				t.Fatalf("Apply(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestOperations_Name(t *testing.T) {
	tests := []struct {
		op   Operation
		want string
	}{
		{AddOperation{}, "add"},
		{SubtractOperation{}, "subtract"},
		{MultiplyOperation{}, "multiply"},
		{DivideOperation{}, "divide"},
	}
	for _, tt := range tests {
		if got := tt.op.Name(); got != tt.want {
			t.Errorf("Name() = %q, want %q", got, tt.want)
		}
	}
}

func TestRegistry_Get(t *testing.T) {
	reg := DefaultRegistry()

	for _, name := range []string{"add", "subtract", "multiply", "divide"} {
		op, err := reg.Get(name)
		if err != nil {
			t.Fatalf("Get(%q) unexpected error: %v", name, err)
		}
		if op.Name() != name {
			t.Fatalf("Get(%q) returned operation named %q", name, op.Name())
		}
	}

	if _, err := reg.Get("sqrt"); !errors.Is(err, ErrUnknownOperation) {
		t.Fatalf("Get(%q) error = %v, want %v", "sqrt", err, ErrUnknownOperation)
	}
}

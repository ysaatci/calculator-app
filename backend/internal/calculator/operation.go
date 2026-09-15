// Package calculator implements the calculator's arithmetic operations as
// interchangeable strategies, so that supporting a new operation never
// requires touching existing operations or the HTTP layer.
package calculator

import "errors"

// ErrDivisionByZero is returned by Operation implementations when a division
// by zero is attempted. Callers can use errors.Is to detect it and map it to
// an appropriate response.
var ErrDivisionByZero = errors.New("division by zero")

// ErrUnknownOperation is returned by Registry.Get when no operation is
// registered under the requested name.
var ErrUnknownOperation = errors.New("unknown operation")

// Operation is a single arithmetic strategy: given two operands, it produces
// a result or an error (e.g. division by zero).
type Operation interface {
	// Name is the identifier clients use to select this operation
	// (e.g. "add"), and the key it is registered under.
	Name() string
	Apply(a, b float64) (float64, error)
}

// Registry resolves operation names to Operation strategies. It is built
// once at startup and is safe for concurrent read access thereafter.
type Registry struct {
	operations map[string]Operation
}

// NewRegistry builds a Registry from the given operations. Adding support for
// a new operation is a matter of implementing Operation and passing an
// instance here — no other code needs to change.
func NewRegistry(operations ...Operation) *Registry {
	m := make(map[string]Operation, len(operations))
	for _, op := range operations {
		m[op.Name()] = op
	}
	return &Registry{operations: m}
}

// Get returns the operation registered under name, or ErrUnknownOperation.
func (r *Registry) Get(name string) (Operation, error) {
	op, ok := r.operations[name]
	if !ok {
		return nil, ErrUnknownOperation
	}
	return op, nil
}

// DefaultRegistry returns a Registry populated with the calculator's
// built-in operations.
func DefaultRegistry() *Registry {
	return NewRegistry(
		AddOperation{},
		SubtractOperation{},
		MultiplyOperation{},
		DivideOperation{},
	)
}

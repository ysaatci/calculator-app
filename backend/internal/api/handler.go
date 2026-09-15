package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"net/http"

	"github.com/batusaatci/calculator-app/backend/internal/calculator"
	"github.com/batusaatci/calculator-app/backend/internal/metrics"
)

// maxRequestBodyBytes caps how much of a request body we are willing to read.
// A calculation request is a few dozen bytes; anything larger is a mistake or
// an attempt to make the server allocate on our behalf.
const maxRequestBodyBytes = 1 << 20 // 1 MiB

// Handler holds the HTTP handlers for the calculator API. It depends only on
// the calculator.Registry abstraction, so it never needs to change when new
// operations are added to the registry.
type Handler struct {
	registry *calculator.Registry
}

func NewHandler(registry *calculator.Registry) *Handler {
	return &Handler{registry: registry}
}

// Calculate handles POST /api/v1/calculate.
func (h *Handler) Calculate(w http.ResponseWriter, r *http.Request) {
	// Recorded on every exit path. The operation stays "unknown" until the
	// registry confirms it, so an arbitrary name from a client can never
	// become a metric label.
	operation := metrics.UnknownOperation
	outcome := metrics.OutcomeInvalidRequest
	defer func() { metrics.Calculations.WithLabelValues(operation, outcome).Inc() }()

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)

	var req calculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			h.reject(w, r, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		h.reject(w, r, http.StatusBadRequest, "request body must be valid JSON")
		return
	}

	if req.Operation == "" {
		h.reject(w, r, http.StatusBadRequest, "\"operation\" is required")
		return
	}
	if req.A == nil {
		h.reject(w, r, http.StatusBadRequest, "\"a\" is a required number")
		return
	}

	op, err := h.registry.Get(req.Operation)
	if err != nil {
		h.reject(w, r, http.StatusBadRequest, "unsupported operation: "+req.Operation)
		return
	}
	operation = op.Name()

	// How many operands an operation takes is part of its contract, and
	// supplying the wrong number is a client error like any other.
	operands := []float64{*req.A}
	switch {
	case op.Arity() == 2 && req.B == nil:
		h.reject(w, r, http.StatusBadRequest, req.Operation+" needs two operands, \"a\" and \"b\"")
		return
	case op.Arity() == 1 && req.B != nil:
		h.reject(w, r, http.StatusBadRequest, req.Operation+" takes a single operand, \"a\"")
		return
	case op.Arity() == 2:
		operands = append(operands, *req.B)
	}

	result, err := op.Apply(operands...)
	if err != nil {
		// Domain errors (division by zero, negative square root) are already
		// phrased for the caller, and the operands are the only thing the
		// caller controls, so they map to 400 rather than a server fault.
		outcome = metrics.OutcomeDomainError
		h.reject(w, r, http.StatusBadRequest, err.Error())
		return
	}

	// Operands within float64 range can still produce a result that isn't,
	// and JSON has no way to express Inf/NaN. Reject it explicitly rather
	// than failing later at encoding time.
	if math.IsInf(result, 0) || math.IsNaN(result) {
		outcome = metrics.OutcomeOutOfRange
		h.reject(w, r, http.StatusBadRequest, "result is out of range")
		return
	}

	outcome = metrics.OutcomeSuccess
	writeJSON(w, http.StatusOK, calculateResponse{
		Operation: req.Operation,
		A:         *req.A,
		B:         req.B,
		Result:    result,
	})
}

// Health handles GET /healthz.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// reject writes an error response and records why, so a request ID pulled
// from a user's report leads to the reason it failed - not just its status.
func (h *Handler) reject(w http.ResponseWriter, r *http.Request, status int, message string) {
	slog.WarnContext(r.Context(), "calculation rejected",
		"status", status,
		"reason", message,
		"request_id", RequestIDFromContext(r.Context()),
	)
	writeError(w, status, message)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	// Encode before touching the status line: writing the header first and
	// then failing to encode would leave the client with a successful-looking
	// but empty response.
	payload, err := json.Marshal(body)
	if err != nil {
		slog.Error("failed to encode response", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"internal server error"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

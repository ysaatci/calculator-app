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

// OperationResolver finds the operation a client asked for by name. The
// handler needs nothing more from a source of operations, so it asks for
// this rather than a concrete registry.
type OperationResolver interface {
	Get(name string) (calculator.Operation, error)
}

// Handler holds the HTTP handlers for the calculator API. It never names a
// specific operation, so it doesn't change when operations are added.
type Handler struct {
	operations OperationResolver
}

func NewHandler(operations OperationResolver) *Handler {
	return &Handler{operations: operations}
}

// Calculate handles POST /api/v1/calculate.
func (h *Handler) Calculate(w http.ResponseWriter, r *http.Request) {
	// Recorded on every exit path. The operation stays "unknown" until the
	// resolver confirms it, so an arbitrary name from a client can never
	// become a metric label.
	operation := metrics.UnknownOperation
	outcome := metrics.OutcomeInvalidRequest
	defer func() { metrics.Calculations.WithLabelValues(operation, outcome).Inc() }()

	req, problem := decodeCalculateRequest(w, r)
	if problem != nil {
		h.reject(w, r, problem.status, problem.message)
		return
	}

	op, err := h.operations.Get(req.Operation)
	if err != nil {
		h.reject(w, r, http.StatusBadRequest, "unsupported operation: "+req.Operation)
		return
	}
	operation = op.Name()

	operands, problem := operandsFor(op, req)
	if problem != nil {
		h.reject(w, r, problem.status, problem.message)
		return
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

// requestProblem is a request the client got wrong, with the status and the
// message to answer it with.
type requestProblem struct {
	status  int
	message string
}

func badRequest(message string) *requestProblem {
	return &requestProblem{status: http.StatusBadRequest, message: message}
}

// decodeCalculateRequest reads the body and checks it has the fields every
// calculation needs. Checks that depend on which operation was asked for
// happen once the operation is known.
func decodeCalculateRequest(w http.ResponseWriter, r *http.Request) (calculateRequest, *requestProblem) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)

	var req calculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return req, &requestProblem{status: http.StatusRequestEntityTooLarge, message: "request body too large"}
		}
		return req, badRequest("request body must be valid JSON")
	}

	if req.Operation == "" {
		return req, badRequest(`"operation" is required`)
	}
	if req.A == nil {
		return req, badRequest(`"a" is a required number`)
	}
	return req, nil
}

// operandsFor collects the operands the request supplied and checks the
// count against the operation's arity. The check itself is one comparison for
// every operation; only the wording differs, naming the fields the request
// format has.
func operandsFor(op calculator.Operation, req calculateRequest) ([]float64, *requestProblem) {
	operands := []float64{*req.A}
	if req.B != nil {
		operands = append(operands, *req.B)
	}

	if len(operands) == op.Arity() {
		return operands, nil
	}
	if op.Arity() == 1 {
		return nil, badRequest(req.Operation + ` takes a single operand, "a"`)
	}
	return nil, badRequest(req.Operation + ` needs two operands, "a" and "b"`)
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

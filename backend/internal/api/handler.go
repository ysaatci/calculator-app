package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/batusaatci/calculator-app/backend/internal/calculator"
)

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
	var req calculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "request body must be valid JSON")
		return
	}

	if req.Operation == "" {
		writeError(w, http.StatusBadRequest, "\"operation\" is required")
		return
	}
	if req.A == nil || req.B == nil {
		writeError(w, http.StatusBadRequest, "\"a\" and \"b\" are required numbers")
		return
	}

	op, err := h.registry.Get(req.Operation)
	if err != nil {
		writeError(w, http.StatusBadRequest, "unsupported operation: "+req.Operation)
		return
	}

	result, err := op.Apply(*req.A, *req.B)
	if err != nil {
		if errors.Is(err, calculator.ErrDivisionByZero) {
			writeError(w, http.StatusBadRequest, "division by zero")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, calculateResponse{
		Operation: req.Operation,
		A:         *req.A,
		B:         *req.B,
		Result:    result,
	})
}

// Health handles GET /healthz.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

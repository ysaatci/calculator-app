package api

import (
	"net/http"

	"github.com/batusaatci/calculator-app/backend/internal/calculator"
)

// NewRouter builds the calculator API's http.Handler, wiring routes to the
// given operation registry and wrapping them with standard middleware.
// allowedOrigin configures CORS for the frontend's origin (empty disables it).
func NewRouter(registry *calculator.Registry, allowedOrigin string) http.Handler {
	h := NewHandler(registry)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.Health)
	mux.HandleFunc("POST /api/v1/calculate", h.Calculate)

	return Chain(mux, Recover, Logging, CORS(allowedOrigin))
}

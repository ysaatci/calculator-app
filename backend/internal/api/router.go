package api

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// NewRouter builds the calculator API's http.Handler, wiring routes to the
// given operations and wrapping them with standard middleware.
// allowedOrigin configures CORS for the frontend's origin (empty disables it).
func NewRouter(operations OperationResolver, allowedOrigin string) http.Handler {
	h := NewHandler(operations)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.Health)
	mux.HandleFunc("POST /api/v1/calculate", h.Calculate)

	root := http.NewServeMux()
	// Scrapes arrive every few seconds and would otherwise bury the access
	// log in noise, so /metrics sits outside the instrumented chain.
	root.Handle("GET /metrics", promhttp.Handler())
	root.Handle("/", Chain(mux, RequestID, Recover, Logging, Metrics, CORS(allowedOrigin)))

	return root
}

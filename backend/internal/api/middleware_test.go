package api

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/batusaatci/calculator-app/backend/internal/metrics"
)

// discardLogs keeps test output readable; the handlers log on every request.
func discardLogs(t *testing.T) {
	t.Helper()
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(io.Discard, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
}

func TestRecover_TurnsPanicIntoInternalServerError(t *testing.T) {
	discardLogs(t)

	panicking := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	})
	srv := Chain(panicking, Recover)

	rec := httptest.NewRecorder()
	// The request must not take the panic down with it.
	srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}

	var got errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("invalid JSON error response: %v", err)
	}
	if got.Error == "" {
		t.Fatal("expected non-empty error message")
	}
}

func TestLogging_RecordsDownstreamStatus(t *testing.T) {
	discardLogs(t)

	srv := Chain(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusTeapot, "nope")
	}), Logging)

	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusTeapot {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusTeapot)
	}
}

func TestRequestID_IsReturnedAndReadableDownstream(t *testing.T) {
	var seen string
	srv := Chain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = RequestIDFromContext(r.Context())
	}), RequestID)

	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	header := rec.Header().Get(RequestIDHeader)
	if header == "" {
		t.Fatalf("expected a %s response header", RequestIDHeader)
	}
	// The value the caller sees has to be the one the logs will carry,
	// otherwise a reported ID leads nowhere.
	if seen != header {
		t.Fatalf("context id = %q, response header = %q", seen, header)
	}
}

func TestRequestID_DiffersBetweenRequests(t *testing.T) {
	srv := Chain(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}), RequestID)

	ids := make(map[string]bool)
	for range 50 {
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		ids[rec.Header().Get(RequestIDHeader)] = true
	}

	if len(ids) != 50 {
		t.Fatalf("got %d distinct ids across 50 requests, want 50", len(ids))
	}
}

func TestMetrics_LabelsByMatchedRoute(t *testing.T) {
	discardLogs(t)
	srv := newTestServer()

	before := testutil.ToFloat64(
		metrics.HTTPRequests.WithLabelValues(http.MethodPost, "POST /api/v1/calculate", "200"),
	)

	doCalculate(t, srv, `{"operation":"add","a":1,"b":2}`)

	after := testutil.ToFloat64(
		metrics.HTTPRequests.WithLabelValues(http.MethodPost, "POST /api/v1/calculate", "200"),
	)
	if after != before+1 {
		t.Fatalf("counter for the matched route went %v -> %v, want +1", before, after)
	}
}

// Labelling by raw path would let anyone mint unlimited time series just by
// requesting random URLs, so unmatched requests share one label value.
func TestMetrics_UnmatchedRoutesShareOneLabel(t *testing.T) {
	discardLogs(t)
	srv := newTestServer()

	before := testutil.ToFloat64(
		metrics.HTTPRequests.WithLabelValues(http.MethodGet, metrics.UnmatchedRoute, "404"),
	)

	for _, path := range []string{"/nope", "/also-nope", "/definitely/not/here"} {
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	}

	after := testutil.ToFloat64(
		metrics.HTTPRequests.WithLabelValues(http.MethodGet, metrics.UnmatchedRoute, "404"),
	)
	if after != before+3 {
		t.Fatalf("unmatched counter went %v -> %v, want +3", before, after)
	}
}

func TestMetrics_EndpointIsServed(t *testing.T) {
	discardLogs(t)
	srv := newTestServer()

	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if !strings.Contains(rec.Body.String(), "calculator_calculations_total") {
		t.Fatal("expected the calculator collectors to be exposed on /metrics")
	}
}

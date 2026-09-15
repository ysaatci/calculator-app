package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/batusaatci/calculator-app/backend/internal/calculator"
	"github.com/batusaatci/calculator-app/backend/internal/metrics"
)

func newTestServer() http.Handler {
	return NewRouter(calculator.DefaultRegistry(), "")
}

func doCalculate(t *testing.T, srv http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func TestCalculate_RecordsOutcomePerOperation(t *testing.T) {
	discardLogs(t)
	srv := newTestServer()

	// An unregistered name must not reach the label space as-is.
	cases := []struct {
		body      string
		operation string
		outcome   string
	}{
		{`{"operation":"add","a":1,"b":2}`, "add", metrics.OutcomeSuccess},
		{`{"operation":"divide","a":1,"b":0}`, "divide", metrics.OutcomeDomainError},
		{`{"operation":"multiply","a":1e308,"b":1e308}`, "multiply", metrics.OutcomeOutOfRange},
		{`{"operation":"factorial","a":5,"b":1}`, metrics.UnknownOperation, metrics.OutcomeInvalidRequest},
	}

	for _, c := range cases {
		t.Run(c.operation+"/"+c.outcome, func(t *testing.T) {
			counter := metrics.Calculations.WithLabelValues(c.operation, c.outcome)
			before := testutil.ToFloat64(counter)

			doCalculate(t, srv, c.body)

			if after := testutil.ToFloat64(counter); after != before+1 {
				t.Fatalf("counter went %v -> %v, want +1", before, after)
			}
		})
	}
}

// failingOperation stands in for an operation whose failure isn't one of the
// calculator package's own sentinel errors.
type failingOperation struct{}

func (failingOperation) Name() string                      { return "flaky" }
func (failingOperation) Arity() int                        { return 1 }
func (failingOperation) Apply(...float64) (float64, error) { return 0, errors.New("not today") }

type stubResolver map[string]calculator.Operation

func (s stubResolver) Get(name string) (calculator.Operation, error) {
	if op, ok := s[name]; ok {
		return op, nil
	}
	return nil, calculator.ErrUnknownOperation
}

// The handler only needs something that resolves names to operations, which
// is what lets it be driven by operations the default registry doesn't have.
func TestCalculate_WorksWithAnyOperationResolver(t *testing.T) {
	discardLogs(t)
	srv := NewRouter(stubResolver{"flaky": failingOperation{}}, "")

	rec := doCalculate(t, srv, `{"operation":"flaky","a":1}`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
	var got errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("invalid JSON error response: %v", err)
	}
	if got.Error != "not today" {
		t.Fatalf("error = %q, want the operation's own message", got.Error)
	}
}

func TestCalculate_Success(t *testing.T) {
	discardLogs(t)
	srv := newTestServer()

	// Comparing the raw body pins the wire format, including the fact that
	// "b" is echoed back only for operations that actually take it.
	tests := []struct {
		name     string
		body     string
		wantJSON string
	}{
		{"add", `{"operation":"add","a":2,"b":3}`, `{"operation":"add","a":2,"b":3,"result":5}`},
		{"subtract", `{"operation":"subtract","a":5,"b":3}`, `{"operation":"subtract","a":5,"b":3,"result":2}`},
		{"multiply", `{"operation":"multiply","a":4,"b":3}`, `{"operation":"multiply","a":4,"b":3,"result":12}`},
		{"divide", `{"operation":"divide","a":6,"b":3}`, `{"operation":"divide","a":6,"b":3,"result":2}`},
		{"power", `{"operation":"power","a":2,"b":10}`, `{"operation":"power","a":2,"b":10,"result":1024}`},
		{"sqrt", `{"operation":"sqrt","a":9}`, `{"operation":"sqrt","a":9,"result":3}`},
		{"percent", `{"operation":"percent","a":50}`, `{"operation":"percent","a":50,"result":0.5}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doCalculate(t, srv, tt.body)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
			}
			if got := rec.Body.String(); got != tt.wantJSON {
				t.Fatalf("body = %s, want %s", got, tt.wantJSON)
			}
		})
	}
}

func TestCalculate_Errors(t *testing.T) {
	srv := newTestServer()

	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantError  string // exact message, when the contract is documented
	}{
		{"malformed JSON", `{"operation":"add",`, http.StatusBadRequest, ""},
		{"missing operation", `{"a":1,"b":2}`, http.StatusBadRequest, ""},
		{"missing operand", `{"operation":"add","a":1}`, http.StatusBadRequest, `add needs two operands, "a" and "b"`},
		{"operand supplied to a unary operation", `{"operation":"sqrt","a":9,"b":2}`, http.StatusBadRequest, `sqrt takes a single operand, "a"`},
		{"non-numeric operand", `{"operation":"add","a":"x","b":2}`, http.StatusBadRequest, ""},
		{"unknown operation", `{"operation":"factorial","a":4,"b":0}`, http.StatusBadRequest, ""},
		{"division by zero", `{"operation":"divide","a":1,"b":0}`, http.StatusBadRequest, "division by zero"},
		{"square root of a negative", `{"operation":"sqrt","a":-1}`, http.StatusBadRequest, "square root of a negative number"},
		{"undefined power", `{"operation":"power","a":-8,"b":0.5}`, http.StatusBadRequest, "result is out of range"},
		{"result overflows float64", `{"operation":"multiply","a":1e308,"b":1e308}`, http.StatusBadRequest, "result is out of range"},
		{"result underflows to -Inf", `{"operation":"divide","a":-1e308,"b":1e-308}`, http.StatusBadRequest, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doCalculate(t, srv, tt.body)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d, body = %s", rec.Code, tt.wantStatus, rec.Body.String())
			}

			var got errorResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatalf("invalid JSON error response: %v", err)
			}
			if got.Error == "" {
				t.Fatalf("expected non-empty error message")
			}
			if tt.wantError != "" && got.Error != tt.wantError {
				t.Fatalf("error = %q, want %q", got.Error, tt.wantError)
			}
		})
	}
}

func TestCalculate_RejectsOversizedBody(t *testing.T) {
	srv := newTestServer()

	padding := strings.Repeat("0", maxRequestBodyBytes)
	rec := doCalculate(t, srv, `{"operation":"add","a":1,"b":2,"padding":"`+padding+`"}`)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusRequestEntityTooLarge)
	}

	var got errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("invalid JSON error response: %v", err)
	}
	if got.Error == "" {
		t.Fatal("expected non-empty error message")
	}
}

// A value json.Marshal can't encode must never leave the client with a
// successful-looking empty response - the failure mode that made an
// overflowing calculation return "200 OK" with no body.
func TestWriteJSON_UnencodableBodyFailsLoudly(t *testing.T) {
	discardLogs(t)

	rec := httptest.NewRecorder()
	writeJSON(rec, http.StatusOK, math.Inf(1))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
	if rec.Body.Len() == 0 {
		t.Fatal("expected a non-empty error body")
	}

	var got errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("invalid JSON error response: %v", err)
	}
	if got.Error == "" {
		t.Fatal("expected non-empty error message")
	}
}

func TestHealth(t *testing.T) {
	srv := newTestServer()

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestCORS_Preflight(t *testing.T) {
	srv := NewRouter(calculator.DefaultRegistry(), "http://localhost:3000")

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/calculate", nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNoContent)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want %q", got, "http://localhost:3000")
	}
}

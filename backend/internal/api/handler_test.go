package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/batusaatci/calculator-app/backend/internal/calculator"
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

func TestCalculate_Success(t *testing.T) {
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
	log.SetOutput(io.Discard)
	defer log.SetOutput(os.Stderr)

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

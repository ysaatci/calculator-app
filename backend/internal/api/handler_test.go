package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

	tests := []struct {
		name string
		body string
		want calculateResponse
	}{
		{"add", `{"operation":"add","a":2,"b":3}`, calculateResponse{"add", 2, 3, 5}},
		{"subtract", `{"operation":"subtract","a":5,"b":3}`, calculateResponse{"subtract", 5, 3, 2}},
		{"multiply", `{"operation":"multiply","a":4,"b":3}`, calculateResponse{"multiply", 4, 3, 12}},
		{"divide", `{"operation":"divide","a":6,"b":3}`, calculateResponse{"divide", 6, 3, 2}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doCalculate(t, srv, tt.body)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
			}

			var got calculateResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatalf("invalid JSON response: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %+v, want %+v", got, tt.want)
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
	}{
		{"malformed JSON", `{"operation":"add",`, http.StatusBadRequest},
		{"missing operation", `{"a":1,"b":2}`, http.StatusBadRequest},
		{"missing operand", `{"operation":"add","a":1}`, http.StatusBadRequest},
		{"non-numeric operand", `{"operation":"add","a":"x","b":2}`, http.StatusBadRequest},
		{"unknown operation", `{"operation":"sqrt","a":4,"b":0}`, http.StatusBadRequest},
		{"division by zero", `{"operation":"divide","a":1,"b":0}`, http.StatusBadRequest},
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
		})
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

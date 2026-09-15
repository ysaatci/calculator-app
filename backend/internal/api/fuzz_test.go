package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
)

// FuzzCalculate throws arbitrary bodies at the endpoint and asserts the
// invariants that must hold no matter what arrives.
//
// This is not hypothetical: an earlier version answered
// {"operation":"multiply","a":1e308,"b":1e308} with "200 OK" and an empty
// body, because the overflowed result could not be JSON-encoded after the
// status line had already been written. The "a 200 always carries a finite
// result" check below fails on exactly that input.
//
// The seed corpus runs as part of `go test`; `go test -fuzz=FuzzCalculate`
// explores beyond it.
func FuzzCalculate(f *testing.F) {
	slog.SetDefault(slog.New(slog.NewJSONHandler(io.Discard, nil)))
	srv := newTestServer()

	seeds := []string{
		`{"operation":"add","a":2,"b":3}`,
		`{"operation":"divide","a":1,"b":0}`,
		`{"operation":"sqrt","a":9}`,
		`{"operation":"sqrt","a":-1}`,
		`{"operation":"percent","a":50}`,
		`{"operation":"power","a":1e308,"b":2}`,
		`{"operation":"multiply","a":1e308,"b":1e308}`,
		`{"operation":"power","a":-8,"b":0.5}`,
		`{"operation":"unknown","a":1,"b":2}`,
		`{"operation":"add","a":1}`,
		`{"operation":"","a":null,"b":null}`,
		`{}`,
		`not json at all`,
		``,
	}
	for _, seed := range seeds {
		f.Add(seed)
	}

	f.Fuzz(func(t *testing.T, body string) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")

		srv.ServeHTTP(rec, req)

		// No input should be able to crash a handler into the recover path.
		if rec.Code >= http.StatusInternalServerError {
			t.Fatalf("status %d for body %q", rec.Code, body)
		}

		// Every response is JSON, whatever happened.
		var decoded map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &decoded); err != nil {
			t.Fatalf("non-JSON response %q for body %q", rec.Body.String(), body)
		}

		if rec.Code != http.StatusOK {
			if msg, ok := decoded["error"].(string); !ok || msg == "" {
				t.Fatalf("status %d carried no error message for body %q", rec.Code, body)
			}
			return
		}

		// A success must carry a result a client can actually display.
		result, ok := decoded["result"].(float64)
		if !ok {
			t.Fatalf("200 response without a numeric result: %q (body %q)", rec.Body.String(), body)
		}
		if math.IsInf(result, 0) || math.IsNaN(result) {
			t.Fatalf("200 response with non-finite result %v for body %q", result, body)
		}
	})
}

package api

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/batusaatci/calculator-app/backend/internal/calculator"
)

// These exist to keep an honest number attached to the claim that the server
// is not the bottleneck: a calculation costs single-digit microseconds, while
// the network round-trip carrying it costs milliseconds. Run with
// `go test ./internal/api -run XXX -bench .`.
func benchServer(b *testing.B) http.Handler {
	b.Helper()
	slog.SetDefault(slog.New(slog.NewJSONHandler(io.Discard, nil)))
	return NewRouter(calculator.DefaultRegistry(), "")
}

func BenchmarkCalculate(b *testing.B) {
	srv := benchServer(b)
	body := []byte(`{"operation":"add","a":2,"b":3}`)

	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/calculate", bytes.NewReader(body)))
	}
}

// The registry is read-only after startup and the collectors are safe for
// concurrent use; this is where that stops being an assertion. Per-op time
// should not degrade against the sequential benchmark.
func BenchmarkCalculateParallel(b *testing.B) {
	srv := benchServer(b)
	body := []byte(`{"operation":"add","a":2,"b":3}`)

	b.ReportAllocs()
	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			rec := httptest.NewRecorder()
			srv.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/calculate", bytes.NewReader(body)))
		}
	})
}

// Command server runs the calculator REST API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/batusaatci/calculator-app/backend/internal/api"
	"github.com/batusaatci/calculator-app/backend/internal/calculator"
)

func main() {
	// JSON on stdout: the container runtime collects it, and structured
	// fields stay queryable instead of needing to be grepped out of prose.
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg := loadConfig()

	registry := calculator.DefaultRegistry()
	handler := api.NewRouter(registry, cfg.allowedOrigin)

	srv := &http.Server{
		Addr:         cfg.addr,
		Handler:      handler,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	go func() {
		slog.Info("calculator API listening", "addr", cfg.addr, "cors_origin", cfg.allowedOrigin)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
	slog.Info("server stopped")
}

// config is everything the process reads from its environment, gathered in
// one place so the settings are visible together rather than fetched
// wherever they happen to be needed.
type config struct {
	addr string
	// allowedOrigin is the single browser origin permitted by CORS. Empty
	// means no CORS headers at all, which is the right default for a server
	// with no browser client in front of it.
	allowedOrigin string
}

func loadConfig() config {
	return config{
		addr:          ":" + envOrDefault("PORT", "8080"),
		allowedOrigin: os.Getenv("ALLOWED_ORIGIN"),
	}
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

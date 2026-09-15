// Package metrics holds the Prometheus collectors for the calculator API,
// following the RED method: rate, errors and duration.
//
// Every label value here is drawn from a bounded set. Labels taken straight
// from client input (a request path, an operation name) would let a caller
// create unlimited time series just by sending junk, so unmatched routes and
// unregistered operation names collapse to a single placeholder.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Outcomes recorded against a calculation attempt.
const (
	OutcomeSuccess        = "success"
	OutcomeInvalidRequest = "invalid_request" // malformed body, bad operand count, unknown operation
	OutcomeDomainError    = "domain_error"    // division by zero, root of a negative
	OutcomeOutOfRange     = "out_of_range"    // result can't be represented as a finite float64
)

// UnknownOperation labels calculations asking for an operation that isn't
// registered, keeping arbitrary client strings out of the label space.
const UnknownOperation = "unknown"

// UnmatchedRoute labels requests that no route pattern matched.
const UnmatchedRoute = "unmatched"

var HTTPRequests = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "calculator_http_requests_total",
		Help: "HTTP requests by route and response status.",
	},
	[]string{"method", "route", "status"},
)

var HTTPDuration = promauto.NewHistogramVec(
	prometheus.HistogramOpts{
		Name: "calculator_http_request_duration_seconds",
		Help: "HTTP request duration by route.",
		// Arithmetic served from memory lands in the microseconds, so the
		// default buckets (starting at 5ms) would put every request in the
		// first bucket and make percentiles meaningless.
		Buckets: prometheus.ExponentialBuckets(0.0001, 3, 8),
	},
	[]string{"method", "route"},
)

// Calculations is the domain-level counter: which operations clients actually
// ask for, and how often each one fails. "divide is 40% of traffic and an
// eighth of it divides by zero" is a question the HTTP counters can't answer.
var Calculations = promauto.NewCounterVec(
	prometheus.CounterOpts{
		Name: "calculator_calculations_total",
		Help: "Calculation attempts by operation and outcome.",
	},
	[]string{"operation", "outcome"},
)

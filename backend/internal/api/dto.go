package api

// calculateRequest is the JSON body expected by POST /api/v1/calculate.
type calculateRequest struct {
	Operation string   `json:"operation"`
	A         *float64 `json:"a"`
	B         *float64 `json:"b"`
}

// calculateResponse is returned on a successful calculation. B is omitted for
// single-operand operations such as sqrt, so the response echoes back exactly
// the operands the request supplied.
type calculateResponse struct {
	Operation string   `json:"operation"`
	A         float64  `json:"a"`
	B         *float64 `json:"b,omitempty"`
	Result    float64  `json:"result"`
}

// errorResponse is returned for any failed request.
type errorResponse struct {
	Error string `json:"error"`
}

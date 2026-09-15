package api

// calculateRequest is the JSON body expected by POST /api/v1/calculate.
type calculateRequest struct {
	Operation string   `json:"operation"`
	A         *float64 `json:"a"`
	B         *float64 `json:"b"`
}

// calculateResponse is returned on a successful calculation.
type calculateResponse struct {
	Operation string  `json:"operation"`
	A         float64 `json:"a"`
	B         float64 `json:"b"`
	Result    float64 `json:"result"`
}

// errorResponse is returned for any failed request.
type errorResponse struct {
	Error string `json:"error"`
}

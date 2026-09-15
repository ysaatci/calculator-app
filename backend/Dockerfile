# --- build stage ---
FROM golang:1.25-alpine AS builder
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server

# --- runtime stage ---
FROM alpine:3.20
RUN adduser -D -H appuser
COPY --from=builder /out/server /usr/local/bin/server
USER appuser

EXPOSE 8080
ENTRYPOINT ["server"]

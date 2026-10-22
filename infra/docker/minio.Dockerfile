# MinIO stopped publishing pullable public Docker Hub images in 2026. Build the
# pinned upstream release from source instead of relying on `latest`, a removed
# upstream image, or an unverified third-party mirror.
FROM golang:1.24-bookworm AS build

ARG MINIO_RELEASE
RUN go install "github.com/minio/minio@${MINIO_RELEASE}"

FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /go/bin/minio /usr/local/bin/minio
RUN minio --version

ENTRYPOINT ["minio"]

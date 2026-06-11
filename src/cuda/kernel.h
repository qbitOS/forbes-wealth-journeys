#pragma once

// Shared CUDA helpers — toolkit version matches Dockerfiles/Dockerfile.colossus (12.4.0).

#include <cstdio>

#include <cuda_runtime.h>

namespace grok {
namespace cuda {

constexpr int kDefaultBlockSize = 256;

inline void check_cuda(cudaError_t err, const char* file, int line) {
    if (err != cudaSuccess) {
        fprintf(
            stderr, "CUDA error %s at %s:%d\n", cudaGetErrorString(err), file, line);
    }
}

#define GROK_CUDA_CHECK(err) grok::cuda::check_cuda((err), __FILE__, __LINE__)

}  // namespace cuda
}  // namespace grok

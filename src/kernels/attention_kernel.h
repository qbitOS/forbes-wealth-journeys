#pragma once

// Attention kernel API — implement and extend for custom Colossus/JAX ops.

#include <cstddef>

#include <cuda_runtime.h>

namespace grok {
namespace kernels {

/// Scaled dot-product attention scores: scores[i,j] = scale * dot(q[i], k[j]).
cudaError_t attention_scores_launch(
    const float* q,
    const float* k,
    float* scores,
    int seq_len,
    int head_dim,
    float scale);

}  // namespace kernels
}  // namespace grok

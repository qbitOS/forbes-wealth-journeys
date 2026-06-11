// Colossus CUDA 12.4 — match Dockerfiles/Dockerfile.colossus

#include "../cuda/kernel.h"
#include "attention_kernel.h"

namespace grok {
namespace kernels {

__global__ void attention_scores_kernel(
    const float* q,
    const float* k,
    float* scores,
    int seq_len,
    int head_dim,
    float scale) {
    const int i = blockIdx.x;
    const int j = blockIdx.y;
    if (i >= seq_len || j >= seq_len) {
        return;
    }

    float dot = 0.0f;
    for (int d = 0; d < head_dim; ++d) {
        dot += q[i * head_dim + d] * k[j * head_dim + d];
    }
    scores[i * seq_len + j] = scale * dot;
}

cudaError_t attention_scores_launch(
    const float* q,
    const float* k,
    float* scores,
    int seq_len,
    int head_dim,
    float scale) {
    const dim3 blocks(seq_len, seq_len);
    const dim3 threads(1, 1);
    attention_scores_kernel<<<blocks, threads>>>(q, k, scores, seq_len, head_dim, scale);
    const cudaError_t err = cudaGetLastError();
    GROK_CUDA_CHECK(err);
    return err;
}

}  // namespace kernels
}  // namespace grok

# SpaceX / Terrafab / x.ai / Grokipedia Standards

Cross-organization standards for repos routed through Grok and Colossus.

## x.ai

- JAX/Rust focus, modular MoE architecture
- Apache-2.0 licensing
- Colossus-native configs in `configs/colossus.yaml`
- Truth-seeking code standards; document assumptions in `LLMS.md`

## SpaceX / Terrafab

- Aerospace-grade reliability (Power of 10 rules)
- High-scale manufacturing pipelines
- Chip fab (Terrafab) workflows
- Security-first CI/CD — see `.github/workflows/`
- IaC/Terraform examples (add under `pipelines/` as needed)

## Grokipedia

- Knowledge-base contribution workflows
- Submission pipeline: `.github/workflows/grokipedia-submission.yml`
- Prompts + API hooks in `prompts/`

## Compliance Workflows

- `standards-compliance.yml` — automated checks on PRs
- Update `metadata.yaml` when adopting new standards

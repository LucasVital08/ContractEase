#!/usr/bin/env bash
#
# upload-wasms.sh — Sobe os WASMs compilados para o bucket Supabase Storage.
#
# Pré-requisitos:
#   - dist/*.wasm já existentes (rode `./scripts/build-all.sh` antes)
#   - supabase CLI logado (`supabase login`) e linked (`supabase link`)
#   - bucket "contracts-wasm" criado (público OU service-role only).
#
# Uso:
#   ./scripts/upload-wasms.sh [project-ref]

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

if [[ ! -d "$DIST" ]] || [[ -z "$(ls -A "$DIST"/*.wasm 2>/dev/null)" ]]; then
  echo "✗ Nenhum WASM em $DIST. Rode ./scripts/build-all.sh antes."
  exit 1
fi

PROJECT_REF="${1:-}"

for f in "$DIST"/*.wasm; do
  name="$(basename "$f")"
  echo "▶ Subindo $name…"
  if [[ -n "$PROJECT_REF" ]]; then
    supabase storage cp "$f" "sb://contracts-wasm/$name" --project-ref "$PROJECT_REF"
  else
    supabase storage cp "$f" "sb://contracts-wasm/$name"
  fi
done

echo
echo "✓ Upload completo. A Edge Function deploy-soroban agora consegue carregar os WASMs."

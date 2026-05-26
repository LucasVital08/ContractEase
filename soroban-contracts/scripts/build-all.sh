#!/usr/bin/env bash
#
# build-all.sh — Compila todos os contratos para WASM otimizado.
#
# Pré-requisitos:
#   - rustup target add wasm32-unknown-unknown
#   - stellar CLI:  cargo install --locked stellar-cli@22.0.0
#
# Uso:
#   ./scripts/build-all.sh                  # compila + otimiza
#   ./scripts/build-all.sh --skip-optimize  # apenas compila
#
# Saída: ./dist/<contrato>.wasm pronto para deploy.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DIST="$ROOT/dist"
mkdir -p "$DIST"

CONTRACTS=(
  "rent:contractease_rent"
  "ecommerce:contractease_ecommerce"
  "freelancer:contractease_freelancer"
  "legal-fees:contractease_legal_fees"
  "construction:contractease_construction"
  "real-estate-share:contractease_real_estate_share"
  "real-estate-vault:contractease_real_estate_vault"
)

SKIP_OPT=0
if [[ "${1:-}" == "--skip-optimize" ]]; then SKIP_OPT=1; fi

echo "▶ Building contractease workspace (release)…"
cargo build --target wasm32-unknown-unknown --release --workspace --exclude contractease-common

for entry in "${CONTRACTS[@]}"; do
  pkg_dir="${entry%%:*}"
  wasm_name="${entry##*:}"

  src="target/wasm32-unknown-unknown/release/${wasm_name}.wasm"
  out_name="${pkg_dir//-/_}.wasm"
  dst="$DIST/$out_name"

  if [[ ! -f "$src" ]]; then
    echo "✗ não encontrei $src — pulei $pkg_dir"
    continue
  fi

  cp "$src" "$dst"
  echo "✓ $pkg_dir → $dst ($(wc -c < "$dst") bytes)"

  if [[ $SKIP_OPT -eq 0 ]] && command -v stellar &>/dev/null; then
    stellar contract optimize --wasm "$dst" >/dev/null
    optimized="${dst%.wasm}.optimized.wasm"
    if [[ -f "$optimized" ]]; then
      mv "$optimized" "$dst"
      echo "  ↳ otimizado: $(wc -c < "$dst") bytes"
    fi
  fi
done

echo
echo "✓ Build completo. WASMs em $DIST/"
echo
echo "Próximo passo: subir para o Supabase Storage bucket 'contracts-wasm'."
echo "Exemplo:"
echo "  supabase storage cp $DIST/rent.wasm sb://contracts-wasm/rent.wasm"

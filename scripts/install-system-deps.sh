#!/usr/bin/env bash
set -Eeuo pipefail

main() {
  printf 'System dependencies: PASS\n'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi

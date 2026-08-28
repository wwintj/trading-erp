#!/usr/bin/env bash
set -Eeuo pipefail

DEFAULT_FONT_PATH="/usr/share/fonts/truetype/cwtex/cwfs.ttf"
FONT_PACKAGE="fonts-cwtex-fs"
OS_RELEASE_PATH="/etc/os-release"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

font_is_usable() {
  local font_path="$1"
  [[ -f "$font_path" && -r "$font_path" ]]
}

effective_uid() {
  printf '%s\n' "$EUID"
}

require_ubuntu_apt() {
  if [[ ! -r "$OS_RELEASE_PATH" ]]; then
    fail "System dependency installation supports Ubuntu with apt/apt-get only."
  fi

  local ID=""
  # /etc/os-release is the standard operating-system identification file.
  source "$OS_RELEASE_PATH"

  if [[ "$ID" != "ubuntu" ]]; then
    fail "System dependency installation supports Ubuntu with apt/apt-get only."
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    fail "apt-get is required to install Trading ERP system dependencies on Ubuntu."
  fi
}

install_default_font() {
  if [[ "$(effective_uid)" != "0" ]]; then
    if ! command -v sudo >/dev/null 2>&1; then
      fail "Installing ${FONT_PACKAGE} requires root or an available sudo command."
    fi

    printf 'Installing Purchase Contract PDF font package: %s\n' "$FONT_PACKAGE"
    if ! sudo apt-get update; then
      fail "apt-get update failed while preparing Purchase Contract PDF font installation."
    fi
    if ! sudo apt-get install -y "$FONT_PACKAGE"; then
      fail "Unable to install Purchase Contract PDF font package ${FONT_PACKAGE}."
    fi
    return 0
  fi

  printf 'Installing Purchase Contract PDF font package: %s\n' "$FONT_PACKAGE"
  if ! apt-get update; then
    fail "apt-get update failed while preparing Purchase Contract PDF font installation."
  fi
  if ! apt-get install -y "$FONT_PACKAGE"; then
    fail "Unable to install Purchase Contract PDF font package ${FONT_PACKAGE}."
  fi
}

main() {
  local custom_font_path="${PURCHASE_CONTRACT_PDF_FONT_PATH:-}"

  if [[ -n "$custom_font_path" ]]; then
    if ! font_is_usable "$custom_font_path"; then
      fail "Configured Purchase Contract PDF font is unavailable; it must be a readable regular file."
    fi
    printf 'Purchase Contract PDF font: PASS\n'
    return 0
  fi

  if font_is_usable "$DEFAULT_FONT_PATH"; then
    printf 'Purchase Contract PDF font: PASS\n'
    return 0
  fi

  require_ubuntu_apt
  install_default_font

  if ! font_is_usable "$DEFAULT_FONT_PATH"; then
    fail "Purchase Contract PDF font is still unavailable after installation. Check the system font installation or configure PURCHASE_CONTRACT_PDF_FONT_PATH."
  fi

  printf 'Purchase Contract PDF font: PASS\n'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi

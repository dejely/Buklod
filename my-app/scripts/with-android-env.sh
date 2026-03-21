#!/usr/bin/env bash
set -euo pipefail

# This prototype is optimized for a local Android demo on this machine.
# Force the Android toolchain to use the verified JDK/SDK locations so
# Expo CLI does not fall back to the system Java 26 installation.
export JAVA_HOME="${MESH_JAVA_HOME:-/home/dejel/.local/jdks/temurin-17}"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="${MESH_ANDROID_HOME:-/home/dejel/Android/sdk}"
export ANDROID_SDK_ROOT="${MESH_ANDROID_SDK_ROOT:-$ANDROID_HOME}"

exec "$@"

#!/bin/bash
# Run all TFA Radar tests
set -e
cd "$(dirname "$0")/.."
python -m pytest radar/tests/ -v --tb=short "$@"

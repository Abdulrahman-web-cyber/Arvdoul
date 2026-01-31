#!/bin/bash
echo "Installing ARES INFINITY engines..."
cd "$(dirname "$0")/engines"
npm install --no-audit --no-fund --silent
echo "Engines installed"

#!/bin/sh
set -e

echo "Initializing database..."
node --import tsx/esm db-init.ts

echo "Starting server..."
exec node --import tsx/esm index.ts

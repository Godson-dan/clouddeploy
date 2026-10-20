#!/bin/sh
set -eu

# The official PostgreSQL image runs this once when it initializes a new data volume.
createdb --username "$POSTGRES_USER" clouddeploy_test

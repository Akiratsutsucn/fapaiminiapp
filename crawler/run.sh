#!/bin/bash
# Start the crawler (daily scheduler mode)
cd "$(dirname "$0")/.."
python -m crawler.main --schedule

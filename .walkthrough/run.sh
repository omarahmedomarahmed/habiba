#!/bin/bash
cd /home/user/habiba
set -a; . ./.env.local; set +a
exec node ".walkthrough/$1"

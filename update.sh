#!/bin/bash

cd "$(dirname "$0")"

php generate_api_from_protos.php
php generate_api.php

git add -A
git commit -a -m "Update Steam Web API reference" || exit 0
git push

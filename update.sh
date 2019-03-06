#!/bin/bash

cd "$(dirname "$0")"

git pull

php generate_api.php

git add -A
git commit -S -a -m "Update Steam Web API reference"
git push

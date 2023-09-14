#!/bin/bash

cd "$(dirname "$0")"

#disabled because it needs better check for valid apis (due to server errors?)
#php generate_api_from_protos.php

php generate_api.php

git add -A
git commit -a -m "Update Steam Web API reference" || exit 0
git push

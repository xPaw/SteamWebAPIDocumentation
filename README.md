# Steam Web API Documentation

An automatically generated list of Steam Web API interfaces, methods and parameters. Allows you to craft requests in the browser.

If you specify the web api key, it will be stored in your browser, and will only be sent to Valve's API servers if you chose to do so.

**⚠ Please do not email me about questions on how to use specific APIs,
I provide an automatically updated and generated list, I do not personally know how to use all of them.**

## api.json

`api.json` is the final file that is generated from various sources:

1. Takes existing [`api.json`](api.json) file as a base, so removed methods are persisted
2. Official list from [`GetSupportedAPIList`](https://steamapi.xpaw.me/#ISteamWebAPIUtil/GetSupportedAPIList)
   - Using normal API key
   - Using partner API key
3. [Parsed protobufs](https://github.com/SteamDatabase/Protobufs) to find service methods and tested against the API
   - Descriptions and fields are also parsed
4. [`api_undocumented_methods.txt`](api_undocumented_methods.txt) to insert undocumented and otherwise unknown APIs
5. [`api_type_overrides.json`](api_type_overrides.json) to fix up types of known method parameters. Such as enforcing arrays

## config.php

To run generation scripts, a `config.php` file needs to be created with API keys:

```php
<?php
$PublicApiKey    = '';
$PublisherApiKey = '';
```

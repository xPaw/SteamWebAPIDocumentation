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
5. Web bundle scans collected via `extract_web_bundle_calls.php` and merged from `api_web_bundle_calls.json`
6. [`api_type_overrides.json`](api_type_overrides.json) to fix up types of known method parameters. Such as enforcing arrays
7. Optional proxy observations collected via `collect_observed_calls.php` and merged from `api_observed_calls.json`

## Discovery workflow

Use this pipeline to reproduce the discovery process end-to-end:

1. Run `GetSupportedAPIList` with both public and partner keys (configured in `config.php`) by running the generator scripts.
2. Parse protobuf updates from [SteamDatabase/Protobufs](https://github.com/SteamDatabase/Protobufs) to discover service methods.
3. Ingest observed calls from proxy logs using `collect_observed_calls.php`.
4. Extract web bundle references with `extract_web_bundle_calls.php`.

**Minimal checklist**

- [ ] Configure `config.php` with public + partner keys.
- [ ] Run `php generate_api.php` (pulls `GetSupportedAPIList`).
- [ ] Run `php generate_api_from_protos.php` (parses SteamDatabase/Protobufs).
- [ ] Run `php collect_observed_calls.php path/to/proxy-log.jsonl`.
- [ ] Run `php extract_web_bundle_calls.php`.

**Expected output files**

- `api.json`
- `api_observed_calls.json`
- `api_web_bundle_calls.json`

### Observed proxy logs

If you want to capture calls from a proxy like mitmproxy or Charles, export the flows as JSON lines where each line contains a request object with a URL (or host/path), HTTP method, and optional response body. Then run:

```bash
php collect_observed_calls.php path/to/proxy-log.jsonl
```

This produces `api_observed_calls.json`, which `generate_api.php` merges into the final `api.json` with the `_type` value set to `observed_proxy`.

## config.php

To run generation scripts, a `config.php` file needs to be created with API keys:

```php
<?php
$PublicApiKey    = '';
$PublisherApiKey = '';
```

## Web bundle scanning

To scan the Steam community/store bundles for additional API usage references, run:

```bash
php extract_web_bundle_calls.php
```

This writes `api_web_bundle_calls.json` and uses a local cache at `cache/web_bundles/` to avoid refetching bundles. Cached entries are refreshed once per 24 hours by default (or you can pass `--force` to refresh immediately).

## Developing locally

This requires [Node.js](https://nodejs.org). Run `npm install` to install the dependencies.

Use `npm run dev` command to start a local server with hot reloading.

Run `npm test` to check typescript.

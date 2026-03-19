<template>
	<div class="card mt-3">
		<div class="card-header">What is this?</div>
		<div class="card-body">
			<p>This is a static page that is automatically generated from <code>GetSupportedAPIList</code> using public and publisher keys. Additionally service methods are parsed from Steam client's protobuf files.</p>
			<p>If you specify the web api key above, it will be stored in your browser, and will only be sent to Valve's API servers if you choose to do so.</p>
			<p>Type a value in the value field and click the execute button to perform an API request in your browser.</p>
			<hr>
			<p>This website is created and maintained by <a href="https://xpaw.me/">xPaw</a>. Use any APIs listed here at your own risk.<br>I do not know how all of them work, this page is simply a reference.</p>
			<p>If you know of an API that is not listed here, <a href="https://github.com/xPaw/SteamWebAPIDocumentation/blob/master/api_undocumented_methods.txt">make a pull request to the file of undocumented APIs</a>.</p>
			<p>Source code for this page <a href="https://github.com/xPaw/SteamWebAPIDocumentation">is also available on GitHub</a>.</p>
		</div>
	</div>

	<div class="card mt-3">
		<div class="card-header">Authentication</div>
		<div class="card-body">
			<p>The Web API has three levels of access:</p>
			<ol>
				<li>Public methods that return publicly accessible data and require no authentication.</li>
				<li>Methods that require a <span class="badge bg-info text-dark">user</span> Web API key, available to anyone with a Steam account.</li>
				<li>Protected methods that require a <span class="badge bg-warning text-dark">publisher</span> Web API key and return sensitive data or perform protected actions.</li>
			</ol>
			<p>The API key can be provided either as a <code>key</code> query parameter, or by setting the <code>x-webapi-key</code> HTTP request header.</p>
			<p>Access tokens are used by Steam's own web pages (Store and Community) for authenticated users instead of Web API keys. Not all APIs support access tokens. Some only work with API keys, and some only work with access tokens. When provided, the access token is sent as the <code>access_token</code> parameter.</p>
			<p>Steam also acts as an <a href="https://steamcommunity.com/dev" target="_blank">OpenID provider</a>, allowing third-party sites to authenticate users via their Steam account without handling credentials directly.</p>
			<p>Many API methods have undocumented rate limits that differ from method to method. When rate limited, the API will usually return HTTP status 429, or an <code>x-eresult</code> of 84 (RateLimitExceeded).</p>
			<p>Publisher Web API keys must be stored securely on your server and must not be distributed with game clients. All API requests containing keys should be made over HTTPS.</p>
			<p>See <a href="https://partner.steamgames.com/doc/webapi_overview/auth" target="_blank">Steamworks Authentication documentation</a> for details on publisher key permissions and IP allow lists.</p>
		</div>
	</div>

	<div class="card mt-3">
		<div class="card-header">API endpoints</div>
		<div class="card-body">
			<p>The public Steamworks Web API is hosted on <code>https://api.steampowered.com</code> or <code>https://community.steam-api.com</code>.</p>
			<p>
				The public Web API host is accessible via HTTP (port 80) and HTTPS (port 443). Note that any requests using your publisher Web API key should be made over HTTPS.<br>
				This service is behind Akamai's edge cache, so the actual IP addresses you will see for the name will vary based on your location and on ongoing service changes.<br>
				The IPs can change rapidly and fluidly, so if your Web API calls are made through a firewall on outbound requests, read on.
			</p>
			<p>
				Steam also provides a partner-only Web API server hosted on <code>https://partner.steam-api.com</code>. The intent of this service is to have higher availability than
				the public host; you should use this service for all requests made from your secure servers. This host has some different properties than the public host:
			</p>
			<ul>
				<li>This host is only accessible via HTTPS.</li>
				<li>This host is not behind Akamai's edge cache.</li>
				<li>Every request to this host must be made with your publisher Web API key, even requests which would ordinarily not need a key.<br>
					Requests made without a valid publisher key will return a 403 error code.</li>
				<li>Requests generating 403 status codes will incur strict rate limits for the connecting IP. This is in an effort to ensure
					high availability. If you generate a sufficient number of requests within a certain time interval that return 403 status codes,
					either during testing, or by using a regular Web API key instead of your publisher key, the host will put your IP on a deny
					list for a while.</li>
			</ul>
			<p>You should not connect to the Web API servers by IP; use the DNS name. If you need to configure firewall rules for outbound API requests, see the <a href="https://partner.steamgames.com/doc/webapi_overview" target="_blank">Steamworks Web API Overview</a> for the current CIDR blocks.</p>
		</div>
	</div>

	<div class="card mt-3">
		<div class="card-header">Requests</div>
		<div class="card-body">
			<p>Similar to the Steamworks C++ API, the Web API has been divided into multiple interfaces that contain related methods. The URI format of each API request is: <code>https://api.steampowered.com/&lt;interface&gt;/&lt;method&gt;/&lt;method_version&gt;/</code></p>
			<p>Parameters are passed as query string parameters for GET requests, or in the request body as <code>application/x-www-form-urlencoded</code> for POST requests. All requests must use UTF-8 encoding.</p>
			<p>Array parameters use a zero-based index postfix notation (e.g., <code>steamids[0]</code>, <code>steamids[1]</code>) with a corresponding <code>count</code> parameter specifying the array length.</p>
			<p>Interfaces with names ending in "Service" accept arguments as a single JSON object via the <code>input_json</code> parameter (URL-encoded), or as base64-encoded protobuf binary via the <code>input_protobuf_encoded</code> parameter. The <code>key</code> and <code>format</code> parameters must be passed separately as query parameters, not inside the JSON.</p>
			<div class="form-control font-monospace mb-3">?key=XXXX&amp;input_json={"steamid":76561197972495328}</div>
			<p>See <a href="https://partner.steamgames.com/doc/webapi_overview" target="_blank">Steamworks Web API Overview</a> for full request format details.</p>
		</div>
	</div>

	<div class="card mt-3">
		<div class="card-header">Responses</div>
		<div class="card-body">
			<p>Steam supports returning Web API responses in multiple formats. By default, all responses are returned JSON encoded. However, each request can optionally contain a <code>format</code> parameter to specify the desired response format. The following values can be passed for this parameter: <code>json</code>, <code>xml</code>, <code>vdf</code>, and <code>protobuf_raw</code>.</p>
			<ul>
				<li><b>JSON</b> (default): 64-bit numbers are returned as strings. Null values use JSON <code>null</code>.</li>
				<li><b>XML</b>: Arrays use sub-elements, no XML attributes are used. Null is represented as the text <code>"null"</code>.</li>
				<li><b>VDF</b> (Valve Data Format): a <a href="https://developer.valvesoftware.com/wiki/KeyValues" target="_blank">KeyValues</a> format used by Valve. Arrays use numeric keys as quoted strings. Null is an empty string.</li>
				<li><b>Protobuf</b> (<code>protobuf_raw</code>): returns the response as binary protobuf.</li>
			</ul>
			<p>A flexible solution should be used to parse Web API results as each method may return results in an arbitrary order.</p>
			<p>Some API responses include <code>x-eresult</code> and <code>x-error_message</code> HTTP response headers indicating the result status. See <a href="https://steamerrors.com/" target="_blank">steamerrors.com</a> for a list of EResult values.</p>
			<div class="table-responsive">
				<table class="table table-sm table-bordered">
					<thead>
						<tr>
							<th>HTTP Status Code</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr><td class="font-monospace">200</td><td>OK</td></tr>
						<tr><td class="font-monospace">400</td><td>Bad Request: missing or incorrect required parameters.</td></tr>
						<tr><td class="font-monospace">401</td><td>Unauthorized: invalid or missing API key.</td></tr>
						<tr><td class="font-monospace">403</td><td>Forbidden: the API key does not have permission for the requested method.</td></tr>
						<tr><td class="font-monospace">404</td><td>Not Found: the requested API endpoint does not exist.</td></tr>
						<tr><td class="font-monospace">405</td><td>Method Not Allowed: the HTTP method (GET/POST) used is not allowed for this endpoint.</td></tr>
						<tr><td class="font-monospace">429</td><td>Too Many Requests: you are being rate limited.</td></tr>
						<tr><td class="font-monospace">500</td><td>Internal Server Error: an unexpected server error occurred, try again later.</td></tr>
						<tr><td class="font-monospace">502</td><td>Bad Gateway: the server received an invalid response from an upstream server.</td></tr>
						<tr><td class="font-monospace">503</td><td>Service Unavailable: the server is temporarily offline, try again later.</td></tr>
						<tr><td class="font-monospace">504</td><td>Gateway Timeout: the server did not receive a timely response from an upstream server.</td></tr>
					</tbody>
				</table>
			</div>
			<p>See <a href="https://partner.steamgames.com/doc/webapi_overview/responses" target="_blank">Steamworks Web API Responses</a> for additional details.</p>
		</div>
	</div>

	<div class="card border-danger mt-3">
		<div class="card-header bg-danger text-white">License</div>
		<div class="card-body">
			<p>
				THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
				IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
				FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
				AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
				LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
				OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
				SOFTWARE.
			</p>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({});
</script>

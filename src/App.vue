<template>
		<div class="py-2 no-select header" role="banner">
			<div class="container">
				<div class="row">
					<div class="col-lg-3" role="search">
						<input
							ref="inputSearch"
							type="search"
							class="search-input form-control me-sm-2"
							placeholder="Search methods… (type / to focus)"
							aria-label="Search interfaces and methods"
							@input="onSearchInput"
							@keydown.escape.prevent="this.searchInput.blur()"
							@keydown.up.prevent="navigateSidebar(-1)"
							@keydown.down.prevent="navigateSidebar(1)"
						>
					</div>
					<div class="col-lg-9">
						<h1><a href="#" @click.prevent="focusApiKey">Steam Web API Documentation</a></h1>
						<span class="separator" v-if="currentInterface !== ''"> / </span>
						<h2 v-if="currentInterface !== ''">{{ currentInterface }}</h2>
						<span v-else> with &hearts; by <a href="https://xpaw.me">xPaw</a></span>
					</div>
				</div>
			</div>
		</div>

		<div class="container">
			<div class="row">
				<div class="col-lg-3 sidebar py-3" role="navigation">
					<details class="interface-list-container" open v-if="userData.favorites.size > 0 && !currentFilter">
						<summary class="interface-group-name">Your favorites</summary>

						<ul class="interface-list m-0">
							<li
								v-for="favoriteMethod of userData.favorites"
								:key="favoriteMethod"
							>
								<a
									:href="'#' + favoriteMethod"
								>{{ favoriteMethod }}</a>
							</li>
						</ul>
					</details>

					<details
						v-for="[groupAppid, interfaceGroup] in sidebarInterfaces"
						class="interface-list-container"
						:open="interfaceGroup.open"
						:key="groupAppid"
						@toggle="(e: ToggleEvent) => interfaceGroup.open = e.newState === 'open'"
					>
						<summary class="interface-group-name">
							<img :src="`icons/${interfaceGroup.icon}`" width="24" height="24" alt="" aria-hidden="true" v-if="interfaceGroup.icon">
							{{ interfaceGroup.name }}
						</summary>

						<ul class="interface-list m-0">
							<li
								v-for="(interfaceMethods, interfaceName) in interfaceGroup.methods"
								:key="interfaceName"
							>
								<a
									:href="'#' + interfaceName"
									:class="interfaceName === currentInterface ? 'fw-bold text-white' : ''"
								>{{ interfaceName }}</a>

								<ul class="method-list rounded mb-2 p-2" v-if="currentFilter || interfaceName === currentInterface">
									<li
										v-for="(method, methodName) in interfaceMethods"
										:key="methodName"
									>
										<a
											v-if="method.highlight"
											:href="'#' + interfaceName + '/' + methodName"
											:class="method.isFavorite ? 'text-warning' : ''"
											v-html="method.highlight"
										></a>
										<a
											v-else
											:href="'#' + interfaceName + '/' + methodName"
											:class="method.isFavorite ? 'text-warning' : ''"
										>{{ methodName }}</a>
									</li>
								</ul>
							</li>
						</ul>
					</details>
				</div>

				<div class="col-lg-9 content py-3" role="main">
					<div class="interface" v-if="currentInterface === '' && !currentFilter">
						<div class="card">
							<div class="card-header">Settings</div>
							<div class="card-body row">
								<div class="mb-3 col-md-6">
									<a href="https://steamcommunity.com/dev/apikey" target="_blank" class="float-end">Get your key here</a>
									<label class="form-label" for="form-api-key">WebAPI key</label>
									<input
										:type="keyInputType"
										:class="[
											'form-control',
											isFieldValid( 'webapi_key' ) ? 'is-valid' : 'is-invalid'
										]"
										ref="inputApiKey"
										id="form-api-key"
										placeholder="Your key (stored in your browser only)"
										autocomplete="off"
										v-model="userData.webapi_key"
										@focus="keyInputType = 'text'"
										@blur="keyInputType = 'password'">
								</div>
								<div class="mb-3 col-md-6">
									<a href="#" class="float-end" @click="accessTokenVisible = !accessTokenVisible">How to get it</a>
									<label class="form-label" for="form-access-token">
										Access token
										<span v-if="accessTokenExpiration > 0">expires on {{formatAccessTokenExpirationDate}}</span>
									</label>
									<input
										:type="keyInputType"
										:class="[
											'form-control',
											isFieldValid( 'access_token' ) ? 'is-valid' : 'is-invalid'
										]"
										ref="inputAccessToken"
										id="form-access-token"
										placeholder="Your key (stored in your browser only)"
										autocomplete="off"
										v-model="userData.access_token"
										@focus="keyInputType = 'text'; accessTokenVisible = true"
										@blur="keyInputType = 'password'">
								</div>
								<div class="mb-3 col-md-6">
									<label class="form-label" for="form-format">Preferred output format</label>
									<select class="form-select" id="form-format" v-model="userData.format">
										<option value="json">JSON</option>
										<option value="vdf">VDF</option>
										<option value="xml">XML (not recommended)</option>
									</select>
								</div>
								<div class="mb-3 col-md-6">
									<a href="https://steamdb.info/calculator/" target="_blank" class="float-end">Get your id here</a>
									<label class="form-label" for="form-steamid">Pre-fill SteamID</label>
									<input type="text" :class="[
										'form-control',
										isFieldValid( 'steamid' ) ? 'is-valid' : 'is-invalid'
									]" id="form-steamid" placeholder="Your SteamID, for example: 76561197960287930" v-model="userData.steamid">
								</div>
							</div>
						</div>

						<div class="card mt-3" v-if="accessTokenVisible">
							<div class="card-header bg-info text-dark">What is an access token?</div>
							<div class="card-body">
								<p>Some APIs work with access tokens, if you have one you can provide it here and it will be preferred over the webapi key.</p>
								<p v-if="accessTokenAudience.length > 0">Currently entered token is for <span class="badge bg-primary" v-for="aud in accessTokenAudience" :key="aud">{{ aud }}</span> with steamid {{ accessTokenSteamId }} and expires on {{ formatAccessTokenExpirationDate }}.</p>
								<p>Here's how to get a store token:</p>
								<ul>
									<li>Open <a href="https://store.steampowered.com/pointssummary/ajaxgetasyncconfig" target="_blank"><code>https://store.steampowered.com/pointssummary/ajaxgetasyncconfig</code></a></li>
									<li>Copy the value of <code>webapi_token</code> or simply paste the full JSON in</li>
								</ul>

								<p>Here's how to get a community token:</p>
								<ul>
									<li>Open <a href="https://steamcommunity.com/my/edit/info" target="_blank"><code>https://steamcommunity.com/my/edit/info</code></a></li>
									<li>Run the following script: <code>JSON.parse(application_config.dataset.loyalty_webapi_token)</code> <i>(or manually copy data-loyalty_webapi_token from application_config element)</i></li>
								</ul>
							</div>
						</div>

						<div class="card mt-3">
							<div class="card-header">What is this?</div>
							<div class="card-body">
								<p>This is a static page that is automatically generated from <a href="#ISteamWebAPIUtil/GetSupportedAPIList">GetSupportedAPIList</a> using public and publisher keys. Additionally service methods are parsed from Steam client's protobuf files.</p>
								<p>If you specify the web api key above, it will be stored in your browser, and will only be sent to Valve's API servers if you chose to do so.</p>
								<p>Type a value in the value field and click the execute button to perform an API request in your browser.</p>
								<hr>
								<p>This website is created and maintained by <a href="https://xpaw.me/">xPaw</a>. Use any APIs listed here at your own risk.<br>I do not know how all of them work, this page is simply a reference.</p>
								<p>If you know of an API that is not listed here, <a href="https://github.com/xPaw/SteamWebAPIDocumentation/blob/master/api_undocumented_methods.txt">make a pull request to the file of undocumented APIs</a>.</p>
								<p>Source code for this page <a href="https://github.com/xPaw/SteamWebAPIDocumentation">is also available on GitHub</a>.</p>
							</div>
						</div>

						<div class="card mt-3">
							<div class="card-header">Using the API</div>
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
										high availability. If you generate a sufficient number of requests within a certain time interval that return 403 status codes —
										either during testing, or by using a regular Web API key instead of your publisher key — the host will put your IP on a deny
										list for a while.</li>
								</ul>
								<p>You should not connect to the Web API servers by IP; use the DNS name.</p>
							</div>
						</div>

						<div class="card mt-3">
							<div class="card-header">Requests and responses</div>
							<div class="card-body">
								<p>Similiar to the Steamworks C++ API, the Web API has been divided into multiple interfaces that contain related methods. The URI format of each API request is: <code>https://api.steampowered.com/&lt;interface&gt;/&lt;method&gt;/&lt;method_version&gt;/</code></p>

								<p>Steam supports returning Web API responses in multiple formats. By default, all responses are returned JSON encoded. However, each request can optionally contain a <code>format</code> parameter to specify the desired response format. The following values can be passed for this parameter: <code>xml</code>, <code>json</code>, and <code>vdf</code>.</p>
								<p>A flexible solution should be used to parse Web API results as each method may return results in an arbitrary order.</p>
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

						<div class="card border-primary mt-3">
							<div class="card-header bg-primary text-white">Sitemap</div>
							<div class="card-body">
								<ul class="list-group" v-for="(interfaceMethods, interfaceName) in interfaces" :key="interfaceName">
									<li class="list-group-item px-0" v-for="(method, methodName) in interfaceMethods" :key="methodName">
										<a :href="'#' + interfaceName + '/' + methodName">{{ interfaceName }}/{{methodName}}</a>
										<div class="text-info mt-1" v-if="method.parameters.length > 0">{{ method.parameters.map( m => m.name ).join( ', ' ) }}</div>
									</li>
								</ul>
							</div>
						</div>
					</div>
					<div class="interface" v-else>
						<div class="alert no-email">
							This page is just a reference of all the known Steam APIs, I do not know how they work. Please do not email me with questions.
						</div>
						<div class="alert alert-success" v-if="currentFilter">
							<a href="#" @click.prevent="currentFilter = ''">Click here to reset filtered results.</a>
							Use arrows keys in search field to navigate.
						</div>
						<template v-for="(method, methodName) in currentInterfaceMethods" :key="methodName">
							<form
								target="_blank"
								:id="`${currentInterface}/${methodName}`"
								:method="method.httpmethod || 'GET'"
								:action="renderUri( methodName, method )"
								class="card mb-4"
								@submit="useThisMethod($event, method)"
							>
								<input type="hidden" name="access_token" v-model="userData.access_token" v-if="hasValidAccessToken">
								<input type="hidden" name="key" v-model="userData.webapi_key" v-if="!hasValidAccessToken && hasValidWebApiKey">
								<input type="hidden" name="format" v-model="userData.format" v-if="userData.format !== 'json'">

								<div class="card-header p-0 d-flex">
									<div class="card-inner-header">
										<a class="badge bg-warning text-dark no-select" v-if="method._type === 'publisher_only'" :href="`https://partner.steamgames.com/doc/webapi/${currentInterface}#${methodName}`" target="_blank">PUBLISHER</a>
										<span class="badge bg-warning text-dark no-select" v-if="method._type === 'undocumented'">UNDOCUMENTED</span>
										<span :class="method.httpmethod === 'GET' ? 'badge bg-success' : 'badge bg-danger'">{{ method.httpmethod }}</span>
										<a class="card-method-name" :href="'#' + currentInterface + '/' + methodName">{{ methodName }}</a>
										<span class="badge bg-primary badge-version" v-if="method.version > 1">v{{ method.version }}</span>
									</div>

									<div class="d-flex ms-auto">
										<button type="button" class="btn btn-link text-warning favorite-method" @click="favoriteMethod(method, methodName)">
											<svg viewBox="0 0 16 16" width="24" height="24" v-if="method.isFavorite"><path fill="currentColor" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>
											<svg viewBox="0 0 16 16" width="24" height="24" v-if="!method.isFavorite"><path fill="currentColor" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z"></path></svg>
										</button>
										<button type="submit" class="btn btn-primary use-method rounded-0">
											Execute
											<svg viewBox="0 0 416 512" height="16"><path fill="currentColor" d="M272 96c26.51 0 48-21.49 48-48S298.51 0 272 0s-48 21.49-48 48 21.49 48 48 48zM113.69 317.47l-14.8 34.52H32c-17.67 0-32 14.33-32 32s14.33 32 32 32h77.45c19.25 0 36.58-11.44 44.11-29.09l8.79-20.52-10.67-6.3c-17.32-10.23-30.06-25.37-37.99-42.61zM384 223.99h-44.03l-26.06-53.25c-12.5-25.55-35.45-44.23-61.78-50.94l-71.08-21.14c-28.3-6.8-57.77-.55-80.84 17.14l-39.67 30.41c-14.03 10.75-16.69 30.83-5.92 44.86s30.84 16.66 44.86 5.92l39.69-30.41c7.67-5.89 17.44-8 25.27-6.14l14.7 4.37-37.46 87.39c-12.62 29.48-1.31 64.01 26.3 80.31l84.98 50.17-27.47 87.73c-5.28 16.86 4.11 34.81 20.97 40.09 3.19 1 6.41 1.48 9.58 1.48 13.61 0 26.23-8.77 30.52-22.45l31.64-101.06c5.91-20.77-2.89-43.08-21.64-54.39l-61.24-36.14 31.31-78.28 20.27 41.43c8 16.34 24.92 26.89 43.11 26.89H384c17.67 0 32-14.33 32-32s-14.33-31.99-32-31.99z"></path></svg>
										</button>
									</div>
								</div>

								<div class="card-body">
									<p v-if="method.description">{{ method.description }}</p>

									<div class="input-group mb-3">
										<div class="form-control font-monospace h-auto">{{ renderUri( methodName, method ) }}{{ uriDelimeterBeforeKey }}<span :class="hasValidAccessToken ? 'hidden-token' : 'hidden-key'">{{ renderApiKey() }}</span>{{ renderParameters( method ) }}</div>
										<button class="btn btn-outline-primary pt-0" type="button" @click.prevent="copyUrl($event)">
											<svg viewBox="0 0 14 16" version="1.1" width="14" height="16" aria-label="Copy"><path fill-rule="evenodd" d="M2 13h4v1H2v-1zm5-6H2v1h5V7zm2 3V8l-3 3 3 3v-2h5v-2H9zM4.5 9H2v1h2.5V9zM2 12h2.5v-1H2v1zm9 1h1v2c-.02.28-.11.52-.3.7-.19.18-.42.28-.7.3H1c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h3c0-1.11.89-2 2-2 1.11 0 2 .89 2 2h3c.55 0 1 .45 1 1v5h-1V6H1v9h10v-2zM2 5h8c0-.55-.45-1-1-1H8c-.55 0-1-.45-1-1s-.45-1-1-1-1 .45-1 1-.45 1-1 1H3c-.55 0-1 .45-1 1z"></path></svg>
										</button>
									</div>

									<div class="form-control font-monospace mb-3" v-if="method.hasArrays">Decoded: {{ decodeURIComponent( renderParameters( method ) ) }}</div>

									<div class="alert alert-danger" v-if="method.hasArrays">⚠️ This method includes fields generated from protobufs, input_json was generated, which is very error prone. You may be able to get it to work by fiddling with the JSON manually. Please do not report issues when this doesn't work.</div>
								</div>

								<div class="table-responsive" v-if="method.parameters.length > 0">
									<table class="table table-sm table-bordered">
										<thead>
											<tr>
												<th>Name</th>
												<th style="width:13em">Value</th>
												<th>Type</th>
												<th>Required</th>
												<th>Description</th>
											</tr>
										</thead>
										<tbody>
											<ApiParameter
												v-for="parameter in method.parameters"
												:key="parameter.name"
												:method="method"
												:parameter="parameter"
												:methodName="methodName"
												:apiKeyFilled="hasValidAccessToken || hasValidWebApiKey"
												:addParamArray="addParamArray"
												:focusApiKey="focusApiKey"
												:level="0"
											/>
										</tbody>
									</table>
								</div>
							</form>
						</template>
					</div>
				</div>
			</div>
		</div>
</template>

<script src="./App.ts" lang="ts"></script>

<template>
	<div class="py-2 no-select header" role="banner">
		<div class="container">
			<div class="row">
				<div class="col-lg-3" role="search">
					<input
						v-model="currentFilter"
						type="search"
						class="search-input form-control me-sm-2"
						placeholder="Search methods…"
						aria-label="Search interfaces and methods"
						@keydown.up.prevent="navigateSidebar(-1)"
						@keydown.down.prevent="navigateSidebar(1)"
					>
				</div>
				<div class="col-lg-9">
					<h1><a href="#" @click.prevent="focusApikey">Steam Web API Documentation</a></h1>
					<span v-if="currentInterface !== ''" class="separator"> / </span>
					<h2 v-if="currentInterface !== ''">{{ currentInterface }}</h2>
					<span v-else> with &hearts; by <a href="https://xpaw.me">xPaw</a></span>
				</div>
			</div>
		</div>
	</div>

	<div class="container">
		<div class="row">
			<div class="col-lg-3 sidebar py-3" role="navigation">
				<details
					v-if="userData.favorites.size > 0 && !currentFilter"
					class="interface-list-container"
					open
				>
					<summary class="interface-group-name">Your favorites</summary>

					<ul class="interface-list m-0">
						<li
							v-for="favoriteMethod of userData.favorites"
							:key="favoriteMethod"
						>
							<a
								:href="'#' + favoriteMethod"
							>
								{{ favoriteMethod }}
							</a>
						</li>
					</ul>
				</details>

				<details
					v-for="[groupAppid, interfaceGroup] in sidebarInterfaces"
					class="interface-list-container"
					:open="interfaceGroup.open"
				>
					<summary class="interface-group-name">
						<img
							v-if="interfaceGroup.icon"
							:src="`icons/${interfaceGroup.icon}`"
							width="24"
							height="24"
							alt=""
							aria-hidden="true"
						>
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
							>
								{{ interfaceName }}
							</a>

							<ul
								v-if="currentFilter || interfaceName === currentInterface"
								class="method-list rounded mb-2 p-2"
							>
								<li
									v-for="(method, methodName) in interfaceMethods"
									:key="methodName"
								>
									<a
										:href="'#' + interfaceName + '/' + methodName"
										:class="method.isFavorite ? 'text-warning' : ''"
									>
										{{ methodName }}
									</a>
								</li>
							</ul>
						</li>
					</ul>
				</details>
			</div>

			<div class="col-lg-9 content py-3" role="main">
				<div v-if="currentInterface === '' && !currentFilter" class="interface">
					<div class="card">
						<div class="card-header">Settings</div>
						<div class="card-body row">
							<div class="mb-3 col-md-6">
								<a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener"
								   class="float-end">Get your key here</a>
								<label class="form-label" for="form-api-key">WebAPI key</label>
								<input
									v-model="userData.webapi_key"
									:type="keyInputType"
									:class="[
											'form-control',
											isFieldValid( 'webapi_key' ) ? 'is-valid' : 'is-invalid'
										]"
									id="form-api-key"
									placeholder="Your key (stored in your browser only)"
									autocomplete="off"
									@focus="keyInputType = 'text'"
									@blur="keyInputType = 'password'">
							</div>
							<div class="mb-3 col-md-6">
								<a
									href="#"
									class="float-end"
									@click="accessTokenVisible = !accessTokenVisible"
								>
									What is this?
								</a>
								<label class="form-label" for="form-access-token">Access token</label>
								<input
									v-model="userData.access_token"
									:type="keyInputType"
									:class="[
											'form-control',
											isFieldValid( 'access_token' ) ? 'is-valid' : 'is-invalid'
										]"
									id="form-access-token"
									placeholder="Your key (stored in your browser only)"
									autocomplete="off"
									@focus="keyInputType = 'text'"
									@blur="keyInputType = 'password'">
							</div>
							<div class="mb-3 col-md-6">
								<label class="form-label" for="form-format">Preferred output format</label>
								<select v-model="userData.format" class="form-select" id="form-format">
									<option value="json">JSON</option>
									<option value="vdf">VDF</option>
									<option value="xml">XML (not recommended)</option>
								</select>
							</div>
							<div class="mb-3 col-md-6">
								<a href="https://steamdb.info/calculator/" target="_blank" rel="noopener"
								   class="float-end">Get your id here</a>
								<label class="form-label" for="form-steamid">Pre-fill SteamID</label>
								<input
									v-model="userData.steamid"
									type="text"
									:class="[
										'form-control',
										isFieldValid( 'steamid' ) ? 'is-valid' : 'is-invalid'
									]"
									id="form-steamid"
									placeholder="Your SteamID, for example: 76561197960287930"
								>
							</div>
						</div>
					</div>

					<div v-if="accessTokenVisible" class="card mt-3">
						<div class="card-header bg-info text-dark">What is an access token?</div>
						<div class="card-body">
							<p>Some APIs work with OAuth access token, if you have one you can provide it here and it
								will be preferred over the webapi key.</p>
							<p>Here's how to get one:</p>
							<ul>
								<li>Open <a href="https://store.steampowered.com/points/shop/" target="_blank"
											rel="noopener">https://store.steampowered.com/points/shop/</a></li>
								<li>Run the following script:</li>
							</ul>
							<div class="input-group mb-3">
								<button
									class="btn btn-outline-primary pt-0"
									type="button"
									@click.prevent="copyUrl($event)"
								>
									<CopyIcon/>
								</button>
								<div class="form-control font-monospace h-auto">
									javascript:JSON.parse(application_config.dataset.loyaltystore).webapi_token
								</div>
							</div>
						</div>
					</div>

					<div class="card mt-3">
						<div class="card-header">What is this?</div>
						<div class="card-body">
							<p>This is a static page that is automatically generated from <a
								href="#ISteamWebAPIUtil/GetSupportedAPIList">GetSupportedAPIList</a> using public and
								publisher keys. Additionally service methods are parsed from Steam client's protobuf
								files.</p>
							<p>If you specify the web api key above, it will be stored in your browser, and will only be
								sent to Valve's API servers if you chose to do so.</p>
							<p>Type a value in the value field and click the execute button to perform an API request in
								your browser.</p>
							<hr>
							<p>This website is created and maintained by <a href="https://xpaw.me/">xPaw</a>. Use any
								APIs listed here at your own risk.<br>I do not know how all of them work, this page is
								simply a reference.</p>
							<p>If you know of an API that is not listed here, <a
								href="https://github.com/xPaw/SteamWebAPIDocumentation/blob/master/api_undocumented_methods.txt">make
								a pull request to the file of undocumented APIs</a>.</p>
							<p>Source code for this page <a href="https://github.com/xPaw/SteamWebAPIDocumentation">is
								also available on GitHub</a>.</p>
						</div>
					</div>

					<div class="card mt-3">
						<div class="card-header">Using the API</div>
						<div class="card-body">
							<p>The public Steamworks Web API is hosted on <code>https://api.steampowered.com</code> or
								<code>https://community.steam-api.com</code>.</p>
							<p>
								The public Web API host is accessible via HTTP (port 80) and HTTPS (port 443). Note that
								any requests using your publisher Web API key should be made over HTTPS.<br>
								This service is behind Akamai's edge cache, so the actual IP addresses you will see for
								the name will vary based on your location and on ongoing service changes.<br>
								The IPs can change rapidly and fluidly, so if your Web API calls are made through a
								firewall on outbound requests, read on.
							</p>
							<p>
								Steam also provides a partner-only Web API server hosted on <code>https://partner.steam-api.com</code>.
								The intent of this service is to have higher availability than
								the public host; you should use this service for all requests made from your secure
								servers. This host has some different properties than the public host:
							</p>
							<ul>
								<li>This host is only accessible via HTTPS.</li>
								<li>This host is not behind Akamai's edge cache.</li>
								<li>Every request to this host must be made with your publisher Web API key, even
									requests which would ordinarily not need a key.<br>
									Requests made without a valid publisher key will return a 403 error code.
								</li>
								<li>Requests generating 403 status codes will incur strict rate limits for the
									connecting IP. This is in an effort to ensure
									high availability. If you generate a sufficient number of requests within a certain
									time interval that return 403 status codes —
									either during testing, or by using a regular Web API key instead of your publisher
									key — the host will put your IP on a deny
									list for a while.
								</li>
							</ul>
							<p>You should not connect to the Web API servers by IP; use the DNS name.</p>
						</div>
					</div>

					<div class="card mt-3">
						<div class="card-header">Requests and responses</div>
						<div class="card-body">
							<p>Similiar to the Steamworks C++ API, the Web API has been divided into multiple interfaces
								that contain related methods. The URI format of each API request is: <code>https://api.steampowered.com/&lt;interface&gt;/&lt;method&gt;/&lt;method_version&gt;/</code>
							</p>

							<p>Steam supports returning Web API responses in multiple formats. By default, all responses
								are returned JSON encoded. However, each request can optionally contain a
								<code>format</code> parameter to specify the desired response format. The following
								values can be passed for this parameter: <code>xml</code>, <code>json</code>, and <code>vdf</code>.
							</p>
							<p>A flexible solution should be used to parse Web API results as each method may return
								results in an arbitrary order.</p>
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
							<ul
								v-for="(interfaceMethods, interfaceName) in interfaces"
								:key="interfaceName"
								class="list-group"
							>
								<li
									v-for="(method, methodName) in interfaceMethods"
									:key="methodName"
									class="list-group-item px-0"
								>
									<a :href="'#' + interfaceName + '/' + methodName">
										{{ interfaceName }}/{{ methodName }}
									</a>
									<div v-if="method.parameters.length > 0" class="text-info mt-1">
										{{ method.parameters.map(m => m.name).join(', ') }}
									</div>
								</li>
							</ul>
						</div>
					</div>
				</div>
				<div class="interface" v-else>
					<div class="alert no-email">
						This page is just a reference of all the known Steam APIs, I do not know how they work. Please
						do not email me with questions.
					</div>
					<div v-if="currentFilter" class="alert alert-success">
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
							<input
								v-if="hasValidAccessToken"
								v-model="userData.access_token"
								type="hidden"
								name="access_token"
							>
							<input
								v-if="!hasValidAccessToken && hasValidWebApiKey"
								v-model="userData.webapi_key"
								type="hidden"
								name="key"
							>
							<input
								v-if="userData.format !== 'json'"
								v-model="userData.format"
								type="hidden"
								name="format"
							>

							<div class="card-header p-0 d-flex">
								<div class="card-inner-header">
									<a class="badge bg-warning text-dark no-select"
									   v-if="method._type === 'publisher_only'"
									   :href="`https://partner.steamgames.com/doc/webapi/${currentInterface}#${methodName}`"
									   target="_blank" rel="noopener">PUBLISHER</a>
									<span
										v-if="method._type === 'undocumented'"
										class="badge bg-warning text-dark no-select"
									>
										UNDOCUMENTED
									</span>
									<span :class="method.httpmethod === 'GET' ? 'badge bg-success' : 'badge bg-danger'">
										{{ method.httpmethod }}
									</span>
									<a class="card-method-name"
									   :href="'#' + currentInterface + '/' + methodName">{{ methodName }}</a>
									<span
										v-if="method.version> 1"
										class="badge bg-primary badge-version"
									>
										v{{ method.version }}
									</span>
								</div>

								<div class="d-flex ms-auto">
									<button type="button" class="btn btn-link text-warning favorite-method"
											@click="favoriteMethod(method, methodName)">
										<FilledStarIcon v-if="method.isFavorite"/>
										<EmptyStarIcon v-if="!method.isFavorite"/>
									</button>
									<button type="submit" class="btn btn-primary use-method rounded-0">
										Execute
										<ExecuteIcon/>
									</button>
								</div>
							</div>

							<div class="card-body">
								<p v-if="method.description">{{ method.description }}</p>

								<div class="input-group mb-3">
									<div class="form-control font-monospace h-auto">
										{{ renderUri(methodName, method) }}{{ uriDelimeterBeforeKey }}
										<span :class="hasValidAccessToken ? 'hidden-token' : 'hidden-key'">
											{{ renderApiKey() }}
										</span>{{ renderParameters(method) }}
									</div>
									<button
										class="btn btn-outline-primary pt-0"
										type="button"
										@click.prevent="copyUrl($event)"
									>
										<CopyIcon/>
									</button>
								</div>
							</div>

							<div v-if="method.parameters.length > 0" class="table-responsive">
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
									<tr v-for="parameter in method.parameters" :key="parameter.name" class="attribute">
										<td class="font-monospace">
											<label
												class="form-control-label"
												:for="`param_${methodName}_${parameter.name}`"
											>
												{{ parameter.name }}
											</label>
											<button
												v-if="parameter.name.endsWith( '[0]' )"
												type="button"
												class="btn btn-secondary add-param-array"
												@click="addParamArray(method, parameter)">
												+
											</button>
										</td>
										<td class="font-monospace p-0">
											<a v-if="parameter.name === 'key'" class="prefilled-key" href="#"
											   @click.prevent="focusApikey">
												<span v-if="hasValidAccessToken || hasValidWebApiKey"
													  class="text-success">filled</span>
												<span v-else class="text-warning">fill…</span>
											</a>
											<div class="form-check form-switch m-2"
												 v-else-if="parameter.type === 'bool'">
												<input
													type="hidden"
													:name="parameter.name"
													:value="parameter._value"
													:disabled="!parameter.manuallyToggled"
												>
												<input
													v-model="parameter._value"
													type="checkbox"
													class="form-check-input"
													:id="`param_${methodName}_${parameter.name}`"
													:aria-label="parameter.name"
													@change="parameter.manuallyToggled = true"
												>
												<button
													v-if="parameter.manuallyToggled"
													class="btn btn-sm btn-danger py-0"
													type="button"
													@click="parameter.manuallyToggled = false; parameter._value = false;"
												>
													&times;
												</button>
											</div>
											<input
												v-else
												v-model="parameter._value"
												class="form-control border-0 rounded-0"
												placeholder="…"
												:name="parameter.name"
												:id="`param_${methodName}_${parameter.name}`"
											>
										</td>
										<td>{{ parameter.type }}</td>
										<td v-if="parameter.optional">No</td>
										<td v-else>
											<SuccessIcon/>
											Yes
										</td>
										<td>{{ parameter.description }}</td>
									</tr>
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

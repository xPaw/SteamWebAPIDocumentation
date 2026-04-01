<template>
		<header class="site-header">
			<div class="site-container header-inner">
				<button
					type="button"
					class="sidebar-toggle"
					:aria-expanded="sidebarOpen"
					aria-controls="sidebar-nav"
					aria-label="Toggle navigation menu"
					@click="toggleSidebar"
				>
					<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 5H3"/><path d="M10 12H3"/><path d="M10 19H3"/><circle cx="17" cy="15" r="3"/><path d="m21 19-1.9-1.9"/></svg>
				</button>
				<search class="header-search">
					<input
						ref="inputSearch"
						type="search"
						class="search-input"
						placeholder="Search methods… (type / to focus)"
						aria-label="Search interfaces and methods"
						@input="onSearchInput"
						@keydown.escape.prevent="inputSearch?.blur()"
						@keydown.up.prevent="navigateSidebar(-1)"
						@keydown.down.prevent="navigateSidebar(1)"
					>
				</search>
				<div class="header-title" v-if="currentInterface !== ''" itemscope itemtype="https://schema.org/BreadcrumbList">
					<span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
						<h2><AppLink :href="'/' + currentInterface" itemprop="item"><span itemprop="name">{{ currentInterface }}</span></AppLink></h2>
						<meta itemprop="position" content="2">
					</span>
					<span class="separator"> / </span>
					<span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
						<h1><AppLink href="/" itemprop="item"><span itemprop="name">Steam Web API Documentation</span></AppLink></h1>
						<meta itemprop="position" content="1">
					</span>
					<span class="credit"> by <a href="https://xpaw.me">xPaw</a></span>
				</div>
				<div class="header-title" v-else>
					<h1><AppLink href="/">Steam Web API Documentation</AppLink></h1>
					<span class="credit"> with &hearts; by <a href="https://xpaw.me">xPaw</a></span>
				</div>
			</div>
		</header>

		<div class="site-container">
			<div class="site-layout">
				<nav class="sidebar" :class="{ 'is-open': sidebarOpen }" aria-label="API interfaces" ref="sidebar" id="sidebar-nav">
					<div class="sidebar-header">
						<button
							type="button"
							class="sidebar-close"
							aria-label="Close navigation menu"
							@click="closeSidebar"
						>
							<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
						</button>
						<search class="sidebar-search">
							<input
								type="search"
								class="search-input"
								placeholder="Search methods…"
								aria-label="Search interfaces and methods"
								@input="onSearchInput"
								@keydown.escape.prevent="closeSidebar"
								@keydown.up.prevent="navigateSidebar(-1)"
								@keydown.down.prevent="navigateSidebar(1)"
							>
						</search>
					</div>
					<details class="interface-list-container" open v-if="userData.favorites.size > 0 && !currentFilter">
						<summary class="interface-group-name">Your favorites</summary>

						<ul class="interface-list">
							<li
								v-for="favoriteMethod of userData.favorites"
								:key="favoriteMethod"
							>
								<AppLink
									:href="`/${favoriteMethod.replace('/', '#')}`"
								>{{ favoriteMethod }}</AppLink>
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

						<ul class="interface-list">
							<li
								v-for="(interfaceMethods, interfaceName) in interfaceGroup.methods"
								:key="interfaceName"
							>
								<AppLink
									:href="'/' + interfaceName"
									:class="interfaceName === currentInterface ? 'is-active' : ''"
								>{{ interfaceName }}</AppLink>

								<ul class="method-list" v-if="currentFilter || interfaceName === currentInterface">
									<li
										v-for="(method, methodName) in interfaceMethods"
										:key="methodName"
									>
										<AppLink
											:href="'/' + interfaceName + '#' + methodName"
											:class="method.isFavorite ? 'is-favorite' : ''"
										>
											<HighlightedSearchMethod :method="methodName" :indices="method.highlight" v-if="method.highlight?.length" />
											<template v-else>{{ methodName }}</template>
										</AppLink>
									</li>
								</ul>
							</li>
						</ul>
					</details>
				</nav>

				<main class="content">
					<div class="interface" v-if="currentInterface === '' && !currentFilter">
						<div class="card">
							<div class="card-header">Settings</div>
							<div class="settings-grid">
								<div class="settings-field">
									<label class="field-label" for="form-api-key">WebAPI key <a href="https://steamcommunity.com/dev/apikey" target="_blank">Get your key here</a></label>
									<input
										:type="keyInputType"
										:class="[
											'field-input',
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
								<div class="settings-field">
									<label class="field-label" for="form-access-token">
										Access token
										<span v-if="accessTokenExpiration > 0">expires on {{formatAccessTokenExpirationDate}}</span>
										<a href="#" @click.prevent="accessTokenVisible = !accessTokenVisible">How to get it</a>
									</label>
									<input
										:type="keyInputType"
										:class="[
											'field-input',
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
								<div class="settings-field">
									<label class="field-label" for="form-format">Preferred output format</label>
									<select class="field-select" id="form-format" v-model="userData.format">
										<option value="json">JSON</option>
										<option value="vdf">VDF</option>
										<option value="xml">XML (not recommended)</option>
									</select>
								</div>
								<div class="settings-field">
									<label class="field-label" for="form-steamid">Pre-fill SteamID <a href="https://steamdb.info/calculator/" target="_blank">Get your id here</a></label>
									<input type="text" :class="[
										'field-input',
										isFieldValid( 'steamid' ) ? 'is-valid' : 'is-invalid'
									]" id="form-steamid" placeholder="Your SteamID, for example: 76561197960287930" v-model="userData.steamid">
								</div>
							</div>
						</div>

						<div class="card" v-if="accessTokenVisible">
							<div class="card-header card-header-info">What is an access token?</div>
							<div class="card-body">
								<p>Some APIs work with access tokens, if you have one you can provide it here and it will be preferred over the webapi key.</p>
								<p v-if="accessTokenAudience.length > 0">Currently entered token is for <span class="badge badge-accent" v-for="aud in accessTokenAudience" :key="aud">{{ aud }}</span> with steamid {{ accessTokenSteamId }} and expires on {{ formatAccessTokenExpirationDate }}.</p>
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

						<HomePage />
					</div>
					<div class="interface" v-else>
						<aside class="notice-banner">
							This page is just a reference of all the known Steam APIs, I do not know how they work. Please do not email me with questions.
						</aside>
						<div class="filter-banner" v-if="currentFilter">
							<a href="#" @click.prevent="currentFilter = ''">Click here to reset filtered results.</a>
							Use arrows keys in search field to navigate.
						</div>
						<template v-for="(method, methodName) in currentInterfaceMethods" :key="methodName">
							<form
								target="_blank"
								:id="String(methodName)"
								:method="method.httpmethod || 'GET'"
								:action="renderUri(String(methodName), method)"
								class="card"
								@submit="useThisMethod($event, method)"
							>
								<input type="hidden" name="access_token" v-model="userData.access_token" v-if="hasValidAccessToken">
								<input type="hidden" name="key" v-model="userData.webapi_key" v-if="!hasValidAccessToken && hasValidWebApiKey">
								<input type="hidden" name="format" v-model="userData.format" v-if="userData.format !== 'json'">

								<div class="method-header">
									<div class="method-header-info">
										<a class="badge badge-publisher" v-if="method._type === 'publisher_only'" :href="`https://partner.steamgames.com/doc/webapi/${currentInterface}#${methodName}`" target="_blank">PUBLISHER</a>
										<span class="badge badge-undocumented" v-if="method._type === 'undocumented'">UNDOCUMENTED</span>
										<span :class="method.httpmethod === 'GET' ? 'badge badge-get' : 'badge badge-post'" v-if="method.httpmethod">{{ method.httpmethod }}</span>
										<h3 class="method-name"><a :href="'#' + methodName">{{ methodName }}</a></h3>
										<span class="badge badge-version" v-if="method.version > 1">v{{ method.version }}</span>
									</div>

									<div class="method-actions">
										<button type="button" class="favorite-btn" aria-label="Toggle favorite" @click="favoriteMethod(method, String(methodName))">
											<svg aria-hidden="true" viewBox="0 0 16 16" width="24" height="24" v-if="method.isFavorite"><path fill="currentColor" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>
											<svg aria-hidden="true" viewBox="0 0 16 16" width="24" height="24" v-if="!method.isFavorite"><path fill="currentColor" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z"></path></svg>
										</button>
										<button type="submit" class="execute-btn">
											Execute
											<svg aria-hidden="true" viewBox="0 0 416 512" height="16"><path fill="currentColor" d="M272 96c26.51 0 48-21.49 48-48S298.51 0 272 0s-48 21.49-48 48 21.49 48 48 48zM113.69 317.47l-14.8 34.52H32c-17.67 0-32 14.33-32 32s14.33 32 32 32h77.45c19.25 0 36.58-11.44 44.11-29.09l8.79-20.52-10.67-6.3c-17.32-10.23-30.06-25.37-37.99-42.61zM384 223.99h-44.03l-26.06-53.25c-12.5-25.55-35.45-44.23-61.78-50.94l-71.08-21.14c-28.3-6.8-57.77-.55-80.84 17.14l-39.67 30.41c-14.03 10.75-16.69 30.83-5.92 44.86s30.84 16.66 44.86 5.92l39.69-30.41c7.67-5.89 17.44-8 25.27-6.14l14.7 4.37-37.46 87.39c-12.62 29.48-1.31 64.01 26.3 80.31l84.98 50.17-27.47 87.73c-5.28 16.86 4.11 34.81 20.97 40.09 3.19 1 6.41 1.48 9.58 1.48 13.61 0 26.23-8.77 30.52-22.45l31.64-101.06c5.91-20.77-2.89-43.08-21.64-54.39l-61.24-36.14 31.31-78.28 20.27 41.43c8 16.34 24.92 26.89 43.11 26.89H384c17.67 0 32-14.33 32-32s-14.33-31.99-32-31.99z"></path></svg>
										</button>
									</div>
								</div>

								<div class="card-body">
									<p v-if="method.description">{{ method.description }}</p>

									<div class="url-display">
										<div class="url-text">{{ renderUri(String(methodName), method) }}{{ uriDelimeterBeforeKey }}<span :class="hasValidAccessToken ? 'hidden-token' : 'hidden-key'">{{ renderApiKey() }}</span>{{ renderParameters( method ) }}</div>
										<button class="copy-btn" type="button" aria-label="Copy URL" @click.prevent="copyUrl($event)">
											<svg aria-hidden="true" viewBox="0 0 14 16" version="1.1" width="14" height="16"><path fill-rule="evenodd" d="M2 13h4v1H2v-1zm5-6H2v1h5V7zm2 3V8l-3 3 3 3v-2h5v-2H9zM4.5 9H2v1h2.5V9zM2 12h2.5v-1H2v1zm9 1h1v2c-.02.28-.11.52-.3.7-.19.18-.42.28-.7.3H1c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h3c0-1.11.89-2 2-2 1.11 0 2 .89 2 2h3c.55 0 1 .45 1 1v5h-1V6H1v9h10v-2zM2 5h8c0-.55-.45-1-1-1H8c-.55 0-1-.45-1-1s-.45-1-1-1-1 .45-1 1-.45 1-1 1H3c-.55 0-1 .45-1 1z"></path></svg>
										</button>
									</div>

									<div class="url-decoded" v-if="method.hasArrays">Decoded: {{ decodeURIComponent( renderParameters( method ) ) }}</div>

									<div class="array-warning" v-if="method.hasArrays">⚠️ This method includes fields generated from protobufs, input_json was generated, which is very error prone. You may be able to get it to work by fiddling with the JSON manually. Please do not report issues when this doesn't work.</div>
								</div>

								<div class="params-table-wrap" v-if="method.parameters.length > 0">
									<table class="params-table">
										<thead>
											<tr>
												<th>Name</th>
												<th class="value-column">Value</th>
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
				</main>
			</div>
		</div>
</template>

<script src="./App.ts" lang="ts"></script>

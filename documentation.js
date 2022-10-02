(async () =>
{
	const apiFetch = await fetch( 'api.json' );
	const interfaces = await apiFetch.json();

	const flattenedMethods = [];

	for( const interfaceName in interfaces )
	{
		for( const methodName in interfaces[ interfaceName ] )
		{
			const method = interfaces[ interfaceName ][ methodName ];

			for( const parameter of method.parameters )
			{
				parameter._value = '';

				if( parameter.type === 'bool' )
				{
					parameter.manuallyToggled = false;
				}
			}

			flattenedMethods.push( {
				interface: interfaceName,
				method: methodName,
			} );
		}
	}

	const fuzzy = new Fuse( flattenedMethods, {
		shouldSort: true,
		useExtendedSearch: true,
		threshold: 0.3,
		keys: [ {
			name: 'interface',
			weight: 0.3
		}, {
			name: 'method',
			weight: 0.7
		} ]
	} );

	const app = new Vue({
		el: '#app',
		data:
		{
			userData:
			{
				webapi_key: '',
				access_token: '',
				steamid: '',
				format: 'json',
			},
			keyInputType: 'password',
			hasValidWebApiKey: false,
			hasValidAccessToken: false,
			accessTokenVisible: false,
			currentFilter: '',
			currentInterface: null,
			skipInterfaceSet: false,
			interfaces: interfaces,
		},
		watch:
		{
			"userData.format"( value )
			{
				localStorage.setItem( 'format', value );
			},
			"userData.webapi_key"( value )
			{
				if( this.isFieldValid( 'webapi_key' ) )
				{
					localStorage.setItem( 'webapi_key', value );
				}
				else
				{
					localStorage.removeItem( 'webapi_key' );
				}
			},
			"userData.access_token"( value )
			{
				if( this.isFieldValid( 'access_token' ) )
				{
					localStorage.setItem( 'access_token', value );
				}
				else
				{
					localStorage.removeItem( 'access_token' );
				}
			},
			"userData.steamid"( value )
			{
				if( this.isFieldValid( 'steamid' ) )
				{
					localStorage.setItem( 'steamid', value );

					fillSteamidParameter();
				}
				else
				{
					localStorage.removeItem( 'steamid' );
				}
			},
			currentInterface( newInterface )
			{
				if( newInterface )
				{
					document.title = `${newInterface} – Steam Web API Documentation`;
				}
				else
				{
					document.title = `Steam Web API Documentation`;
				}

				if( this.skipInterfaceSet )
				{
					this.skipInterfaceSet = false;

					return;
				}

				history.replaceState( '', '', '#' + newInterface );
			},
			currentFilter( newFilter, oldFilter )
			{
				if( !newFilter )
				{
					this.$nextTick( this.scrollInterfaceIntoView );
				}
				else
				{
					this.currentInterface = '';

					if( !oldFilter )
					{
						document.querySelector( '.sidebar' ).scrollTop = 0;
					}
				}
			}
		},
		mounted()
		{
			this.userData.webapi_key = localStorage.getItem( 'webapi_key' ) || '';
			this.userData.access_token = localStorage.getItem( 'access_token' ) || '';
			this.userData.steamid = localStorage.getItem( 'steamid' ) || '';
			this.userData.format = localStorage.getItem( 'format' ) || 'json';

			document.getElementById( 'loading' ).remove();
		},
		computed:
		{
			filteredInterfaces()
			{
				if( !this.currentFilter )
				{
					return interfaces;
				}

				const matches = fuzzy.search( this.currentFilter.replace( '/', '|' ) );
				const matchedInterfaces = {};

				for( const searchResult of matches )
				{
					const match = searchResult.item;

					if( !matchedInterfaces[ match.interface ] )
					{
						matchedInterfaces[ match.interface ] = {};
					}

					matchedInterfaces[ match.interface ][ match.method ] = this.interfaces[ match.interface ][ match.method ];
				}

				return matchedInterfaces;
			},
			interface()
			{
				return this.filteredInterfaces[ this.currentInterface ];
			},
			uriDelimeterBeforeKey()
			{
				return this.hasValidAccessToken || this.hasValidWebApiKey ? '?' : '';
			},
		},
		methods:
		{
			isFieldValid( field )
			{
				switch( field )
				{
					case 'access_token':
						this.hasValidAccessToken = /^[0-9a-f]{32}$/i.test( this.userData[ field ] );
						return this.hasValidAccessToken;

					case 'webapi_key':
						this.hasValidWebApiKey = /^[0-9a-f]{32}$/i.test( this.userData[ field ] );
						return this.hasValidWebApiKey;

					case 'steamid':
						return /^[0-9]{17}$/.test( this.userData[ field ] );
				}
			},
			renderUri( methodName, method )
			{
				let host = 'https://api.steampowered.com/';
				let version = method.version;

				if( method._type === 'publisher_only' )
				{
					host = 'https://partner.steam-api.com/';
				}

				return `${host}${this.currentInterface}/${methodName}/v${version}/`;
			},
			renderApiKey()
			{
				const parameters = new URLSearchParams();

				if( this.hasValidAccessToken )
				{
					parameters.set( 'access_token', this.userData.access_token );
				}
				else if( this.hasValidWebApiKey )
				{
					parameters.set( 'key', this.userData.webapi_key );
				}

				return parameters.toString();
			},
			renderParameters( method )
			{
				const parameters = new URLSearchParams();

				if( this.userData.format !== 'json' )
				{
					parameters.set( 'format', this.userData.format );
				}

				for( const parameter of method.parameters )
				{
					if( !parameter._value && !parameter.manuallyToggled )
					{
						continue;
					}

					parameters.set( parameter.name, parameter._value );
				}

				const str = parameters.toString();

				if( str.length === 0 )
				{
					return '';
				}

				if( this.uriDelimeterBeforeKey )
				{
					return `&${str}`;
				}

				return `?${str}`;
			},
			useThisMethod( event, method )
			{
				if( method.httpmethod === 'POST' && !confirm(
					'Executing POST requests could be potentially disastrous.\n\n'
					+ 'Author is not responsible for any damage done.\n\n'
					+ 'Are you sure you want to continue?'
				) )
				{
					event.preventDefault();
				}

				for( const field of event.target.elements )
				{
					if( !field.value && !field.disabled && field.tagName === "INPUT" )
					{
						field.disabled = true;

						setTimeout( () => field.disabled = false, 0 );
					}
				}
			},
			setMethod( interfaceName, methodName )
			{
				this.skipInterfaceSet = true;
				this.currentInterface = interfaceName;

				if( methodName )
				{
					this.$nextTick( () =>
					{
						const element = document.getElementById( methodName );

						if( element )
						{
							element.scrollIntoView();
						}
					} );
				}
			},
			addParamArray( method, parameter )
			{
				if( !parameter._counter )
				{
					parameter._counter = 1;
				}
				else
				{
					parameter._counter++;
				}

				const newParameter =
				{
					name: `${parameter.name.substring( 0, parameter.name.length - 3 )}[${parameter._counter}]`,
					optional: true,
				};

				const parameterIndex = method.parameters.findIndex( param => param.name === parameter.name );
				method.parameters.splice( parameterIndex + parameter._counter, 0, newParameter );
			},
			scrollInterfaceIntoView()
			{
				const element = document.querySelector( `.interface-list a[href="#${this.currentInterface}"]` );

				if( element )
				{
					element.scrollIntoView();
				}
			},
			copyUrl( event )
			{
				const element = event.target.closest( '.input-group' ).querySelector( '.form-control' );
				const selection = window.getSelection();
				const range = document.createRange();
				range.selectNodeContents( element );
				selection.removeAllRanges();
				selection.addRange( range );
				document.execCommand( 'copy' );
			},
			updateUrl( method )
			{
				history.replaceState( '', '', '#' + this.currentInterface + '/' + method );
			},
			navigateSidebar( direction )
			{
				const keys = Object.keys( this.filteredInterfaces );

				const size = keys.length;
				index = keys.indexOf( this.currentInterface ) + direction;

				this.currentInterface = keys[ ( ( index % size ) + size ) % size ];
				this.scrollInterfaceIntoView();
			},
			focusApikey()
			{
				this.currentInterface = '';

				this.$nextTick( () =>
				{
					const element = document.getElementById( this.hasValidAccessToken ? 'form-access-token' : 'form-api-key' );

					if( element )
					{
						element.focus();
					}
				} );
			}
		},
	});

	fillSteamidParameter();
	setInterface();
	window.addEventListener( 'hashchange', setInterface, false );

	if( 'serviceWorker' in navigator )
	{
		navigator.serviceWorker.register( 'serviceworker.js', { scope: './' } );
	}

	function setInterface()
	{
		let currentInterface = location.hash;
		let currentMethod = '';

		if( currentInterface[ 0 ] === '#' )
		{
			const split = currentInterface.substring( 1 ).split( '/', 2 );
			currentInterface = split[ 0 ];

			if( split[ 1 ] )
			{
				currentMethod = split[ 1 ];
			}
		}

		if( !interfaces.hasOwnProperty( currentInterface ) )
		{
			currentInterface = '';
			currentMethod = '';
		}
		else if( !interfaces[ currentInterface ].hasOwnProperty( currentMethod ) )
		{
			currentMethod = '';
		}

		app.setMethod( currentInterface, currentMethod );
		app.scrollInterfaceIntoView();
	}

	function fillSteamidParameter()
	{
		for( const interfaceName in interfaces )
		{
			for( const methodName in interfaces[ interfaceName ] )
			{
				for( const parameter of interfaces[ interfaceName ][ methodName ].parameters )
				{
					if( !parameter._value && parameter.name.includes( 'steamid' ) )
					{
						parameter._value = app.userData.steamid;
					}
				}
			}
		}
	}
})();

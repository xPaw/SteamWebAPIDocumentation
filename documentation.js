(async () =>
{
	const apiFetch = await fetch( 'api.json' );
	const interfaces = await apiFetch.json();

	const flattenedMethods = [];

	for( const interfaceName in interfaces )
	{
		for( const methodName in interfaces[ interfaceName ] )
		{
			if( interfaces[ interfaceName ][ methodName ]._type === 'undocumented' )
			{
				interfaces[ interfaceName ][ methodName ].description =
					'This method is undocumented and most likely is not supported by Valve, use at your own risk.';
			}

			if( interfaces[ interfaceName ][ methodName ].parameters )
			{
				for( const parameter of interfaces[ interfaceName ][ methodName ].parameters )
				{
					parameter._value = '';
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
		threshold: 0.5,
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
				steamid: '',
				format: 'json',
			},
			currentFilter: '',
			currentInterface: null,
			interfaces: interfaces,
		},
		watch:
		{
			currentInterface( newInterface )
			{
				history.replaceState( '', '', '#' + newInterface );
			},
		},
		computed:
		{
			filteredInterfaces()
			{
				if( !this.currentFilter )
				{
					return interfaces;
				}

				const matches = fuzzy.search( this.currentFilter );
				const matchedInterfaces = {};

				for( const match of matches )
				{
					if( !matchedInterfaces[ match.interface ] )
					{
						matchedInterfaces[ match.interface ] = {};
					}

					matchedInterfaces[ match.interface ][ match.method ] = this.interfaces[ match.interface ][ match.method ];
				}

				this.currentInterface = matches.length > 0 ? matches[ 0 ].interface : '';

				return matchedInterfaces;
			},
			interface()
			{
				return this.filteredInterfaces[ this.currentInterface ];
			},
			sidebarInterfaces()
			{
				const sidebar = [];

				for( const interfaceName in this.filteredInterfaces )
				{
					sidebar.push( {
						name: interfaceName,
						size: Object.keys( this.filteredInterfaces[ interfaceName ] ).length,
					} );
				}

				return sidebar;
			},
		},
		methods:
		{
			renderParameters( method )
			{
				const parameters = new URLSearchParams();
				parameters.set( 'key', this.userData.webapi_key );

				if( this.userData.format !== 'json' )
				{
					parameters.set( 'format', this.userData.format );
				}

				if( method.parameters )
				{
					for( const parameter of method.parameters )
					{
						if( !parameter._value )
						{
							continue;
						}

						parameters.set( parameter.name, parameter.type === 'bool' ? 1 : parameter._value );
					}
				}

				return '?' + parameters.toString();
			},
			useThisMethod( method )
			{
				if( method.httpmethod !== 'GET' )
				{
					return alert( 'Only GET for now' );
				}
			},
			copyUrl( event )
			{
				event.target.closest( '.input-group' ).querySelector( 'input' ).select();
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
			},
			scrollIntoView()
			{
				if( window.innerWidth > 991 )
				{
					return;
				}

				this.$nextTick( () =>
				{
					if( this.$refs.interfaceView )
					{
						this.$refs.interfaceView.scrollIntoView( {
							behavior: "smooth",
							block: "start",
						} );
					}
				} );
			}
		},
	});

	setInterface();
	window.addEventListener( 'hashchange', setInterface, false );

	function setInterface()
	{
		let currentInterface = location.hash;

		if( currentInterface[ 0 ] === '#' )
		{
			currentInterface = currentInterface.substring( 1 ).split( '/', 1 )[ 0 ];
		}

		if( !interfaces.hasOwnProperty( currentInterface ) )
		{
			currentInterface = '';
		}

		app.currentInterface = currentInterface;
	}
})();

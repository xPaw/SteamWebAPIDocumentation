<?php

if( getenv( 'CI' ) !== false )
{
	$PublicApiKey    = getenv( 'STEAM_PUBLIC_API_KEY' );
	$PublisherApiKey = getenv( 'STEAM_PUBLISHER_API_KEY' );
}
else
{
	require __DIR__ . '/config.php';
}

echo 'Downloading list...' . PHP_EOL;

$c = curl_init( );

curl_setopt_array( $c,
[
	CURLOPT_TIMEOUT        => 10,
	CURLOPT_RETURNTRANSFER => true,
	CURLOPT_USERAGENT      => '',
	CURLOPT_URL            => 'https://community.steam-api.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?format=json&key=' . $PublicApiKey
] );
unset( $PublicApiKey );
$NonPublisher = curl_exec( $c );

echo 'Downloading partner list...' . PHP_EOL;

curl_setopt( $c, CURLOPT_URL, 'https://partner.steam-api.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?format=json&key=' . $PublisherApiKey );
unset( $PublisherApiKey );
$YesPublisher = curl_exec( $c );

$Undocumented = [];

if( file_exists( __DIR__ . '/api_undocumented_methods.txt' ) )
{
	foreach( file( __DIR__ . '/api_undocumented_methods.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES ) as $Method )
	{
		[ $UndocumentedInterface, $UndocumentedMethod, $UndocumentedVersion ] = explode( '/', $Method, 3 );

		if( !isset( $Undocumented[ $UndocumentedInterface ] ) )
		{
			$Undocumented[ $UndocumentedInterface ] =
			[
				'name' => $UndocumentedInterface,
				'methods' => [],
			];
		}

		$Undocumented[ $UndocumentedInterface ][ 'methods' ][] =
		[
			'name' => $UndocumentedMethod,
			'version' => (int)substr( $UndocumentedVersion, 1 ),
		];
	}
}

echo 'Generating...' . PHP_EOL;

$YesPublisher = json_decode( $YesPublisher, true, 512, JSON_THROW_ON_ERROR );
$YesPublisher = $YesPublisher[ 'apilist' ][ 'interfaces' ] ?? [];

$NonPublisher = json_decode( $NonPublisher, true, 512, JSON_THROW_ON_ERROR );
$NonPublisher = $NonPublisher[ 'apilist' ][ 'interfaces' ] ?? [];

if( file_exists( __DIR__ . '/api_from_protos.json' ) )
{
	$UndocumentedFromServices = json_decode( file_get_contents( __DIR__ . '/api_from_protos.json' ), true, 512, JSON_THROW_ON_ERROR );
}
else
{
	$UndocumentedFromServices = [];
}

if( file_exists( __DIR__ . '/api_from_docs.json' ) )
{
	$UndocumentedFromPartnerDocs = json_decode( file_get_contents( __DIR__ . '/api_from_docs.json' ), true, 512, JSON_THROW_ON_ERROR );
}
else
{
	$UndocumentedFromPartnerDocs = [];
}

$FinalList = file_exists( __DIR__ . '/api.json' ) ? json_decode( file_get_contents( __DIR__ . '/api.json' ), true, 512, JSON_THROW_ON_ERROR ) : [];

MarkAsRemoved( $FinalList );
MergeLists( $FinalList, $NonPublisher );
MergeLists( $FinalList, $YesPublisher, 'publisher_only' );
MergeLists( $FinalList, $Undocumented, 'undocumented' );
MergeLists( $FinalList, $UndocumentedFromPartnerDocs, 'undocumented' );
MergeLists( $FinalList, $UndocumentedFromServices, 'undocumented' );

$MethodKeysOrder =
[
	'_type' => 0,
	'version' => 1,
	'httpmethod' => 2,
	'description' => 3,
	'parameters' => 4,
];

foreach( $FinalList as $InterfaceName => $Interface )
{
	foreach( $Interface as $MethodName => $Method )
	{
		if( !isset( $Method[ 'parameters' ] ) )
		{
			$FinalList[ $InterfaceName ][ $MethodName ][ 'parameters' ] = [];
		}

		uksort( $FinalList[ $InterfaceName ][ $MethodName ], function( string $a, string $b ) use( $MethodKeysOrder ) : int
		{
			return $MethodKeysOrder[ $a ] - $MethodKeysOrder[ $b ];
		} );
	}
}

if( file_exists( __DIR__ . '/api_type_overrides.json' ) )
{
	$ParameterTypeOverrides = json_decode( file_get_contents( __DIR__ . '/api_type_overrides.json' ), true, 512, JSON_THROW_ON_ERROR );

	foreach( $FinalList as $InterfaceName => &$Interface )
	{
		foreach( $Interface as $MethodName => &$Method )
		{
			foreach( $Method[ 'parameters' ] as &$Parameter )
			{
				$Key = "{$InterfaceName}/{$MethodName}/{$Parameter[ 'name' ]}";

				if( isset( $ParameterTypeOverrides[ $Key ] ) )
				{
					$Parameter[ 'type' ] = $ParameterTypeOverrides[ $Key ];

					if( str_ends_with( $Parameter[ 'type' ], '[]' ) && !str_ends_with( $Parameter[ 'name' ], '[0]' ) )
					{
						$Parameter[ 'name' ] .= '[0]';
					}
				}
				else if( str_ends_with( $Parameter[ 'name' ], '[0]' ) && !str_ends_with( $Parameter[ 'type' ], '[]' ) )
				{
					$Parameter[ 'type' ] .= '[]';
				}

				if( isset( $Parameter[ 'description' ] ) && stripos( $Parameter[ 'description' ], '(Optional) ' ) === 0 )
				{
					$Parameter[ 'optional' ] = true;
					$Parameter[ 'description' ] = substr( $Parameter[ 'description' ], 11 );
				}
			}

			unset( $Parameter );
		}

		unset( $Method );
	}

	unset( $Interface );
}

ksort( $FinalList, SORT_NATURAL );

foreach( $FinalList as &$Interface )
{
	ksort( $Interface, SORT_NATURAL );
}

unset( $Interface );

file_put_contents(
	__DIR__ . DIRECTORY_SEPARATOR . 'api.json',
	json_encode( $FinalList, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL
);

echo 'Done' . PHP_EOL;

function MergeLists( array &$FinalList, array $Interfaces, ?string $Type = null ) : void
{
	foreach( $Interfaces as $Interface )
	{
		$InterfaceName = $Interface[ 'name' ];

		if( !isset( $FinalList[ $InterfaceName ] ) )
		{
			$FinalList[ $InterfaceName ] = [];
		}

		foreach( $Interface[ 'methods' ] as $Method )
		{
			$MethodName = $Method[ 'name' ];
			$CurrentVersion = $FinalList[ $InterfaceName ][ $MethodName ][ 'version' ] ?? 0;
			$CurrentType = $FinalList[ $InterfaceName ][ $MethodName ][ '_type' ] ?? null;

			if( $CurrentVersion >= $Method[ 'version' ] && $CurrentType !== 'undocumented' )
			{
				continue;
			}

			if( $CurrentType === 'undocumented' && $CurrentType === $Type )
			{
				if( !empty( $Method[ 'description' ] ) && empty( $FinalList[ $InterfaceName ][ $MethodName ][ 'description' ] ) )
				{
					$FinalList[ $InterfaceName ][ $MethodName ][ 'description' ] = $Method[ 'description' ];
				}

				if( !empty( $Method[ 'parameters' ] ) )
				{
					foreach( $Method[ 'parameters' ] as $Parameter )
					{
						$Found = false;

						foreach( $FinalList[ $InterfaceName ][ $MethodName ][ 'parameters' ] as $ParameterId => $CurrentParameter )
						{
							if( $Parameter[ 'name' ] === $CurrentParameter[ 'name' ] )
							{
								$Found = true;

								if( !empty( $Parameter[ 'description' ] ) && empty( $CurrentParameter[ 'description' ] ) )
								{
									$FinalList[ $InterfaceName ][ $MethodName ][ 'parameters' ][ $ParameterId ][ 'description' ] = $Parameter[ 'description' ];
								}

								break;
							}
						}

						if( !$Found )
						{
							$FinalList[ $InterfaceName ][ $MethodName ][ 'parameters' ][] = $Parameter;
						}
					}
				}

				continue;
			}

			unset( $Method[ 'name' ] );

			if( $Type !== null )
			{
				$Method[ '_type' ] = $Type;
			}

			$FinalList[ $InterfaceName ][ $MethodName ] = $Method;
		}
	}
}

function MarkAsRemoved( array &$FinalList ) : void
{
	foreach( $FinalList as &$Interface )
	{
		foreach( $Interface as &$Method )
		{
			$Method[ '_type' ] = 'undocumented';
		}
	}
}

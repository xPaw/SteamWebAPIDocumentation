<?php

require __DIR__ . '/config.php';

echo 'Downloading list...' . PHP_EOL;

$c = curl_init( );

curl_setopt_array( $c,
[
	CURLOPT_TIMEOUT        => 10,
	CURLOPT_RETURNTRANSFER => true,
	CURLOPT_USERAGENT      => '',
	CURLOPT_URL            => 'https://community.steam-api.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?format=json&key=' . $PublicApiKey
] );
$NonPublisher = curl_exec( $c );

echo 'Downloading partner list...' . PHP_EOL;

curl_setopt( $c, CURLOPT_URL, 'https://partner.steam-api.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?format=json&key=' . $PublisherApiKey );
$YesPublisher = curl_exec( $c );

echo 'Downloading undocumented list...' . PHP_EOL;

curl_setopt( $c, CURLOPT_URL, 'https://raw.githubusercontent.com/SteamDatabase/UndocumentedAPI/master/api.json' );
$Undocumented = curl_exec( $c );

curl_close( $c );

echo 'Generating...' . PHP_EOL;

$YesPublisher = json_decode( $YesPublisher, true );
$YesPublisher = $YesPublisher[ 'apilist' ][ 'interfaces' ] ?? [];

$NonPublisher = json_decode( $NonPublisher, true );
$NonPublisher = $NonPublisher[ 'apilist' ][ 'interfaces' ] ?? [];

$Undocumented = json_decode( $Undocumented, true );
$Undocumented = $Undocumented[ 'apilist' ][ 'interfaces' ] ?? [];

if( file_exists( __DIR__ . '/api_from_protos.json' ) )
{
	$UndocumentedFromServices = json_decode( file_get_contents( __DIR__ . '/api_from_protos.json' ), true );
}
else
{
	$UndocumentedFromServices = [];
}

if( file_exists( __DIR__ . '/api_from_docs.json' ) )
{
	$UndocumentedFromPartnerDocs = json_decode( file_get_contents( __DIR__ . '/api_from_docs.json' ), true );
}
else
{
	$UndocumentedFromPartnerDocs = [];
}

$FinalList = file_exists( __DIR__ . '/api.json' ) ? json_decode( file_get_contents( __DIR__ . '/api.json' ), true ) : [];

MarkAsRemoved( $FinalList );
MergeLists( $FinalList, $NonPublisher );
MergeLists( $FinalList, $YesPublisher, 'publisher_only' );
MergeLists( $FinalList, $UndocumentedFromServices, 'protobufs' );
MergeLists( $FinalList, $UndocumentedFromPartnerDocs, 'undocumented' );
MergeLists( $FinalList, $Undocumented, 'undocumented' );

$MethodKeysOrder =
[
	'version' => 1,
	'httpmethod' => 2,
	'description' => 3,
	'parameters' => 4,
	'_type' => 9,
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
	$ParameterTypeOverrides = json_decode( file_get_contents( __DIR__ . '/api_type_overrides.json' ), true );

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

<?php

require __DIR__ . '/config.php';

$c = curl_init( );

curl_setopt_array( $c,
[
	CURLOPT_TIMEOUT        => 10,
	CURLOPT_RETURNTRANSFER => true,
	CURLOPT_USERAGENT      => '',
	CURLOPT_URL            => 'https://community.steam-api.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?format=json&key=' . $PublicApiKey
] );
$NonPublisher = curl_exec( $c );

curl_setopt( $c, CURLOPT_URL, 'https://partner.steam-api.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?format=json&key=' . $PublisherApiKey );
$YesPublisher = curl_exec( $c );

curl_setopt( $c, CURLOPT_URL, 'https://raw.githubusercontent.com/SteamDatabase/UndocumentedAPI/master/api.json' );
$Undocumented = curl_exec( $c );

curl_setopt( $c, CURLOPT_URL, 'https://raw.githubusercontent.com/SteamDatabase/UndocumentedAPI/master/dota2.json' );
$Dota2 = curl_exec( $c );

curl_close( $c );

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

$Dota2 = json_decode( $Dota2, true );
$Dota2 = $Dota2[ 'apilist' ][ 'interfaces' ] ?? [];

$FinalList = file_exists( __DIR__ . '/api.json' ) ? json_decode( file_get_contents( __DIR__ . '/api.json' ), true ) : [];

MarkAsRemoved( $FinalList );
MergeLists( $FinalList, $NonPublisher );
MergeLists( $FinalList, $YesPublisher, 'publisher_only' );
MergeLists( $FinalList, $UndocumentedFromServices, 'protobufs' );
MergeLists( $FinalList, $Undocumented, 'undocumented' );
MergeLists( $FinalList, $Dota2, 'dota2' );

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

ksort( $FinalList, SORT_NATURAL );

foreach( $FinalList as &$Interfaces )
{
	ksort( $Interfaces, SORT_NATURAL );
}

file_put_contents(
	__DIR__ . DIRECTORY_SEPARATOR . 'api.json',
	json_encode( $FinalList, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL
);

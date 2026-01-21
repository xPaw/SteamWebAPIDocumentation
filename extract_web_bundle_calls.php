<?php

$OutputPath = __DIR__ . '/api_web_bundle_calls.json';
$CacheDirectory = __DIR__ . '/cache/web_bundles';
$CacheTtlSeconds = 24 * 60 * 60;
$ForceRefresh = in_array( '--force', $argv, true );

$SourceUrls =
[
	'https://steamcommunity.com/store',
	'https://store.steampowered.com/',
];

foreach( $argv as $Argument )
{
	if( str_starts_with( $Argument, '--output=' ) )
	{
		$OutputPath = substr( $Argument, strlen( '--output=' ) );
	}
	else if( str_starts_with( $Argument, '--ttl=' ) )
	{
		$CacheTtlSeconds = (int)substr( $Argument, strlen( '--ttl=' ) );
	}
	else if( str_starts_with( $Argument, '--url=' ) )
	{
		$SourceUrls[] = substr( $Argument, strlen( '--url=' ) );
	}
}

if( !is_dir( $CacheDirectory ) && !mkdir( $CacheDirectory, 0777, true ) && !is_dir( $CacheDirectory ) )
{
	fwrite( STDERR, "Unable to create cache directory: {$CacheDirectory}\n" );
	exit( 1 );
}

$BundleUrls = [];

foreach( $SourceUrls as $SourceUrl )
{
	$Html = FetchCachedUrl( $SourceUrl, $CacheDirectory, $CacheTtlSeconds, $ForceRefresh );

	if( $Html === null )
	{
		continue;
	}

	foreach( ExtractScriptUrls( $Html, $SourceUrl ) as $ScriptUrl )
	{
		$BundleUrls[ $ScriptUrl ] = true;
	}
}

if( empty( $BundleUrls ) )
{
	fwrite( STDERR, "No bundle URLs discovered.\n" );
	exit( 1 );
}

$Interfaces = [];

foreach( array_keys( $BundleUrls ) as $BundleUrl )
{
	$BundleContent = FetchCachedUrl( $BundleUrl, $CacheDirectory, $CacheTtlSeconds, $ForceRefresh );

	if( $BundleContent === null )
	{
		continue;
	}

	ExtractMatches( $BundleContent, $Interfaces );
}

ksort( $Interfaces, SORT_NATURAL );

$OutputInterfaces = [];

foreach( $Interfaces as $Interface )
{
	$Methods = $Interface[ 'methods' ];
	ksort( $Methods, SORT_NATURAL );
	$Interface[ 'methods' ] = array_values( $Methods );
	$OutputInterfaces[] = $Interface;
}

file_put_contents(
	$OutputPath,
	json_encode( $OutputInterfaces, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL
);

echo "Wrote " . count( $OutputInterfaces ) . " interfaces to {$OutputPath}" . PHP_EOL;

function FetchCachedUrl( string $Url, string $CacheDirectory, int $CacheTtlSeconds, bool $ForceRefresh ) : ?string
{
	$CachePath = $CacheDirectory . DIRECTORY_SEPARATOR . sha1( $Url ) . '.cache';

	if( !$ForceRefresh && file_exists( $CachePath ) )
	{
		$Age = time() - filemtime( $CachePath );

		if( $Age >= 0 && $Age < $CacheTtlSeconds )
		{
			$Cached = file_get_contents( $CachePath );

			if( $Cached !== false )
			{
				return $Cached;
			}
		}
	}

	$Curl = curl_init();

	curl_setopt_array( $Curl,
	[
		CURLOPT_TIMEOUT => 15,
		CURLOPT_RETURNTRANSFER => true,
		CURLOPT_FOLLOWLOCATION => true,
		CURLOPT_USERAGENT => 'SteamWebAPIDocumentation/1.0',
		CURLOPT_URL => $Url,
	] );

	$Response = curl_exec( $Curl );
	$Status = curl_getinfo( $Curl, CURLINFO_RESPONSE_CODE );
	curl_close( $Curl );

	if( $Response === false || $Status < 200 || $Status >= 400 )
	{
		fwrite( STDERR, "Failed to fetch {$Url} (HTTP {$Status}).\n" );
		return null;
	}

	file_put_contents( $CachePath, $Response );

	return $Response;
}

function ExtractScriptUrls( string $Html, string $BaseUrl ) : array
{
	$Scripts = [];

	if( preg_match_all( '/<script[^>]+src=["\']([^"\']+)["\']/i', $Html, $Matches ) === 0 )
	{
		return $Scripts;
	}

	foreach( $Matches[ 1 ] as $ScriptUrl )
	{
		$Absolute = NormalizeUrl( $ScriptUrl, $BaseUrl );

		if( $Absolute === null )
		{
			continue;
		}

		if( !str_contains( $Absolute, '.js' ) )
		{
			continue;
		}

		$Scripts[] = $Absolute;
	}

	return $Scripts;
}

function NormalizeUrl( string $Url, string $BaseUrl ) : ?string
{
	$Url = trim( $Url );

	if( $Url === '' )
	{
		return null;
	}

	if( str_starts_with( $Url, '//' ) )
	{
		return 'https:' . $Url;
	}

	if( preg_match( '#^https?://#i', $Url ) )
	{
		return $Url;
	}

	if( str_starts_with( $Url, '/' ) )
	{
		$BaseParts = parse_url( $BaseUrl );

		if( $BaseParts === false || empty( $BaseParts[ 'scheme' ] ) || empty( $BaseParts[ 'host' ] ) )
		{
			return null;
		}

		return $BaseParts[ 'scheme' ] . '://' . $BaseParts[ 'host' ] . $Url;
	}

	return rtrim( $BaseUrl, '/' ) . '/' . $Url;
}

function ExtractMatches( string $BundleContent, array &$Interfaces ) : void
{
	$Patterns =
	[
		'#api\\.steampowered\\.com/([A-Za-z0-9_]+)/([A-Za-z0-9_]+)/v(\\d{1,4})#i',
		'#/((?:ISteam)[A-Za-z0-9_]+)/((?:Get|Set|Request)[A-Za-z0-9_]+)/v(\\d{1,4})#',
	];

	foreach( $Patterns as $Pattern )
	{
		if( preg_match_all( $Pattern, $BundleContent, $Matches, PREG_SET_ORDER ) === 0 )
		{
			continue;
		}

		foreach( $Matches as $Match )
		{
			$InterfaceName = $Match[ 1 ];
			$MethodName = $Match[ 2 ];
			$Version = NormalizeVersion( $Match[ 3 ] );

			if( !isset( $Interfaces[ $InterfaceName ] ) )
			{
				$Interfaces[ $InterfaceName ] =
				[
					'name' => $InterfaceName,
					'methods' => [],
				];
			}

			if( !isset( $Interfaces[ $InterfaceName ][ 'methods' ][ $MethodName ] ) )
			{
				$Interfaces[ $InterfaceName ][ 'methods' ][ $MethodName ] =
				[
					'name' => $MethodName,
					'version' => $Version,
					'source' => 'web_bundle',
				];
			}

			if( $Version > $Interfaces[ $InterfaceName ][ 'methods' ][ $MethodName ][ 'version' ] )
			{
				$Interfaces[ $InterfaceName ][ 'methods' ][ $MethodName ][ 'version' ] = $Version;
			}
		}
	}
}

function NormalizeVersion( string $Version ) : int
{
	$Parsed = (int)ltrim( $Version, '0' );
	return $Parsed === 0 ? 1 : $Parsed;
}

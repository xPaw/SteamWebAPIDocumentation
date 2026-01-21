<?php

if( $argc < 2 )
{
	fwrite( STDERR, "Usage: php collect_observed_calls.php <proxy-log.jsonl> [output]\n" );
	exit( 1 );
}

$InputPath = $argv[ 1 ];
$OutputPath = $argv[ 2 ] ?? __DIR__ . '/api_observed_calls.json';

if( !file_exists( $InputPath ) )
{
	fwrite( STDERR, "Input file not found: {$InputPath}\n" );
	exit( 1 );
}

$Interfaces = [];
$Handle = fopen( $InputPath, 'rb' );

if( $Handle === false )
{
	fwrite( STDERR, "Unable to read input file: {$InputPath}\n" );
	exit( 1 );
}

$LineNumber = 0;

while( ( $Line = fgets( $Handle ) ) !== false )
{
	$LineNumber++;
	$Line = trim( $Line );

	if( $Line === '' )
	{
		continue;
	}

	$Entry = json_decode( $Line, true );

	if( !is_array( $Entry ) )
	{
		continue;
	}

	$Parsed = ParseProxyEntry( $Entry );

	if( $Parsed === null )
	{
		continue;
	}

	$InterfaceName = $Parsed[ 'interface' ];
	$MethodName = $Parsed[ 'method' ];
	$Version = $Parsed[ 'version' ];

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
			'httpmethod' => $Parsed[ 'httpmethod' ],
			'description' => $Parsed[ 'description' ],
			'parameters' => [],
		];
	}

	$MethodEntry = &$Interfaces[ $InterfaceName ][ 'methods' ][ $MethodName ];

	if( $Version > $MethodEntry[ 'version' ] )
	{
		$MethodEntry[ 'version' ] = $Version;
	}

	if( empty( $MethodEntry[ 'httpmethod' ] ) && !empty( $Parsed[ 'httpmethod' ] ) )
	{
		$MethodEntry[ 'httpmethod' ] = $Parsed[ 'httpmethod' ];
	}

	if( empty( $MethodEntry[ 'description' ] ) && !empty( $Parsed[ 'description' ] ) )
	{
		$MethodEntry[ 'description' ] = $Parsed[ 'description' ];
	}

	foreach( $Parsed[ 'parameters' ] as $Parameter )
	{
		AddParameter( $MethodEntry, $Parameter );
	}

	unset( $MethodEntry );
}

fclose( $Handle );

ksort( $Interfaces, SORT_NATURAL );

$OutputInterfaces = [];

foreach( $Interfaces as $Interface )
{
	$Methods = $Interface[ 'methods' ];
	ksort( $Methods, SORT_NATURAL );

	$OutputMethods = [];

	foreach( $Methods as $Method )
	{
		$Parameters = $Method[ 'parameters' ];
		ksort( $Parameters, SORT_NATURAL );

		foreach( $Parameters as &$Parameter )
		{
			if( isset( $Parameter[ 'extra' ] ) )
			{
				$ExtraMap = [];
				foreach( $Parameter[ 'extra' ] as $Extra )
				{
					$ExtraMap[ $Extra[ 'name' ] ] = $Extra;
				}
				ksort( $ExtraMap, SORT_NATURAL );
				$Parameter[ 'extra' ] = array_values( $ExtraMap );
			}
		}

		unset( $Parameter );

		$Method[ 'parameters' ] = array_values( $Parameters );
		$OutputMethods[] = $Method;
	}

	$Interface[ 'methods' ] = $OutputMethods;
	$OutputInterfaces[] = $Interface;
}

file_put_contents(
	$OutputPath,
	json_encode( $OutputInterfaces, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL
);

echo "Wrote " . count( $OutputInterfaces ) . " interfaces to {$OutputPath}" . PHP_EOL;

function ParseProxyEntry( array $Entry ) : ?array
{
	$Request = $Entry[ 'request' ] ?? $Entry[ 'req' ] ?? [];
	$Method = $Request[ 'method' ] ?? $Entry[ 'method' ] ?? $Entry[ 'request_method' ] ?? null;
	$Url = $Request[ 'url' ] ?? $Entry[ 'url' ] ?? null;
	$Host = $Request[ 'host' ] ?? $Entry[ 'host' ] ?? null;
	$Path = $Request[ 'path' ] ?? $Entry[ 'path' ] ?? null;
	$Query = $Request[ 'query' ] ?? $Entry[ 'query' ] ?? null;

	if( $Url !== null )
	{
		$ParsedUrl = parse_url( $Url );
		$Host = $Host ?? ( $ParsedUrl[ 'host' ] ?? null );
		$Path = $Path ?? ( $ParsedUrl[ 'path' ] ?? null );
		$Query = $Query ?? ( $ParsedUrl[ 'query' ] ?? null );
	}

	if( $Host === null && isset( $Request[ 'headers' ][ 'host' ] ) )
	{
		$HostHeader = $Request[ 'headers' ][ 'host' ];
		$Host = is_array( $HostHeader ) ? ( $HostHeader[ 0 ] ?? null ) : $HostHeader;
	}

	if( $Method === null || $Path === null )
	{
		return null;
	}

	$Path = strtok( $Path, '?' );

	if( !preg_match( '#^/([^/]+)/([^/]+)/v(\d+)(?:/|$)#', $Path, $Matches ) )
	{
		return null;
	}

	$InterfaceName = $Matches[ 1 ];
	$MethodName = $Matches[ 2 ];
	$Version = (int)ltrim( $Matches[ 3 ], '0' );
	$Version = $Version === 0 ? 1 : $Version;

	$QueryParams = NormalizeQueryParams( $Query );
	$Parameters = [];

	foreach( $QueryParams as $Name => $Value )
	{
		$Parameters[] =
		[
			'name' => $Name,
			'type' => InferType( $Value ),
			'optional' => true,
			'description' => 'Observed query parameter.',
		];
	}

	$ResponseFields = ExtractResponseFields( $Entry );

	if( $ResponseFields !== null )
	{
		$ExtraFields = [];

		foreach( $ResponseFields[ 'fields' ] as $FieldName => $Value )
		{
			$ExtraFields[] =
			[
				'name' => $FieldName,
				'type' => InferType( $Value ),
				'optional' => true,
				'description' => '',
			];
		}

		$Parameters[] =
		[
			'name' => 'response',
			'type' => $ResponseFields[ 'type' ],
			'optional' => true,
			'description' => 'Observed response fields from proxy sample.',
			'extra' => $ExtraFields,
		];
	}

	$Description = $Host ? "Observed on {$Host}{$Path}" : "Observed on {$Path}";

	return
	[
		'interface' => $InterfaceName,
		'method' => $MethodName,
		'version' => $Version,
		'httpmethod' => strtoupper( $Method ),
		'description' => $Description,
		'parameters' => $Parameters,
	];
}

function NormalizeQueryParams( $Query ) : array
{
	if( $Query === null )
	{
		return [];
	}

	if( is_array( $Query ) )
	{
		$Output = [];

		if( array_keys( $Query ) === range( 0, count( $Query ) - 1 ) )
		{
			foreach( $Query as $Pair )
			{
				if( is_array( $Pair ) )
				{
					$Key = $Pair[ 0 ] ?? null;
					$Value = $Pair[ 1 ] ?? null;

					if( $Key !== null )
					{
						$Output[ $Key ] = $Value;
					}
				}
			}
		}
		else
		{
			$Output = $Query;
		}

		return $Output;
	}

	if( is_string( $Query ) )
	{
		$Output = [];
		parse_str( $Query, $Output );
		return $Output;
	}

	return [];
}

function ExtractResponseFields( array $Entry ) : ?array
{
	$Response = $Entry[ 'response' ] ?? $Entry[ 'resp' ] ?? null;

	if( !is_array( $Response ) )
	{
		return null;
	}

	$Data = $Response[ 'json' ] ?? null;

	if( $Data === null )
	{
		$Content = $Response[ 'content' ] ?? $Response[ 'body' ] ?? $Response[ 'text' ] ?? null;

		if( is_string( $Content ) && $Content !== '' )
		{
			$Data = json_decode( $Content, true );

			if( $Data === null )
			{
				$Decoded = base64_decode( $Content, true );

				if( $Decoded !== false )
				{
					$Data = json_decode( $Decoded, true );
				}
			}
		}
	}

	if( !is_array( $Data ) )
	{
		return null;
	}

	if( array_keys( $Data ) === range( 0, count( $Data ) - 1 ) )
	{
		$First = $Data[ 0 ] ?? null;

		if( !is_array( $First ) )
		{
			return null;
		}

		return
		[
			'type' => 'object[]',
			'fields' => $First,
		];
	}

	return
	[
		'type' => 'object',
		'fields' => $Data,
	];
}

function InferType( $Value ) : string
{
	if( is_bool( $Value ) )
	{
		return 'bool';
	}

	if( is_int( $Value ) )
	{
		return 'uint32';
	}

	if( is_float( $Value ) )
	{
		return 'float';
	}

	if( is_array( $Value ) )
	{
		return 'string[]';
	}

	if( is_string( $Value ) )
	{
		if( ctype_digit( $Value ) )
		{
			return 'uint32';
		}

		if( is_numeric( $Value ) )
		{
			return 'float';
		}
	}

	return 'string';
}

function AddParameter( array &$MethodEntry, array $Parameter ) : void
{
	$Name = $Parameter[ 'name' ];

	if( !isset( $MethodEntry[ 'parameters' ][ $Name ] ) )
	{
		$MethodEntry[ 'parameters' ][ $Name ] = $Parameter;
		return;
	}

	$Existing = &$MethodEntry[ 'parameters' ][ $Name ];

	if( empty( $Existing[ 'type' ] ) && !empty( $Parameter[ 'type' ] ) )
	{
		$Existing[ 'type' ] = $Parameter[ 'type' ];
	}

	if( isset( $Parameter[ 'optional' ] ) && $Parameter[ 'optional' ] === false )
	{
		$Existing[ 'optional' ] = false;
	}

	if( !empty( $Parameter[ 'description' ] ) && empty( $Existing[ 'description' ] ) )
	{
		$Existing[ 'description' ] = $Parameter[ 'description' ];
	}

	if( isset( $Parameter[ 'extra' ] ) )
	{
		MergeExtraFields( $Existing, $Parameter[ 'extra' ] );
	}
}

function MergeExtraFields( array &$Existing, array $Extras ) : void
{
	$ExtraMap = [];

	if( isset( $Existing[ 'extra' ] ) )
	{
		foreach( $Existing[ 'extra' ] as $Extra )
		{
			$ExtraMap[ $Extra[ 'name' ] ] = $Extra;
		}
	}

	foreach( $Extras as $Extra )
	{
		$ExtraMap[ $Extra[ 'name' ] ] = $Extra;
	}

	$Existing[ 'extra' ] = array_values( $ExtraMap );
}

<?php

set_time_limit( 600 );

if( getenv( 'CI' ) !== false )
{
	$PublisherApiKey = getenv( 'STEAM_PUBLISHER_API_KEY' );
}
else
{
	require __DIR__ . '/config.php';
}

$Folder = __DIR__ . DIRECTORY_SEPARATOR . 'protobufs_repo';

if( file_exists( $Folder ) )
{
	passthru( 'cd ' . escapeshellarg( $Folder ) . ' && git pull' );
}
else
{
	passthru( 'git clone --depth=1 https://github.com/SteamDatabase/Protobufs ' . escapeshellarg( $Folder ) );
}

$generatedServices = [];

/** @var SplFileInfo[] $allProtos */
$allProtos = new RecursiveIteratorIterator(
	new RecursiveDirectoryIterator(
		$Folder,
		FilesystemIterator::CURRENT_AS_FILEINFO | FilesystemIterator::SKIP_DOTS
	)
);

$methodDescriptions = [];
$methodParameters = [];

function ProcessFile( SplFileInfo $fileInfo ) : string
{
	if( !$fileInfo->isFile() )
	{
		echo $fileInfo . ' does not exist' . PHP_EOL;
		return '';
	}

	$proto = file_get_contents( $fileInfo );

	if( $proto === false )
	{
		throw new Exception( "Failed to read $fileInfo" );
	}

	return preg_replace_callback( '/^import "(?<file>.+\.proto)";/m', function( array $matches ) use ( $fileInfo ) : string
	{
		$path = $fileInfo->getPath() . '/';

		if( str_starts_with( $matches[ 'file' ], 'google/' ) )
		{
			$path .= '../' . $matches[ 'file' ];
		}
		else if( str_starts_with( $matches[ 'file' ], 'steammessages' ) && str_contains( $path, 'webui' ) )
		{
			$path .= '../steam/' . $matches[ 'file' ];
		}
		else
		{
			$path .= $matches[ 'file' ];
		}

		return ProcessFile( new SplFileInfo( $path ) );
	}, $proto ) ?? '';
}

foreach( $allProtos as $fileInfo )
{
	if( strpos( $fileInfo, '.git' ) !== false  || $fileInfo->getExtension() !== 'proto' )
	{
		continue;
	}

	$proto = ProcessFile( $fileInfo );

	preg_match_all( "/service (.+?)\s{/", $proto, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE );

	$matches[] =
	[
		[],
		[
			'',
			strlen( $proto )
		]
	];

	for( $i = count( $matches ) - 1; $i > 0; $i-- )
	{
		$serviceName = $matches[ $i - 1 ][ 1 ][ 0 ];

		if( $serviceName === 'RemoteClientSteamClient' )
		{
			$serviceName = 'RemoteClient';
		}

		$serviceName = 'I' . $serviceName . 'Service';

		$service = substr( $proto, $matches[ $i - 1 ][ 1 ][ 1 ], $matches[ $i ][ 1 ][ 1 ] - $matches[ $i - 1 ][ 1 ][ 1 ] );

		preg_match_all( "/rpc (.+?) \(.(.+?)\) returns \(.(?:.+?)\)\s*(?:;|\{\s*option \(method_description\) = \"(.+?)\";)$/m", $service, $rpcs );

		$generatedMethods = [];

		for( $x = 0; $x < count( $rpcs[ 0 ] ); $x++ )
		{
			$methodName = $rpcs[ 1 ][ $x ];
			$request = $rpcs[ 2 ][ $x ];

			$methodPath = $serviceName . '/' . $methodName;

			if( empty( $methodDescriptions[ $methodPath ] ) )
			{
				$methodDescriptions[ $methodPath ] = trim( $rpcs[ 3 ][ $x ] );
			}

			if( empty( $methodParameters[ $methodPath ] ) )
			{
				$methodParameters[ $methodPath ] =
				[
					'key' =>
					[
						"name" => "key",
						"type" => "string",
						"optional" => false,
						"description" => "Access key",
					]
				];
			}

			if( !preg_match( "/message " . $request . " {(.+?)^}/ms", $proto, $message ) )
			{
				echo $request . ' not found in ' . $fileInfo . PHP_EOL;
			}

			if( preg_match_all(
				"/^\t(?<rule>optional|repeated|required) (?<type>[\w\.]+) (?<name>\w+).+?(?:\(description\) = \"(?<description>.+?)\".+?)?;$/m",
				$message[ 1 ] ?? '',
				$fields
			) > 0 )
			{
				for( $y = 0; $y < count( $fields[ 0 ] ); $y++ )
				{
					$name = $fields[ 'name' ][ $y ];

					if( strpos( $fields[ 'type' ][ $y ], '.' ) !== false )
					{
						$type = substr( $fields[ 'type' ][ $y ], 1 );
					}
					else
					{
						$type = $fields[ 'type' ][ $y ];

						if( $fields[ 'rule' ][ $y ] === 'repeated' )
						{
							$name .= '[0]';
						}
					}

					if( !empty( $methodParameters[ $methodPath ][ $name ] ) )
					{
						if( empty( $methodParameters[ $methodPath ][ $name ][ 'description' ] ) )
						{
							$methodParameters[ $methodPath ][ $name ][ 'description' ] = trim( $fields[ 'description' ][ $y ] );
						}

						continue;
					}

					$methodParameters[ $methodPath ][ $name ] =
					[
						'name' => $name,
						'type' => $type,
						'optional' => true,
						'description' => trim( $fields[ 'description' ][ $y ] ),
					];
				}
			}

			$generatedMethods[ $methodName ] = true;
		}

		if( empty( $generatedServices[ $serviceName ] ) )
		{
			$generatedServices[ $serviceName ] = [];
		}

		$generatedServices[ $serviceName ] += $generatedMethods;
	}
}

$c = curl_init( );

curl_setopt_array( $c, [
	CURLOPT_USERAGENT      => '',
	CURLOPT_RETURNTRANSFER => true,
	CURLOPT_TIMEOUT        => 5,
	CURLOPT_CONNECTTIMEOUT => 5,
	CURLOPT_URL => 'https://api.steampowered.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?format=json&key=' . $PublisherApiKey,
] );

$knownServices = [];

$response = curl_exec( $c );
$response = json_decode( $response, true, 512, JSON_THROW_ON_ERROR );

foreach( $response[ 'apilist' ][ 'interfaces' ] as $service )
{
	foreach( $service[ 'methods' ] as $method )
	{
		$knownServices[ $service[ 'name' ] . '/' . $method[ 'name' ] ] = true;
	}
}

$notFound                  = "<html>\n<head>\n<title>404 Not Found</title>\n</head>\n<body>\n<h1>Not Found</h1>\n</body>\n</html>";
$notFoundNoInterface       = "<html><head><title>Not Found</title></head><body><h1>Not Found</h1>Interface '%s' not found</body></html>";
$notFoundMethodInInterface = "<html><head><title>Not Found</title></head><body><h1>Not Found</h1>Method '%s' not found in interface '%s'</body></html>";
$mustBePost                = "<html><head><title>Method Not Allowed</title></head><body><h1>Method Not Allowed</h1>This API must be called with a HTTP POST request</body></html>";

$foundServices = [];

foreach( $generatedServices as $serviceName => $methods )
{
	$foundMethods = [];

	foreach( $methods as $methodName => $trash )
	{
		$path = $serviceName . '/' . $methodName;

		if( isset( $knownServices[ $path ] ) )
		{
			continue;
		}

		echo 'Checking ' . $path . '...';

		curl_setopt( $c, CURLOPT_URL, "https://api.steampowered.com/{$path}/v1/" );
		$response = curl_exec( $c );

		if( $response === $notFound )
		{
			echo " \033[1;31mnothing\033[0m" . PHP_EOL;
			continue;
		}

		if( $response === sprintf( $notFoundNoInterface, $serviceName ) )
		{
			echo " \033[1;33minterface not found\033[0m" . PHP_EOL;
			continue;
		}

		if( $response === sprintf( $notFoundMethodInInterface, $methodName, $serviceName ) )
		{
			echo " \033[1;31mmethod not found\033[0m" . PHP_EOL;
			continue;
		}

		echo " \033[0;32mFOUND!\033[0m" . PHP_EOL;

		$method =
		[
			'name' => $methodName,
			'version' => 1,
		];

		if( $response === $mustBePost )
		{
			$method[ 'httpmethod' ] = 'POST';
		}

		if( !empty( $methodDescriptions[ $path ] ) )
		{
			$method[ 'description' ] = $methodDescriptions[ $path ];
		}

		if( !empty( $methodParameters[ $path ] ) )
		{
			$method[ 'parameters' ] = array_values( $methodParameters[ $path ] );
		}

		$foundMethods[] = $method;
	}

	if( empty( $foundMethods ) )
	{
		continue;
	}

	$foundServices[] =
	[
		'name' => $serviceName,
		'methods' => $foundMethods,
	];
}

curl_close( $c );

file_put_contents(
	__DIR__ . DIRECTORY_SEPARATOR . 'api_from_protos.json',
	json_encode( $foundServices, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL
);

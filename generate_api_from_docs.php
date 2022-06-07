<?php

// Path to https://github.com/SteamDatabase/SteamworksDocumentation
$Folder = __DIR__ . '/../SteamworksDocumentation';

$AllDocs = new RecursiveIteratorIterator(
	new RecursiveDirectoryIterator(
		$Folder,
		FilesystemIterator::CURRENT_AS_FILEINFO | FilesystemIterator::SKIP_DOTS
	)
);

$Methods = [];

foreach( $AllDocs as $fileInfo )
{
	if( $fileInfo->getExtension() !== 'html' )
	{
		continue;
	}

	$Doc = file_get_contents( $fileInfo );
	$Doc = explode( '<h2 class="bb_section">', $Doc );

	foreach( $Doc as $Section )
	{
		if( preg_match( '/<div class="bb_code(?: http)?">(.+?)<\/div>/s', $Section, $UrlMatches ) !== 1 )
		{
			continue;
		}

		$Url = htmlspecialchars_decode( $UrlMatches[ 1 ] );
		$Url = explode( ' ', trim( preg_replace( '/[\n\r ]+/', ' ', $Url ) ) );

		if( count( $Url ) < 2 )
		{
			continue;
		}

		$Parameters = [];
		$HttpMethod = $Url[ 0 ];
		$HttpPath = explode( '/', parse_url( $Url[ 1 ], PHP_URL_PATH ) );

		if( count( $HttpPath ) < 4 )
		{
			continue;
		}

		$ApiService = $HttpPath[ 1 ];
		$ApiMethod = $HttpPath[ 2 ];
		$ApiVersion = (int)str_replace( 'v', '', $HttpPath[ 3 ] );

		$Method =
		[
			'name' => $ApiMethod,
			'version' => $ApiVersion,
			'httpmethod' => $HttpMethod,
			'parameters' => [],
		];

		$Section = explode( '</table>', $Section, 2 ); // Can be multiple tables (like response)

		preg_match_all( '/<tr>(.*?)<\/tr>/s', $Section[ 0 ], $Matches );

		foreach( $Matches[ 1 ] as $ParamsHtml )
		{
			if( preg_match_all( '/<td>(.*?)<\/td>/s', $ParamsHtml, $ParamsMatches ) === 0 )
			{
				continue;
			}

			$Method[ 'parameters' ][] =
			[
				'name' => trim( strip_tags( $ParamsMatches[ 1 ][ 0 ] ) ),
				'type' => trim( strip_tags( $ParamsMatches[ 1 ][ 1 ] ) ),
				'optional' => $ParamsMatches[ 1 ][ 2 ] !== '✔',
				'description' => trim( strip_tags( $ParamsMatches[ 1 ][ 3 ] ) ),
			];
		}

		if( !isset( $Methods[ $ApiService ] ) )
		{
			$Methods[ $ApiService ] = [];
		}

		$Methods[ $ApiService ][] = $Method;
	}
}

$FoundServices = [];

foreach( $Methods as $ServiceName => $FoundMethods )
{
	$FoundServices[] =
	[
		'name' => $ServiceName,
		'methods' => $FoundMethods,
	];
}

file_put_contents(
	__DIR__ . DIRECTORY_SEPARATOR . 'api_from_docs.json',
	json_encode( $FoundServices, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL
);

<?php

$FinalList = json_decode( file_get_contents( __DIR__ . '/api.json' ), true, 512, JSON_THROW_ON_ERROR );

$c = curl_init( );

curl_setopt_array( $c, [
	CURLOPT_USERAGENT      => '',
	CURLOPT_RETURNTRANSFER => true,
	CURLOPT_TIMEOUT        => 5,
	CURLOPT_CONNECTTIMEOUT => 5,
] );

$notFound = "<html>\n<head>\n<title>404 Not Found</title>\n</head>\n<body>\n<h1>Not Found</h1>\n</body>\n</html>";
$copy = $FinalList;

foreach( $copy as $serviceName => $Interface )
{
	foreach( $Interface as $methodName => $Method )
	{
		$path = $serviceName . '/' . $methodName . '/v' . $Method[ 'version' ];

		printf( 'Checking %-70s', $path . '...' );

		curl_setopt( $c, CURLOPT_URL, "https://api.steampowered.com/{$path}/" );
		$response = curl_exec( $c );

		$code = curl_getinfo( $c, CURLINFO_HTTP_CODE );

		echo ' ' . $code;

		if( $code !== 404 )
		{
			echo PHP_EOL;
			continue;
		}

		if( $response !== $notFound )
		{
			echo ' different kind of error' . PHP_EOL;
			continue;
		}

		echo ' REMOVED!' . PHP_EOL;
		unset( $FinalList[ $serviceName ][ $methodName ] );
	}

	if( empty( $FinalList[ $serviceName ] ) )
	{
		unset( $FinalList[ $serviceName ] );
	}
}

file_put_contents(
	__DIR__ . DIRECTORY_SEPARATOR . 'api.json',
	json_encode( $FinalList, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL
);

echo 'Done' . PHP_EOL;

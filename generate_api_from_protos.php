<?php

set_time_limit( 600 );

require __DIR__ . '/vendor/autoload.php';

$PublisherApiKey = getenv( 'STEAM_PUBLISHER_API_KEY' );

if( empty( $PublisherApiKey ) )
{
	require __DIR__ . '/config.php';
}

$Folder = getenv( 'STEAM_PROTOBUFS_REPO_PATH' );

if( empty( $Folder ) )
{
	if( getenv( 'CI' ) !== false )
	{
		$Folder = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'protobufs_repo_' . bin2hex( random_bytes( 5 ) );
	}
	else
	{
		$Folder = __DIR__ . DIRECTORY_SEPARATOR . 'protobufs_repo';
	}

	if( !file_exists( $Folder ) )
	{
		passthru( 'git clone --depth=1 https://github.com/SteamDatabase/Protobufs ' . escapeshellarg( $Folder ) );
	}
}

if( file_exists( $Folder ) )
{
	passthru( 'cd ' . escapeshellarg( $Folder ) . ' && git pull' );
}

$generatedServices = [];

$allProtos = new AppendIterator();

foreach( [ 'steam', 'deadlock', 'csgo', 'dota2', 'webui' ] as $subFolder )
{
	$path = $Folder . DIRECTORY_SEPARATOR . $subFolder;
	if( file_exists( $path ) )
	{
		$iterator = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator(
				$path,
				FilesystemIterator::CURRENT_AS_FILEINFO | FilesystemIterator::SKIP_DOTS
			)
		);

		// For game folders, only include files starting with "steam"
		if( !in_array( $subFolder, [ 'webui', 'steam' ], true ) )
		{
			$iterator = new CallbackFilterIterator( $iterator, function( $file )
			{
				return $file->isFile() && str_starts_with( $file->getFilename(), 'steam' );
			} );
		}

		$allProtos->append( $iterator );
	}
}

$methodDescriptions = [];
$methodParameters = [];
$allMessages = [];
$allEnums = [];
$fieldDescriptions = []; // Store field descriptions separately since AST is readonly
$parsedFiles = [];
$parser = Butschster\ProtoParser\ProtoParserFactory::create();

function ParseProtoFile( SplFileInfo $fileInfo, $parser ) : ?Butschster\ProtoParser\Ast\ProtoNode
{
	global $parsedFiles;

	$path = $fileInfo->getPathname();
	if( isset( $parsedFiles[ $path ] ) )
	{
		return $parsedFiles[ $path ];
	}

	try
	{
		$protoContent = file_get_contents( $path );

		// https://github.com/butschster/proto-parser/issues/8
		if( !preg_match( '/^\s*syntax\s*=/', $protoContent ) )
		{
			$protoContent = "syntax = \"proto2\";\n" . $protoContent;
		}

		// https://github.com/butschster/proto-parser/issues/9
		$protoContent = str_replace( "(.description)", '(description)', $protoContent );
		$protoContent = str_replace( "optional uint64 bytes ", 'optional uint64 _bytes ', $protoContent );
		$protoContent = str_replace( "optional bool bool ", 'optional bool _bool ', $protoContent );
		$protoContent = str_replace( "optional float float ", 'optional float _float ', $protoContent );
		$protoContent = str_replace( "optional string string ", 'optional string _string ', $protoContent );

		// https://github.com/butschster/proto-parser/issues/10
		$protoContent = preg_replace( '/extend\s+[^{]+\{[^}]*\}/s', '', $protoContent );

		$protoFile = $parser->parse( $protoContent );
		$parsedFiles[ $path ] = $protoFile;

		return $protoFile;
	}
	catch( Exception $e )
	{
		echo 'Failed to parse ' . $fileInfo . ': ' . $e->getMessage() . PHP_EOL;
		return null;
	}
}

function StoreFieldDescriptions( string $messageName, Butschster\ProtoParser\Ast\MessageDefNode $message, array &$fieldDescriptions ) : void
{
	// Store field descriptions in a separate array since AST nodes are readonly
	foreach( $message->fields as $field )
	{
		// For oneof, process all fields inside it
		if( $field instanceof Butschster\ProtoParser\Ast\OneofDeclNode )
		{
			foreach( $field->fields as $oneofField )
			{
				StoreFieldDescription( $messageName, $oneofField, $fieldDescriptions );
			}
			continue;
		}

		if( $field instanceof Butschster\ProtoParser\Ast\FieldDeclNode )
		{
			StoreFieldDescription( $messageName, $field, $fieldDescriptions );
		}
	}
}

function StoreFieldDescription( string $messageName, Butschster\ProtoParser\Ast\FieldDeclNode|Butschster\ProtoParser\Ast\OneofFieldNode $field, array &$fieldDescriptions ) : void
{
	$fieldKey = $messageName . '.' . $field->name;

	// Store if we don't have a description yet
	if( isset( $fieldDescriptions[ $fieldKey ] ) && !empty( $fieldDescriptions[ $fieldKey ] ) )
	{
		return;
	}

	foreach( $field->options as $opt )
	{
		if( $opt->name === 'description' && !empty( $opt->value ) )
		{
			$fieldDescriptions[ $fieldKey ] = $opt->value;
			return;
		}
	}
}

function CollectNestedMessagesAndEnums( Butschster\ProtoParser\Ast\MessageDefNode $message, string $parentName, string $packagePrefix, array &$allMessages, array &$allEnums, array &$fieldDescriptions ) : void
{
	// Collect nested messages
	foreach( $message->messages as $nestedMessage )
	{
		$nestedFullName = $parentName . '.' . $nestedMessage->name;
		if( !isset( $allMessages[ $nestedFullName ] ) )
		{
			$allMessages[ $nestedFullName ] = $nestedMessage;
		}

		StoreFieldDescriptions( $nestedFullName, $nestedMessage, $fieldDescriptions );

		if( $packagePrefix )
		{
			$fullName = $packagePrefix . $nestedFullName;
			if( !isset( $allMessages[ $fullName ] ) )
			{
				$allMessages[ $fullName ] = $nestedMessage;
			}

			StoreFieldDescriptions( $fullName, $nestedMessage, $fieldDescriptions );
		}

		// Recursively collect deeper nested messages
		CollectNestedMessagesAndEnums( $nestedMessage, $nestedFullName, $packagePrefix, $allMessages, $allEnums, $fieldDescriptions );
	}

	// Collect nested enums
	foreach( $message->enums as $nestedEnum )
	{
		$nestedFullName = $parentName . '.' . $nestedEnum->name;
		if( !isset( $allEnums[ $nestedFullName ] ) )
		{
			$allEnums[ $nestedFullName ] = $nestedEnum;
		}

		if( $packagePrefix )
		{
			$fullName = $packagePrefix . $nestedFullName;
			if( !isset( $allEnums[ $fullName ] ) )
			{
				$allEnums[ $fullName ] = $nestedEnum;
			}
		}
	}
}

function CollectMessagesFromFile( Butschster\ProtoParser\Ast\ProtoNode $protoFile, SplFileInfo $fileInfo, $parser, array &$allMessages, array &$allEnums, array &$fieldDescriptions ) : void
{
	$packagePrefix = '';
	if( $protoFile->package !== null )
	{
		$packagePrefix = $protoFile->package->name . '.';
	}

	// Process imports first to get messages from imported files
	foreach( $protoFile->imports as $import )
	{
		$importPath = $fileInfo->getPath() . DIRECTORY_SEPARATOR . $import->path;

		// Handle relative paths for common imports
		if( str_starts_with( $import->path, 'steammessages' ) && str_contains( $fileInfo->getPath(), 'webui' ) )
		{
			$importPath = $fileInfo->getPath() . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'steam' . DIRECTORY_SEPARATOR . $import->path;
		}

		if( file_exists( $importPath ) )
		{
			$importedFile = ParseProtoFile( new SplFileInfo( $importPath ), $parser );
			if( $importedFile !== null )
			{
				CollectMessagesFromFile( $importedFile, new SplFileInfo( $importPath ), $parser, $allMessages, $allEnums, $fieldDescriptions );
			}
		}
	}

	// Collect messages and enums from this file
	foreach( $protoFile->topLevelDefs as $def )
	{
		// Collect enums
		if( $def instanceof Butschster\ProtoParser\Ast\EnumDefNode )
		{
			if( !isset( $allEnums[ $def->name ] ) )
			{
				$allEnums[ $def->name ] = $def;
			}

			if( $packagePrefix )
			{
				$fullName = $packagePrefix . $def->name;
				if( !isset( $allEnums[ $fullName ] ) )
				{
					$allEnums[ $fullName ] = $def;
				}
			}
			continue;
		}

		if( !( $def instanceof Butschster\ProtoParser\Ast\MessageDefNode ) )
		{
			continue;
		}

		if( !isset( $allMessages[ $def->name ] ) )
		{
			$allMessages[ $def->name ] = $def;
		}

		// Always try to store field descriptions from the current file
		// This allows later folders (game folders) to add descriptions to messages from steam
		StoreFieldDescriptions( $def->name, $def, $fieldDescriptions );

		if( $packagePrefix )
		{
			$fullName = $packagePrefix . $def->name;
			if( !isset( $allMessages[ $fullName ] ) )
			{
				$allMessages[ $fullName ] = $def;
			}

			StoreFieldDescriptions( $fullName, $def, $fieldDescriptions );
		}

		// Recursively collect all nested messages and enums at any depth
		CollectNestedMessagesAndEnums( $def, $def->name, $packagePrefix, $allMessages, $allEnums, $fieldDescriptions );
	}
}

function ParseMessageParameters( $message, array &$allMessages, array &$allEnums, array &$fieldDescriptions, string $messageName = '', array $processingStack = [] )
{
	if( $message === null )
	{
		return [];
	}

	// Add current message to processing stack to prevent circular references
	if( !empty( $messageName ) )
	{
		$processingStack[ $messageName ] = true;
	}

	$parameters = [];

	foreach( $message->fields as $field )
	{
		// Handle oneof declarations by taking the first field
		if( $field instanceof Butschster\ProtoParser\Ast\OneofDeclNode )
		{
			if( !empty( $field->fields ) )
			{
				$field = $field->fields[0];
			}
			else
			{
				continue;
			}
		}

		$name = $field->name;
		$type = ltrim( $field->type->type, '.' );
		$extra = null;
		$enumValues = null;

		// Handle nested message types (check for circular references)
		if( isset( $allMessages[ $type ] ) && !isset( $processingStack[ $type ] ) )
		{
			$extra = ParseMessageParameters( $allMessages[ $type ], $allMessages, $allEnums, $fieldDescriptions, $type, $processingStack );
		}

		// Handle enum types
		if( isset( $allEnums[ $type ] ) )
		{
			$enumValues = [];
			$names = array_map( fn($f) => $f->name, $allEnums[ $type ]->fields );

			// Find common prefix across all enum values (including trailing underscore)
			$prefix = count( $names ) > 1 ? $names[0] : '';
			foreach( $names as $enumName )
			{
				for( $i = 0; $i < strlen( $prefix ) && $i < strlen( $enumName ) && $prefix[$i] === $enumName[$i]; $i++ );
				$prefix = substr( $prefix, 0, $i );
			}

			// Strip common prefix from all values
			foreach( $allEnums[ $type ]->fields as $enumField )
			{
				$enumValues[ $enumField->number ] = substr( $enumField->name, strlen( $prefix ) );
			}
		}

		// OneofFieldNode doesn't have a modifier property, treat as optional
		$isRepeated = false;
		$isOptional = true;

		if( $field instanceof Butschster\ProtoParser\Ast\FieldDeclNode )
		{
			$isRepeated = $field->modifier === Butschster\ProtoParser\Ast\FieldModifier::Repeated;
			// Repeated fields are optional (can be empty), and so are fields with Optional modifier
			$isOptional = $isRepeated || $field->modifier === Butschster\ProtoParser\Ast\FieldModifier::Optional;
		}

		if( $isRepeated )
		{
			$name .= '[0]';
			$type .= '[]';
		}

		// Check stored descriptions first, then fall back to field options
		$description = '';
		if( !empty( $messageName ) )
		{
			$fieldKey = $messageName . '.' . $field->name;
			if( isset( $fieldDescriptions[ $fieldKey ] ) )
			{
				$description = $fieldDescriptions[ $fieldKey ];
			}
		}

		if( empty( $description ) )
		{
			foreach( $field->options as $option )
			{
				if( $option->name === 'description' )
				{
					$description = $option->value;
					break;
				}
			}
		}

		$parameters[ $name ] =
		[
			'name' => $name,
			'type' => $type,
			'optional' => $isOptional,
			'description' => $description,
		];

		if( !empty( $extra ) )
		{
			$parameters[ $name ][ 'extra' ] = array_values( $extra );
		}

		if( !empty( $enumValues ) )
		{
			$parameters[ $name ][ 'enum_values' ] = $enumValues;
		}
	}

	return $parameters;
}

// First pass: collect all messages and field descriptions
foreach( $allProtos as $fileInfo )
{
	if( str_contains( $fileInfo, '.git' ) || $fileInfo->getExtension() !== 'proto' )
	{
		continue;
	}

	echo 'Parsing ' . $fileInfo->getPathname() . '...' . PHP_EOL;

	$protoFile = ParseProtoFile( $fileInfo, $parser );
	if( $protoFile === null )
	{
		continue;
	}

	// Collect all messages and enums from this file and its imports
	CollectMessagesFromFile( $protoFile, $fileInfo, $parser, $allMessages, $allEnums, $fieldDescriptions );
}

// Second pass: process services now that all descriptions are collected
foreach( $parsedFiles as $path => $protoFile )
{
	foreach( $protoFile->topLevelDefs as $def )
	{
		if( !( $def instanceof Butschster\ProtoParser\Ast\ServiceDefNode ) )
		{
			continue;
		}

		$serviceName = $def->name;

		if( $serviceName === 'RemoteClientSteamClient' )
		{
			$serviceName = 'RemoteClient';
		}

		$serviceName = 'I' . $serviceName . 'Service';

		foreach( $def->methods as $method )
		{
			$methodName = $method->name;
			$methodPath = $serviceName . '/' . $methodName;

			// Extract method description from options
			foreach( $method->options as $optionDecl )
			{
				if( $optionDecl->name === 'method_description' && empty( $methodDescriptions[ $methodPath ] ) )
				{
					// OptionDeclNode contains OptionNode[] in its options property
					if( !empty( $optionDecl->options ) )
					{
						$methodDescriptions[ $methodPath ] = $optionDecl->options[0]->value;
					}
					break;
				}
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

			$requestType = $method->inputType->name;
			if( !empty( $requestType ) && isset( $allMessages[ $requestType ] ) )
			{
				$methodParameters[ $methodPath ] += ParseMessageParameters( $allMessages[ $requestType ], $allMessages, $allEnums, $fieldDescriptions, $requestType, [] );
			}

			if( empty( $generatedServices[ $serviceName ] ) )
			{
				$generatedServices[ $serviceName ] = [];
			}

			$generatedServices[ $serviceName ][ $methodName ] = true;
		}
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

ksort( $generatedServices );

foreach( $generatedServices as $serviceName => $methods )
{
	ksort( $methods );

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

file_put_contents(
	__DIR__ . DIRECTORY_SEPARATOR . 'api_from_protos.json',
	json_encode( $foundServices, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . PHP_EOL
);

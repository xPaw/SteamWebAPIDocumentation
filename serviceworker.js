self.addEventListener( 'install', () => self.skipWaiting() );
self.addEventListener( 'activate', ( event ) => event.waitUntil( self.clients.claim() ) );

self.addEventListener( 'fetch', ( event ) =>
{
	if( event.request.method !== 'GET' )
	{
		return;
	}

	event.respondWith( networkOrCache( event ) );
} );

async function networkOrCache( event )
{
	try
	{
		const response = await fetch( event.request, { cache: 'no-cache' } );

		if( response.ok )
		{
			event.waitUntil( async () =>
			{
				const cache = await caches.open( 'steamwebapi-cache' );
				cache.put( event.request, response.clone() );
			} );

			return response;
		}

		return Promise.reject( 'request-failed' );
	}
	catch( e )
	{
		const cache = await caches.open( 'steamwebapi-cache' );
		const matching = await cache.match( uri );
		return matching || Promise.reject( 'request-not-in-cache' );
	}
}

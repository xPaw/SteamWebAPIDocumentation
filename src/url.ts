export function parseInterfaceFromUrl(url: { pathname: string; hash: string } = location): [string, string | null] {
	const iface = url.pathname.substring(1);
	const method = url.hash.length > 1 ? url.hash.substring(1) : null;
	return [iface, method];
}

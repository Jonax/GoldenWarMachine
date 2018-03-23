let _paq = _paq || [];

const u = "//stats.goldenwolf.systems/";
const v = u + "piwik.php";

/* tracker methods like "setCustomDimension" should be called before "trackPageView" */
_paq.push(...[
	["setDocumentTitle", document.domain + "/" + document.title],
	["setCookieDomain", <%= mainDomain %>],
	["setDomains", <%= allDomains %>],
	["enableCrossDomainLinking"],
	["trackPageView"],
	["enableLinkTracking"]
]);

{
	_paq.push(...[
		["setTrackerUrl", v],
		["setSiteId", "<%= siteId %>"]
	]);

	const d = document;
	let g = d.createElement("script");
	let s = d.getElementsByTagName("script")[0];
	g.type = "text/javascript";
	g.async = true;
	g.defer = true;
	g.src = v;
	s.parentNode.insertBefore(g, s);
}

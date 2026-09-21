import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import {
    hasNonAttributionQuery,
    preserveAttributionQuery,
} from '../../lib/redirect-attribution';
import { middleware } from '../../middleware';

function normalizedRedirect(input: string, pathname: string): URL {
    const source = new URL(input);
    const target = new URL(input);
    target.pathname = pathname;
    preserveAttributionQuery(source.searchParams, target);
    return target;
}

const social = normalizedRedirect(
    'https://uma-free.com/races/2026-09-21?venue=%E6%9D%B1%E4%BA%AC&race=7&utm_source=x&utm_medium=organic_social&utm_campaign=race_post_v2&utm_content=night%2Brace&unknown=drop',
    '/races/2026-09-21/tokyo/7',
);
assert.equal(
    social.href,
    'https://uma-free.com/races/2026-09-21/tokyo/7?utm_source=x&utm_medium=organic_social&utm_campaign=race_post_v2&utm_content=night%2Brace',
);
assert.equal(hasNonAttributionQuery(social.searchParams), false);

const clickId = normalizedRedirect(
    'https://uma-free.com/guides/odds-reading-guide?gclid=AbC%2B1&fbclid=meta-1&junk=remove',
    '/articles/2025-11-13-odds-reading-guide',
);
assert.equal(
    clickId.href,
    'https://uma-free.com/articles/2025-11-13-odds-reading-guide?gclid=AbC%2B1&fbclid=meta-1',
);

const duplicate = normalizedRedirect(
    'https://uma-free.com/races/today?utm_source=x&utm_source=spoof&utm_medium=organic_social',
    '/races/2026-09-21',
);
assert.equal(
    duplicate.href,
    'https://uma-free.com/races/2026-09-21?utm_source=x&utm_medium=organic_social',
);

const onlyAttribution = new URL('https://uma-free.com/races/2026-09-21/tokyo/7?utm_source=x&utm_medium=organic_social');
assert.equal(hasNonAttributionQuery(onlyAttribution.searchParams), false);
assert.equal(hasNonAttributionQuery(new URL('https://uma-free.com/races/2026-09-21/tokyo/7?utm_source=x&_rsc=abc').searchParams), true);

function redirectLocation(url: string): URL {
    const response = middleware(new NextRequest(url));
    assert.ok(response.status >= 300 && response.status < 400, `${url} should redirect`);
    const location = response.headers.get('location');
    assert.ok(location, `${url} should include Location`);
    return new URL(location, 'https://uma-free.com');
}

const racesIndexRedirect = redirectLocation(
    'https://uma-free.com/races?utm_source=x&utm_medium=organic_social&unknown=drop',
);
assert.match(racesIndexRedirect.pathname, /^\/races\/\d{4}-\d{2}-\d{2}$/);
assert.equal(racesIndexRedirect.search, '?utm_source=x&utm_medium=organic_social');

const todayResponse = middleware(new NextRequest(
    'https://uma-free.com/races/today?utm_source=x&utm_medium=organic_social&unknown=drop',
));
assert.equal(todayResponse.status, 307);
assert.equal(todayResponse.headers.get('cache-control'), 'private, no-store');
assert.match(
    new URL(todayResponse.headers.get('location')!, 'https://uma-free.com').pathname,
    /^\/races\/\d{4}-\d{2}-\d{2}$/,
);
assert.equal(
    new URL(todayResponse.headers.get('location')!, 'https://uma-free.com').search,
    '?utm_source=x&utm_medium=organic_social',
);

const raceRedirect = redirectLocation(
    'https://uma-free.com/races/2026-09-21?venue=%E6%9D%B1%E4%BA%AC&race=7&utm_source=x&utm_medium=organic_social&utm_campaign=race_post_v2&utm_content=night%2Brace&unknown=drop',
);
assert.equal(raceRedirect.pathname, '/races/2026-09-21/tokyo/7');
assert.equal(
    raceRedirect.search,
    '?utm_source=x&utm_medium=organic_social&utm_campaign=race_post_v2&utm_content=night%2Brace',
);

const canonicalRace = middleware(new NextRequest(
    'https://uma-free.com/races/2026-09-21/tokyo/7?utm_source=x&utm_medium=organic_social',
));
assert.equal(canonicalRace.status, 200);
assert.equal(canonicalRace.headers.get('location'), null);

const canonicalDate = middleware(new NextRequest(
    'https://uma-free.com/races/2026-09-21?utm_source=x&utm_medium=organic_social',
));
assert.equal(canonicalDate.status, 200);
assert.equal(canonicalDate.headers.get('location'), null);

const rscRace = middleware(new NextRequest(
    'https://uma-free.com/races/2026-09-21/tokyo/7?utm_source=x&utm_medium=organic_social',
    { headers: { rsc: '1' } },
));
const rscRaceWithoutAttribution = middleware(new NextRequest(
    'https://uma-free.com/races/2026-09-21/tokyo/7',
    { headers: { rsc: '1' } },
));
assert.equal(rscRace.status, 200);
assert.equal(rscRace.headers.get('location'), null);
assert.equal(rscRace.headers.get('cache-control'), null);
assert.equal(rscRace.headers.get('x-race-cache-tier'), null);
assert.equal(rscRaceWithoutAttribution.headers.get('cache-control'), null);
assert.equal(rscRaceWithoutAttribution.headers.get('x-race-cache-tier'), null);

const normalizedStableRace = redirectLocation(
    'https://uma-free.com/races/2026-09-21/TOKYO/7R?utm_source=x&utm_medium=organic_social',
);
assert.equal(normalizedStableRace.pathname, '/races/2026-09-21/tokyo/7');
assert.equal(normalizedStableRace.search, '?utm_source=x&utm_medium=organic_social');

const unknownRaceQuery = redirectLocation(
    'https://uma-free.com/races/2026-09-21/tokyo/7?utm_source=x&unknown=drop',
);
assert.equal(unknownRaceQuery.pathname, '/races/2026-09-21/tokyo/7');
assert.equal(unknownRaceQuery.search, '?utm_source=x');

const invalidDateRedirect = redirectLocation(
    'https://uma-free.com/races/not-a-date?utm_source=x&utm_medium=organic_social',
);
assert.match(invalidDateRedirect.pathname, /^\/races\/\d{4}-\d{2}-\d{2}$/);
assert.equal(invalidDateRedirect.search, '?utm_source=x&utm_medium=organic_social');

const retiredDateResponse = middleware(new NextRequest(
    'https://uma-free.com/races/2025-12-31?utm_source=x&utm_medium=organic_social',
));
assert.equal(retiredDateResponse.status, 410);
assert.equal(retiredDateResponse.headers.get('location'), null);
assert.equal(retiredDateResponse.headers.get('cache-control'), 'public, max-age=86400');

const categoryRedirect = redirectLocation(
    'https://uma-free.com/articles?category=course-data&tag=%E8%8A%9D&page=2&utm_source=x&utm_medium=organic_social&unknown=drop',
);
assert.equal(categoryRedirect.pathname, '/articles/category/%E3%82%B3%E3%83%BC%E3%82%B9%E5%88%86%E6%9E%90');
assert.equal(categoryRedirect.searchParams.get('tag'), '芝');
assert.equal(categoryRedirect.searchParams.get('page'), '2');
assert.equal(categoryRedirect.searchParams.get('utm_source'), 'x');
assert.equal(categoryRedirect.searchParams.get('unknown'), null);

const guideRedirect = redirectLocation(
    'https://uma-free.com/guides/odds-reading-guide?gclid=AbC%2B1&unknown=drop',
);
assert.equal(guideRedirect.pathname, '/articles/2025-11-13-odds-reading-guide');
assert.equal(guideRedirect.search, '?gclid=AbC%2B1');

const httpLegacyRedirect = redirectLocation(
    'http://uma-free.com/data?utm_source=x&utm_medium=organic_social&unknown=drop',
);
assert.equal(httpLegacyRedirect.protocol, 'http:');
assert.equal(httpLegacyRedirect.pathname, '/keiba-data');
assert.equal(httpLegacyRedirect.search, '?utm_source=x&utm_medium=organic_social');

console.log('redirect attribution: OK');

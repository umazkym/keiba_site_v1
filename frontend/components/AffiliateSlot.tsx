'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, ShoppingBag, Ticket } from 'lucide-react';
import {
    type AffiliateContext,
    type AffiliateProvider,
    type RaceType,
    getActiveAffiliateLinks,
    getAffiliateCampaignsForContext,
    selectWeightedAffiliateCampaign,
} from '@/lib/affiliate-campaigns';
import { sendAffiliateClickEvent, sendAffiliateImpressionEvent } from '@/lib/analytics';
import {
    resolveRakutenAffiliateLink,
    type ResolvedAffiliateLink,
} from '@/lib/affiliate-url-resolver';

type AffiliateSlotProps = {
    context: AffiliateContext;
    raceType?: RaceType;
    venueName?: string;
    selectionKey?: string;
    className?: string;
    fallback?: ReactNode;
};

const providerLabels: Record<AffiliateProvider, string> = {
    rakuten_keiba: '楽天競馬',
    spat4: 'SPAT4',
    oddspark: 'オッズパーク',
    rakuten: '楽天',
    amazon: 'Amazon',
    official: '公式',
};

const providerClassNames: Record<AffiliateProvider, string> = {
    rakuten_keiba: 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:border-rose-700 shadow-sm',
    spat4: 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700 hover:border-sky-700 shadow-sm',
    oddspark: 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700 hover:border-amber-700 shadow-sm',
    rakuten: 'border-rose-600 bg-rose-600 text-white hover:bg-rose-700 hover:border-rose-700 shadow-sm',
    amazon: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100',
    official: 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 shadow-sm',
};

export const AffiliateSlot = ({
    context,
    raceType,
    venueName,
    selectionKey = '',
    className = '',
    fallback = null,
}: AffiliateSlotProps) => {
    const campaigns = getAffiliateCampaignsForContext({ context, raceType, venueName });
    const seed = `${context}:${raceType ?? 'all'}:${venueName ?? 'all'}:${selectionKey}`;
    const campaign = selectWeightedAffiliateCampaign(campaigns, seed);
    const links = useMemo(() => {
        return campaign ? getActiveAffiliateLinks(campaign) : [];
    }, [campaign]);
    const mainLinks = useMemo(() => {
        if (campaign?.type === 'product') {
            const rLink = links.find((link) => link.provider === 'rakuten');
            if (rLink) return [rLink];
            return links.slice(0, 1);
        }
        return links;
    }, [campaign, links]);
    const subLinks = useMemo(() => {
        if (campaign?.type === 'product') {
            const mLink = mainLinks[0];
            return links.filter((link) => link.id !== mLink?.id);
        }
        return [];
    }, [campaign, links, mainLinks]);
    const linkSignature = links.map((link) => `${link.id}:${link.provider}:${link.url}`).join('|');
    const [resolvedLinks, setResolvedLinks] = useState<Record<string, ResolvedAffiliateLink>>({});
    const slotRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        const rakutenLinks = links.filter((link) => link.provider === 'rakuten' && link.url.trim());
        if (rakutenLinks.length === 0) return undefined;

        Promise.all(
            rakutenLinks.map(async (link) => {
                const resolvedLink = await resolveRakutenAffiliateLink(link.url);
                return resolvedLink ? [link.id, resolvedLink] as const : null;
            })
        ).then((entries) => {
            if (cancelled) return;
            const nextLinks = entries.reduce<Record<string, ResolvedAffiliateLink>>((accumulator, entry) => {
                if (entry) {
                    accumulator[entry[0]] = entry[1];
                }
                return accumulator;
            }, {});
            if (Object.keys(nextLinks).length > 0) {
                setResolvedLinks((current) => ({ ...current, ...nextLinks }));
            }
        });

        return () => {
            cancelled = true;
        };
    }, [linkSignature, links]);

    useEffect(() => {
        if (!campaign || links.length === 0 || typeof window === 'undefined') {
            return undefined;
        }

        const node = slotRef.current;
        if (!node) return undefined;

        const providers = Array.from(new Set(links.map((link) => link.provider))).join(',');
        const sendImpression = () => {
            sendAffiliateImpressionEvent({
                campaign_id: campaign.id,
                providers,
                context,
                campaign_type: campaign.type,
                link_count: links.length,
                race_type: raceType,
                venue_name: venueName,
            });
        };

        if (!('IntersectionObserver' in window)) {
            sendImpression();
            return undefined;
        }

        let hasSent = false;
        const observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (!entry || hasSent) return;

            if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
                hasSent = true;
                sendImpression();
                observer.disconnect();
            }
        }, { threshold: [0, 0.4, 0.75] });

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [campaign, context, links, raceType, venueName]);

    if (!campaign) {
        return <>{fallback}</>;
    }

    if (links.length === 0) {
        return <>{fallback}</>;
    }

    const Icon = campaign.type === 'voting' ? Ticket : ShoppingBag;
    const iconWrapperClassName = campaign.type === 'voting'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-emerald-50 text-emerald-700';
    const productPreview = campaign.type === 'product'
        ? links.map((link) => resolvedLinks[link.id]).find((link) => link?.imageUrl || link?.itemPrice || link?.itemName)
        : null;
    const productPriceLabel = productPreview?.itemPrice
        ? new Intl.NumberFormat('ja-JP').format(productPreview.itemPrice)
        : null;

    return (
        <section
            ref={slotRef}
            className={`my-2 sm:my-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}
            aria-label={`${campaign.title} 広告リンク`}
        >
            <div className="flex gap-3">
                {campaign.type === 'product' ? (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 sm:h-24 sm:w-24">
                        {productPreview?.imageUrl ? (
                            <img
                                src={productPreview.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <Icon className="h-6 w-6 text-slate-300" />
                        )}
                    </div>
                ) : (
                    <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrapperClassName}`}>
                        <Icon className="h-4 w-4" />
                    </span>
                )}

                <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            PR
                        </span>
                        {productPriceLabel && (
                            <span className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                楽天 {productPriceLabel}円
                            </span>
                        )}
                    </div>
                    <h3 className="text-[13px] font-bold leading-tight text-slate-800 sm:text-sm">
                        {campaign.title}
                    </h3>
                    {campaign.description && (
                        <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs">
                            {campaign.description}
                        </p>
                    )}

                    <div className="mt-2 flex flex-col gap-2">
                        <div className={`grid gap-2 ${mainLinks.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                            {mainLinks.map((link) => (
                                <a
                                    key={link.id}
                                    href={resolvedLinks[link.id]?.affiliateUrl || link.url}
                                    target="_blank"
                                    rel="sponsored nofollow noopener noreferrer"
                                    onClick={() => sendAffiliateClickEvent({
                                        campaign_id: campaign.id,
                                        link_id: link.id,
                                        provider: link.provider,
                                        context,
                                        campaign_type: campaign.type,
                                        race_type: raceType,
                                        venue_name: venueName,
                                    })}
                                    className={`inline-flex min-h-[40px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${providerClassNames[link.provider]}`}
                                >
                                    <span className="min-w-0 truncate">{link.label || providerLabels[link.provider]}</span>
                                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                </a>
                            ))}
                        </div>

                        {subLinks.length > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                                <span className="shrink-0">他のショップで探す:</span>
                                {subLinks.map((link) => (
                                    <a
                                        key={link.id}
                                        href={resolvedLinks[link.id]?.affiliateUrl || link.url}
                                        target="_blank"
                                        rel="sponsored nofollow noopener noreferrer"
                                        onClick={() => sendAffiliateClickEvent({
                                            campaign_id: campaign.id,
                                            link_id: link.id,
                                            provider: link.provider,
                                            context,
                                            campaign_type: campaign.type,
                                            race_type: raceType,
                                            venue_name: venueName,
                                        })}
                                        className="font-semibold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-0.5"
                                    >
                                        {providerLabels[link.provider]}
                                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {campaign.attention && (
                <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-400">
                    {campaign.attention}
                </p>
            )}
        </section>
    );
};

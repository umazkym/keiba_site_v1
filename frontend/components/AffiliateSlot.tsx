'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ExternalLink, ShoppingBag, Ticket } from 'lucide-react';
import {
    type AffiliateContext,
    type AffiliateProvider,
    type RaceType,
    type RakutenKeibaMode,
    getActiveAffiliateLinks,
    getAffiliateCampaignsForContext,
    getRakutenKeibaAffiliateUrl,
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
    variant?: 'default' | 'compact';
    className?: string;
    fallback?: ReactNode;
    rakutenMode?: RakutenKeibaMode;
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
    rakuten_keiba: 'border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50',
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
    variant = 'default',
    className = '',
    fallback = null,
    rakutenMode,
}: AffiliateSlotProps) => {
    const campaigns = getAffiliateCampaignsForContext({ context, raceType, venueName, rakutenMode });
    const seed = `${context}:${raceType ?? 'all'}:${venueName ?? 'all'}:${selectionKey}`;
    const campaign = selectWeightedAffiliateCampaign(campaigns, seed);
    const links = useMemo(() => {
        if (!campaign) return [];

        return getActiveAffiliateLinks(campaign).map((link) => {
            if (link.provider !== 'rakuten_keiba') return link;
            return {
                ...link,
                url: getRakutenKeibaAffiliateUrl(context, raceType),
            };
        });
    }, [campaign, context, raceType]);
    const mainLinks = useMemo(() => {
        if (campaign?.type === 'voting') {
            // 投票系: 最初の1リンクのみ主ボタンにする（将来複数対応時の保険）
            return links.slice(0, 1);
        }
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
        if (campaign?.type === 'voting') {
            // 投票系でも複数リンクがあれば控えめに表示
            return links.slice(1);
        }
        return [];
    }, [campaign, links, mainLinks]);
    const linkSignature = links.map((link) => `${link.id}:${link.provider}:${link.url}`).join('|');
    const [resolvedLinks, setResolvedLinks] = useState<Record<string, ResolvedAffiliateLink>>({});
    const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set());
    const slotRef = useRef<HTMLElement | null>(null);
    const setSlotRef = useCallback((node: HTMLElement | null) => {
        slotRef.current = node;
    }, []);

    useEffect(() => {
        let cancelled = false;
        setResolvedLinks({});
        setFailedImageUrls(new Set());
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
        const primaryLink = mainLinks[0] ?? links[0];
        const sendImpression = () => {
            sendAffiliateImpressionEvent({
                campaign_id: campaign.id,
                link_id: primaryLink.id,
                provider: primaryLink.provider,
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
    }, [campaign, context, links, mainLinks, raceType, venueName]);

    if (!campaign) {
        return <>{fallback}</>;
    }

    if (links.length === 0) {
        return <>{fallback}</>;
    }

    const Icon = campaign.type === 'voting' ? Ticket : ShoppingBag;
    const isCompact = variant === 'compact';
    const iconWrapperClassName = campaign.type === 'voting'
        ? 'border border-rose-100 bg-white text-rose-600'
        : 'bg-emerald-50 text-emerald-700';
    const productPreview = campaign.type === 'product'
        ? links.map((link) => resolvedLinks[link.id]).find((link) => link?.imageUrl || link?.itemPrice || link?.itemName)
        : null;
    const productPriceLabel = productPreview?.itemPrice
        ? new Intl.NumberFormat('ja-JP').format(productPreview.itemPrice)
        : null;
    const productPreviewImageUrl = productPreview?.imageUrl && !failedImageUrls.has(productPreview.imageUrl)
        ? productPreview.imageUrl
        : null;
    const fallbackVisualLabel = campaign.fallbackVisualLabel || '競馬グッズ';
    const sectionClassName = isCompact
        ? campaign.type === 'voting'
            ? 'my-1.5 sm:my-2 rounded-lg border border-rose-100 bg-rose-50/30 p-2 sm:p-2.5'
            : 'my-1.5 sm:my-2 rounded-xl border border-rose-100 bg-rose-50/35 p-2 shadow-sm sm:p-2.5'
        : campaign.type === 'voting'
            ? 'my-1.5 sm:my-3 rounded-lg border border-rose-100 bg-rose-50/25 p-2.5 sm:p-3'
            : 'my-1.5 sm:my-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3';
    const wholeSlotLink = !campaign.ctaOnly
        && campaign.type === 'voting'
        && mainLinks.length === 1
        && subLinks.length === 0
        ? mainLinks[0]
        : null;
    const wholeSlotHref = wholeSlotLink
        ? resolvedLinks[wholeSlotLink.id]?.affiliateUrl || wholeSlotLink.url
        : '';
    const trackAffiliateClick = (link: typeof links[number]) => {
        sendAffiliateClickEvent({
            campaign_id: campaign.id,
            link_id: link.id,
            provider: link.provider,
            context,
            campaign_type: campaign.type,
            race_type: raceType,
            venue_name: venueName,
        });
    };

    return (
        <section
            ref={setSlotRef}
            className={`${sectionClassName} ${wholeSlotLink ? 'relative cursor-pointer transition-colors hover:border-rose-200 hover:bg-rose-50/50 focus-within:ring-2 focus-within:ring-rose-500/20' : ''} ${className}`}
            data-affiliate-context={context}
            data-affiliate-campaign={campaign.id}
            data-affiliate-variant={variant}
            aria-label={`${campaign.title} 広告リンク`}
        >
            {wholeSlotLink && (
                <a
                    href={wholeSlotHref}
                    target="_blank"
                    rel="sponsored nofollow noopener noreferrer"
                    onClick={() => trackAffiliateClick(wholeSlotLink)}
                    className="absolute inset-0 z-10 rounded-lg focus:outline-none"
                    aria-label={`${wholeSlotLink.label || providerLabels[wholeSlotLink.provider]}を開く`}
                />
            )}
            <div className={isCompact ? 'flex gap-2' : 'flex gap-2.5 sm:gap-3'}>
                {campaign.type === 'product' ? (
                    <div className={`${isCompact ? 'h-16 w-16 sm:h-20 sm:w-20' : 'h-20 w-20 sm:h-24 sm:w-24'} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white`}>
                        {productPreviewImageUrl ? (
                            <img
                                src={productPreviewImageUrl}
                                alt={campaign.title}
                                className="h-full w-full object-contain p-1.5"
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                onError={() => {
                                    setFailedImageUrls((current) => {
                                        const next = new Set(current);
                                        next.add(productPreviewImageUrl);
                                        return next;
                                    });
                                }}
                            />
                        ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-rose-50 via-white to-amber-50 px-1.5 text-center">
                                <Icon className="mb-1 h-5 w-5 text-rose-300" />
                                <span className="text-[10px] font-bold leading-tight text-rose-700">
                                    {fallbackVisualLabel}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <span className={`mt-0.5 flex shrink-0 items-center justify-center rounded-lg ${isCompact ? 'h-7 w-7' : 'h-7 w-7 sm:h-8 sm:w-8'} ${iconWrapperClassName}`}>
                        <Icon className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                    </span>
                )}

                <div className="min-w-0 flex-1">
                    <div className={`${isCompact ? 'mb-1' : 'mb-1.5'} flex flex-wrap items-center gap-1.5`}>
                        <span className="rounded border border-rose-100 bg-white px-1.5 py-0.5 text-[10px] font-bold text-rose-600 sm:text-[11px]">
                            PR
                        </span>
                        {productPriceLabel && (
                            <span className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                楽天 {productPriceLabel}円
                            </span>
                        )}
                    </div>
                    <h3 className={`${isCompact ? 'text-xs sm:text-[13px]' : 'text-sm sm:text-sm'} font-bold leading-tight text-slate-700`}>
                        {campaign.title}
                    </h3>
                    {campaign.showDescription && campaign.description && (
                        <p className={`${isCompact ? 'mt-1 text-[11px] leading-[1.55]' : 'mt-1 text-[11px] leading-[1.55] sm:text-xs sm:leading-5'} text-slate-600`}>
                            {campaign.description}
                        </p>
                    )}

                    <div className={`${isCompact ? 'mt-1.5' : 'mt-1.5 sm:mt-2'} flex flex-col gap-1.5 sm:gap-2`}>
                        {wholeSlotLink ? (
                            <div className={`inline-flex w-full items-center justify-between gap-2 rounded-lg border border-rose-100 bg-white/80 px-3 py-1.5 text-xs font-bold text-rose-700 ${isCompact ? 'min-h-[32px] sm:min-h-[36px]' : 'min-h-[34px] sm:min-h-[40px]'}`}>
                                <span className="min-w-0 truncate">{wholeSlotLink.label || providerLabels[wholeSlotLink.provider]}</span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            </div>
                        ) : (
                            <div className={`grid gap-1.5 sm:gap-2 ${mainLinks.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                                {mainLinks.map((link) => (
                                    <a
                                        key={link.id}
                                        href={resolvedLinks[link.id]?.affiliateUrl || link.url}
                                        target="_blank"
                                        rel="sponsored nofollow noopener noreferrer"
                                        onClick={() => trackAffiliateClick(link)}
                                        className={`inline-flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 ${campaign.ctaOnly ? 'min-h-11' : isCompact ? 'min-h-[32px] sm:min-h-[36px]' : 'min-h-[34px] sm:min-h-[40px]'} ${providerClassNames[link.provider]}`}
                                    >
                                        <span className="min-w-0 truncate">{link.label || providerLabels[link.provider]}</span>
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                    </a>
                                ))}
                            </div>
                        )}

                        {subLinks.length > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
                                <span className="shrink-0">他のショップで探す:</span>
                                {subLinks.map((link) => (
                                    <a
                                        key={link.id}
                                        href={resolvedLinks[link.id]?.affiliateUrl || link.url}
                                        target="_blank"
                                        rel="sponsored nofollow noopener noreferrer"
                                        onClick={() => trackAffiliateClick(link)}
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
                <p className={`${isCompact ? 'mt-1.5 pt-1.5' : 'mt-1.5 pt-1.5 sm:mt-2 sm:pt-2'} border-t border-slate-100 ${campaign.ctaOnly ? 'text-[11px] text-slate-500' : 'text-[10px] text-slate-400'} leading-4`}>
                    {campaign.attention}
                </p>
            )}
        </section>
    );
};

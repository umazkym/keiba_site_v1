'use client';

import type { ReactNode } from 'react';
import { ExternalLink, ShoppingBag, Ticket } from 'lucide-react';
import {
    type AffiliateContext,
    type AffiliateProvider,
    type RaceType,
    getActiveAffiliateLinks,
    getAffiliateCampaignsForContext,
    selectWeightedAffiliateCampaign,
} from '@/lib/affiliate-campaigns';
import { sendAffiliateClickEvent } from '@/lib/analytics';

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
    rakuten_keiba: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100',
    spat4: 'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100',
    oddspark: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100',
    rakuten: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100',
    amazon: 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100',
    official: 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100',
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

    if (!campaign) {
        return <>{fallback}</>;
    }

    const links = getActiveAffiliateLinks(campaign);
    if (links.length === 0) {
        return <>{fallback}</>;
    }

    const Icon = campaign.type === 'voting' ? Ticket : ShoppingBag;
    const iconWrapperClassName = campaign.type === 'voting'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-emerald-50 text-emerald-700';

    return (
        <section
            className={`my-2 sm:my-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}
            aria-label={`${campaign.title} 広告リンク`}
        >
            <div className="mb-2 flex items-start gap-2.5">
                <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrapperClassName}`}>
                    <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            PR
                        </span>
                        <h3 className="text-[13px] font-bold leading-tight text-slate-800 sm:text-sm">
                            {campaign.title}
                        </h3>
                    </div>
                    {campaign.description && (
                        <p className="text-[11px] leading-5 text-slate-500 sm:text-xs">
                            {campaign.description}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                {links.map((link) => (
                    <a
                        key={link.id}
                        href={link.url}
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
                        className={`inline-flex min-h-[42px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${providerClassNames[link.provider]}`}
                    >
                        <span className="min-w-0 truncate">{link.label || providerLabels[link.provider]}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                ))}
            </div>

            {campaign.attention && (
                <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-4 text-slate-400">
                    {campaign.attention}
                </p>
            )}
        </section>
    );
};

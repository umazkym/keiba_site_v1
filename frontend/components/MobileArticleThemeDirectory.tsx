'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LineIcon, type LineIconName } from '@/components/LineIcon';

type ArchiveGroup = {
    href: string;
    title: string;
    articleCount: number;
};

type GradeRaceSection = {
    id: string;
    title: string;
    groups: ArchiveGroup[];
    articleCount: number;
};

type CourseVenueSection = {
    id: string;
    title: string;
    groups: ArchiveGroup[];
    articleCount: number;
};

type ThemeKey = 'grade' | 'jockey' | 'course';

type Props = {
    gradeRaceSections: GradeRaceSection[];
    jockeyGroups: ArchiveGroup[];
    courseSections: CourseVenueSection[];
    className?: string;
};

const THEME_ICONS: Record<ThemeKey, LineIconName> = { grade: 'trophy', jockey: 'user', course: 'pin' };

const GroupLinks = ({ groups }: { groups: ArchiveGroup[] }) => (
    <div className="divide-y divide-slate-100">
        {groups.filter(group => group.articleCount > 0).map(group => (
            <Link
                prefetch={false}
                key={group.href}
                href={group.href}
                className="flex min-h-10 items-center justify-between gap-3 px-3.5 py-2.5 text-[14px] font-bold text-slate-800 transition-colors duration-150 hover:bg-slate-50 hover:text-brand-700"
            >
                <span className="min-w-0 truncate">{group.title}</span>
                <span className="shrink-0 font-num text-[12.5px] font-semibold text-slate-500">{group.articleCount}記事</span>
            </Link>
        ))}
    </div>
);

const getGradeSectionLabel = (sectionId: string, fallback: string) => {
    const labels: Record<string, string> = {
        'jra-g1': 'G1',
        'jra-g2': 'G2',
        'jra-g3': 'G3',
        'jra-other': 'その他',
        'nar-jpn1': 'Jpn1',
        'nar-jpn2': 'Jpn2',
        'nar-jpn3': 'Jpn3',
        'nar-other': 'その他',
    };
    return labels[sectionId] ?? fallback;
};

const getGradeSectionTone = (sectionId: string) => {
    void sectionId;
    return 'border-slate-200 bg-slate-50 text-slate-800';
};

// 記事一覧（スマホ）の記事テーマ。2026-09-25 のスマホの見直しで、ヘッダーの下への追従をやめ、ページ送りの下へ移した
// （ヘッダー・このバー・下のアンカー広告で画面の2割を常にふさいでいたため）。
// 数（記事数とテーマ数が混ざっていた）と、選択中の上の色の帯は外し、開いているテーマだけを選択中の見た目にする。
export function MobileArticleThemeDirectory({ gradeRaceSections, jockeyGroups, courseSections, className = '' }: Props) {
    const [activeTheme, setActiveTheme] = useState<ThemeKey>('grade');
    const [isOpen, setIsOpen] = useState(false);
    const themes: Array<{ key: ThemeKey; label: string }> = [
        { key: 'grade', label: '重賞' },
        { key: 'jockey', label: '騎手' },
        { key: 'course', label: 'コース' },
    ];

    return (
        <section className={`lg:hidden ${className}`} aria-labelledby="mobile-article-theme-heading">
            <h2 id="mobile-article-theme-heading" className="mb-2 font-display text-[18px] font-bold leading-snug text-slate-900">
                記事テーマ
            </h2>
            <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
                <div className={`grid grid-cols-3 divide-x divide-slate-200 ${isOpen ? 'border-b border-slate-200' : ''}`} role="tablist" aria-label="記事テーマを選択">
                    {themes.map(theme => {
                        const isActive = activeTheme === theme.key;
                        const isShown = isActive && isOpen;
                        return (
                            <button
                                key={theme.key}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-controls="mobile-article-theme-panel"
                                aria-expanded={isShown}
                                onClick={() => {
                                    if (isActive) {
                                        setIsOpen(current => !current);
                                    } else {
                                        setActiveTheme(theme.key);
                                        setIsOpen(true);
                                    }
                                }}
                                className={`flex min-h-10 items-center justify-center gap-1.5 px-2 text-[13.5px] font-bold transition-colors duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${isShown
                                    ? 'bg-brand-50/70 text-navy'
                                    : 'bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                <LineIcon name={THEME_ICONS[theme.key]} size={17} className={`block ${isShown ? 'text-brand-600' : 'text-slate-500'}`} />
                                <span>{theme.label}</span>
                                <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-3 w-3 text-slate-500 transition-transform duration-150 ${isShown ? 'rotate-180' : ''}`} fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                                </svg>
                            </button>
                        );
                    })}
                </div>
                {isOpen && <div id="mobile-article-theme-panel" role="tabpanel" className="max-h-[420px] overflow-y-auto overscroll-contain">
                    {activeTheme === 'grade' && (
                        <div className="grid gap-1.5 p-2">
                            {gradeRaceSections.map(section => (
                                <details key={section.id} className={`group/grade overflow-hidden rounded-lg border ${getGradeSectionTone(section.id)}`}>
                                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2 text-[14px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600">
                                        <span>{getGradeSectionLabel(section.id, section.title)}</span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="rounded bg-white px-2 py-0.5 text-[12px] font-semibold text-slate-600">
                                                {section.groups.length}レース / {section.articleCount}記事
                                            </span>
                                            <span aria-hidden="true" className="text-slate-500 transition-transform duration-150 group-open/grade:rotate-90">›</span>
                                        </span>
                                    </summary>
                                    <div className="border-t border-current/10 bg-white">
                                        <GroupLinks groups={section.groups} />
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}
                    {activeTheme === 'jockey' && <GroupLinks groups={jockeyGroups} />}
                    {activeTheme === 'course' && (
                        <div className="grid gap-1.5 p-2">
                            {courseSections.map(section => (
                                <details key={section.id} className="group/venue overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-800">
                                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2 text-[14px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600">
                                        <span>{section.title}</span>
                                        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
                                            <span>{section.groups.length}コース / {section.articleCount}記事</span>
                                            <span aria-hidden="true" className="transition-transform duration-150 group-open/venue:rotate-90">›</span>
                                        </span>
                                    </summary>
                                    <div className="border-t border-slate-200 bg-white">
                                        <GroupLinks groups={section.groups} />
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}
                </div>}
            </div>
        </section>
    );
}

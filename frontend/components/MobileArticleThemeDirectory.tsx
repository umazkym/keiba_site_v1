'use client';

import Link from 'next/link';
import { useState } from 'react';

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

type ThemeKey = 'grade' | 'jockey' | 'course';

type Props = {
    gradeRaceSections: GradeRaceSection[];
    jockeyGroups: ArchiveGroup[];
    courseGroups: ArchiveGroup[];
};

const ThemeIcon = ({ theme }: { theme: ThemeKey }) => {
    if (theme === 'jockey') {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 18c1.5-2.4 3.2-3.6 5-3.6s3.5 1.2 5 3.6M12 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
            </svg>
        );
    }
    if (theme === 'course') {
        return (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 17.5h16M6 14V9m4 5V6m4 8v-3m4 3V4" />
            </svg>
        );
    }
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h8v3a4 4 0 0 1-8 0V4Zm4 7v5m-3 3h6M7.5 5H5v1.5A4.5 4.5 0 0 0 9 11m7.5-6H19v1.5a4.5 4.5 0 0 1-4 4.5" />
        </svg>
    );
};

const GroupLinks = ({ groups }: { groups: ArchiveGroup[] }) => (
    <div className="divide-y divide-slate-100">
        {groups.filter(group => group.articleCount > 0).map(group => (
            <Link
                key={group.href}
                href={group.href}
                className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm font-bold text-slate-700 transition-colors duration-150 hover:bg-slate-50 hover:text-primary"
            >
                <span className="min-w-0 truncate">{group.title}</span>
                <span className="shrink-0 text-[11px] font-black text-slate-500">{group.articleCount}記事</span>
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
    if (sectionId === 'jra-g1' || sectionId === 'nar-jpn1') return 'border-amber-200 bg-amber-50 text-amber-950';
    if (sectionId === 'jra-g2' || sectionId === 'nar-jpn2') return 'border-red-200 bg-red-50 text-red-950';
    if (sectionId === 'jra-g3' || sectionId === 'nar-jpn3') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
    return 'border-slate-200 bg-slate-50 text-slate-800';
};

export function MobileArticleThemeDirectory({ gradeRaceSections, jockeyGroups, courseGroups }: Props) {
    const [activeTheme, setActiveTheme] = useState<ThemeKey>('grade');
    const [isOpen, setIsOpen] = useState(false);
    const gradeCount = gradeRaceSections.reduce((sum, section) => sum + section.articleCount, 0);
    const themes: Array<{ key: ThemeKey; label: string; count: number }> = [
        { key: 'grade', label: '重賞', count: gradeCount },
        { key: 'jockey', label: '騎手', count: jockeyGroups.filter(group => group.articleCount > 0).length },
        { key: 'course', label: 'コース', count: courseGroups.filter(group => group.articleCount > 0).length },
    ];

    return (
        <section className="article-theme-sticky mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white lg:hidden" aria-label="記事テーマ">
            <div className={`grid grid-cols-3 divide-x divide-slate-200 ${isOpen ? 'border-b border-slate-200' : ''}`} role="tablist" aria-label="記事テーマを選択">
                {themes.map(theme => {
                    const isActive = activeTheme === theme.key;
                    return (
                        <button
                            key={theme.key}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls="mobile-article-theme-panel"
                            aria-expanded={isActive && isOpen}
                            onClick={() => {
                                if (isActive) {
                                    setIsOpen(current => !current);
                                } else {
                                    setActiveTheme(theme.key);
                                    setIsOpen(true);
                                }
                            }}
                            className={`flex min-h-11 items-center justify-center gap-1.5 border-t-2 px-2 text-xs font-black transition-colors duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isActive
                                ? 'border-blue-600 bg-blue-50/70 text-slate-950'
                                : 'border-transparent bg-white text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <ThemeIcon theme={theme.key} />
                            <span>{theme.label}</span>
                            <span className="text-[10px] text-slate-400">{theme.count}</span>
                            {isActive && (
                                <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-3 w-3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} fill="currentColor">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    );
                })}
            </div>
            {isOpen && <div id="mobile-article-theme-panel" role="tabpanel" className="max-h-[420px] overflow-y-auto overscroll-contain">
                {activeTheme === 'grade' && (
                    <div className="grid gap-1.5 p-1.5">
                        {gradeRaceSections.map(section => (
                            <details key={section.id} className={`group/grade overflow-hidden rounded-lg border ${getGradeSectionTone(section.id)}`}>
                                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-1.5 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600">
                                    <span>{getGradeSectionLabel(section.id, section.title)}</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="rounded bg-white px-2 py-0.5 text-[10px] text-slate-600">
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
                {activeTheme === 'course' && <GroupLinks groups={courseGroups} />}
            </div>}
        </section>
    );
}

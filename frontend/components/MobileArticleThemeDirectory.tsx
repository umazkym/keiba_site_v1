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
                <span className="shrink-0 text-[11px] font-black text-slate-400">{group.articleCount}</span>
            </Link>
        ))}
    </div>
);

export function MobileArticleThemeDirectory({ gradeRaceSections, jockeyGroups, courseGroups }: Props) {
    const [activeTheme, setActiveTheme] = useState<ThemeKey>('grade');
    const gradeCount = gradeRaceSections.reduce((sum, section) => sum + section.articleCount, 0);
    const themes: Array<{ key: ThemeKey; label: string; count: number }> = [
        { key: 'grade', label: '重賞', count: gradeCount },
        { key: 'jockey', label: '騎手', count: jockeyGroups.filter(group => group.articleCount > 0).length },
        { key: 'course', label: 'コース', count: courseGroups.filter(group => group.articleCount > 0).length },
    ];

    return (
        <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white lg:hidden" aria-label="記事テーマ">
            <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200" role="tablist" aria-label="記事テーマを選択">
                {themes.map(theme => {
                    const isActive = activeTheme === theme.key;
                    return (
                        <button
                            key={theme.key}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls="mobile-article-theme-panel"
                            onClick={() => setActiveTheme(theme.key)}
                            className={`flex min-h-11 items-center justify-center gap-1.5 border-t-2 px-2 text-xs font-black transition-colors duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${isActive
                                ? 'border-blue-600 bg-blue-50/70 text-slate-950'
                                : 'border-transparent bg-white text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <ThemeIcon theme={theme.key} />
                            <span>{theme.label}</span>
                            <span className="text-[10px] text-slate-400">{theme.count}</span>
                        </button>
                    );
                })}
            </div>
            <div id="mobile-article-theme-panel" role="tabpanel" className="max-h-[300px] overflow-y-auto overscroll-contain">
                {activeTheme === 'grade' && (
                    <div className="divide-y divide-slate-200">
                        {gradeRaceSections.map(section => (
                            <section key={section.id} aria-label={section.title}>
                                <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 text-[11px] font-black text-slate-600">
                                    <span>{section.title}</span>
                                    <span>{section.articleCount}件</span>
                                </div>
                                <GroupLinks groups={section.groups} />
                            </section>
                        ))}
                    </div>
                )}
                {activeTheme === 'jockey' && <GroupLinks groups={jockeyGroups} />}
                {activeTheme === 'course' && <GroupLinks groups={courseGroups} />}
            </div>
        </section>
    );
}

'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { sendHomeRaceEntryClickEvent, type HomeRaceEntryMethod } from '@/lib/analytics';

type HomeRaceEntryLinkProps = Omit<ComponentProps<typeof Link>, 'onClick'> & {
    raceDate: string;
    entryMethod: HomeRaceEntryMethod;
};

export const HomeRaceEntryLink = ({
    raceDate,
    entryMethod,
    children,
    prefetch = false,
    ...linkProps
}: HomeRaceEntryLinkProps) => (
    <Link
        {...linkProps}
        prefetch={prefetch}
        onClick={() => {
            sendHomeRaceEntryClickEvent({
                race_date: raceDate,
                entry_method: entryMethod,
            });
        }}
    >
        {children}
    </Link>
);

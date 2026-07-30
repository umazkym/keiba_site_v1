'use client';

import { useEffect } from 'react';
import { sendDataEntityViewEvent, type DataEntityEventType } from '@/lib/analytics';
import { recordDataHistory } from '@/lib/my-data';


type Props = {
    entityType: DataEntityEventType;
    entityId: string;
    name: string;
    subtitle: string;
    url: string;
    sampleSize: number;
    indexable: boolean;
};

export function DataEntityTracker(props: Props) {
    useEffect(() => {
        sendDataEntityViewEvent({
            entity_type: props.entityType,
            entity_id: props.entityId,
            sample_size: props.sampleSize,
            indexable: props.indexable,
        });
        recordDataHistory({
            entity_type: props.entityType,
            id: props.entityId,
            name: props.name,
            subtitle: props.subtitle,
            url: props.url,
        });
    }, [
        props.entityId,
        props.entityType,
        props.indexable,
        props.name,
        props.sampleSize,
        props.subtitle,
        props.url,
    ]);

    return null;
}

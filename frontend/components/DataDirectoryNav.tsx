import { DataHubNav } from '@/components/DataHubNav';
import type { DataEntityType } from '@/lib/types';


export function DataDirectoryNav({
    current,
}: {
    current?: Exclude<DataEntityType, 'grade'>;
}) {
    const currentPathMap: Record<string, string> = {
        horse: '/horses',
        jockey: '/jockeys',
        trainer: '/trainers',
        course: '/courses',
    };
    const currentPath = current ? currentPathMap[current] : undefined;

    return <DataHubNav currentPath={currentPath} />;
}



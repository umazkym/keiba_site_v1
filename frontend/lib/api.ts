import { RaceDayPrediction, SpecialPick } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function getPredictionsForDate(date: string): Promise<RaceDayPrediction> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/${date}`, { cache: 'no-store' });

        if (!res.ok) {
            if (res.status === 404) {
                console.log(`No predictions found for date ${date}, returning empty data.`);
                return { jra: [], nar: [] };
            }
            throw new Error(`Failed to fetch data from API. Status: ${res.status}`);
        }
        return res.json();
    } catch (error: any) {
        console.error("A network or fetch error occurred in getPredictionsForDate:", error.message);
        throw new Error('Failed to fetch data from API. バックエンドサーバーが起動しているか確認してください。');
    }
}

export async function getSpecialPick(date: string): Promise<SpecialPick | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/predictions/special-pick/${date}`, { cache: 'no-store' });
        if (!res.ok) {
            console.warn(`Could not fetch special pick for ${date}. Status: ${res.status}`);
            return null;
        }
        const data = await res.json();
        return data || null;
    } catch (error: any) {
        console.error("A network or fetch error occurred in getSpecialPick:", error.message);
        return null;
    }
}
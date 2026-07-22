type GoogleAnalyticsBootstrapProps = {
    gaId: string;
};

const buildBootstrapScript = (gaId: string) => `
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
    });
    ${gaId ? `
    window.gtag('js', new Date());
    window.gtag('config', ${JSON.stringify(gaId)}, { 'send_page_view': true });
    window.__umaGaReady = true;
    window.dispatchEvent(new Event('uma:ga-ready'));
    ` : ''}
`;

/**
 * Consent ModeとGA4のconfigをClient Componentより先にdataLayerへ積む。
 * カスタムイベントが流入元確定前に送られることを防ぐため、body末尾では読み込まない。
 */
export function GoogleAnalyticsBootstrap({ gaId }: GoogleAnalyticsBootstrapProps) {
    return (
        <>
            <script
                id="uma-ga-bootstrap"
                dangerouslySetInnerHTML={{ __html: buildBootstrapScript(gaId) }}
            />
            {gaId && (
                <script
                    id="uma-ga-script"
                    async
                    src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
                />
            )}
        </>
    );
}

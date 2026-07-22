export const GOOGLE_AD_OVERLAY_EVENT = 'uma:google-ad-overlay-change';

export type GoogleAdOverlaySnapshot = {
    offerwallVisible: boolean;
    dialogVisible: boolean;
    topAnchorHeight: number;
    bottomAnchorHeight: number;
};

let currentSnapshot: GoogleAdOverlaySnapshot = {
    offerwallVisible: false,
    dialogVisible: false,
    topAnchorHeight: 0,
    bottomAnchorHeight: 0,
};

export const getGoogleAdOverlaySnapshot = () => currentSnapshot;

export const publishGoogleAdOverlaySnapshot = (nextSnapshot: GoogleAdOverlaySnapshot) => {
    const changed = Object.keys(nextSnapshot).some((key) => (
        nextSnapshot[key as keyof GoogleAdOverlaySnapshot]
        !== currentSnapshot[key as keyof GoogleAdOverlaySnapshot]
    ));
    if (!changed) return;

    currentSnapshot = nextSnapshot;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent<GoogleAdOverlaySnapshot>(GOOGLE_AD_OVERLAY_EVENT, {
            detail: currentSnapshot,
        }));
    }
};

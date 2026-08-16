const PLACEMENT_CHANNELS: Record<string, string | undefined> = {
  article_after_body: process.env.NEXT_PUBLIC_AD_CHANNEL_ARTICLE_AFTER_BODY,
  article_after_intro: process.env.NEXT_PUBLIC_AD_CHANNEL_ARTICLE_AFTER_INTRO,
  article_mid_content: process.env.NEXT_PUBLIC_AD_CHANNEL_ARTICLE_MID_CONTENT,
  article_mid_long_content: process.env.NEXT_PUBLIC_AD_CHANNEL_ARTICLE_MID_LONG_CONTENT,
  entity_article_after_body: process.env.NEXT_PUBLIC_AD_CHANNEL_ENTITY_AFTER_BODY,
  race_after_analysis_engaged: process.env.NEXT_PUBLIC_AD_CHANNEL_RACE_ENGAGED,
  race_after_top_hits_infeed: process.env.NEXT_PUBLIC_AD_CHANNEL_RACE_END,
  home_after_today_races: process.env.NEXT_PUBLIC_AD_CHANNEL_HOME_RACES,
  home_after_today_pick: process.env.NEXT_PUBLIC_AD_CHANNEL_HOME_PICK,
};

export function getAdChannelForPlacement(placement: string | undefined): string | undefined {
  if (!placement) return undefined;
  const channel = String(PLACEMENT_CHANNELS[placement] || '').trim();
  return /^\d+$/.test(channel) ? channel : undefined;
}

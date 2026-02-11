
export const STRIPE_TIER_MAPPING: Record<string, 'launch' | 'growth' | 'scale'> = {
    // These should ideally be environment variables, but can be hardcoded map keys if the price IDs are stable
    // Or we export a function that takes env and returns the map
};

export const getTierFromPriceId = (priceId: string, env: any): 'launch' | 'growth' | 'scale' | null => {
    if (!priceId) return null;
    if (priceId === env.STRIPE_PRICE_GROWTH) return 'growth';
    if (priceId === env.STRIPE_PRICE_SCALE) return 'scale';
    if (priceId === env.STRIPE_PRICE_BASIC) return 'launch'; // Assuming variable exists
    return null;
};

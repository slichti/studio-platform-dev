import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { ShoppingBag, CreditCard, Sparkles } from 'lucide-react-native';

export default function ShopScreen() {
    const [packs, setPacks] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'packs' | 'memberships'>('packs');
    const router = useRouter();

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        try {
            const [packsData, plansData] = await Promise.all([
                apiRequest('/packs'),
                apiRequest('/plans')
            ]);
            setPacks(packsData.packs || []);
            setPlans(plansData || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = async (item: any, type: 'pack' | 'plan') => {
        if (processing) return;
        setProcessing(item.id);

        try {
            const body = type === 'pack' ? { packId: item.id } : { planId: item.id };

            const res = await apiRequest('/checkout/session', {
                method: 'POST',
                body: JSON.stringify({
                    ...body,
                    platform: 'mobile'
                })
            });

            if (res.error) throw new Error(res.error);

            if (res.paymentNotRequired) {
                Alert.alert('Success', 'Purchase successful!');
                // Optionally reload user profile or credits
                return;
            }

            if (res.url) {
                // Open Stripe Checkout
                const result = await WebBrowser.openBrowserAsync(res.url); // Use WebBrowser for hosted checkout

                // In a real app with deep links, we might check for success param in the callback url
                // checks are handled via deep link return to app usually
                if (result.type === 'dismiss') {
                    // Verify purchase status or just show message?
                    // Ideally we'd have a way to verify status upon return
                    Alert.alert('Info', 'If you completed the purchase, your credits will appear shortly.');
                }
            }

        } catch (e: any) {
            Alert.alert('Purchase Failed', e.message);
        } finally {
            setProcessing(null);
        }
    };

    const renderPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price / 100);
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="black" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 pt-4 pb-2 bg-white">
                <Text className="text-2xl font-bold text-zinc-900">Shop</Text>
                <Text className="text-zinc-500 mb-4">Invest in your wellness</Text>

                {/* Tabs */}
                <View className="flex-row bg-zinc-100 p-1 rounded-xl mb-2">
                    <TouchableOpacity
                        onPress={() => setActiveTab('packs')}
                        className={`flex-1 py-2 items-center rounded-lg ${activeTab === 'packs' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`font-bold ${activeTab === 'packs' ? 'text-zinc-900' : 'text-zinc-500'}`}>Class Packs</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('memberships')}
                        className={`flex-1 py-2 items-center rounded-lg ${activeTab === 'memberships' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`font-bold ${activeTab === 'memberships' ? 'text-zinc-900' : 'text-zinc-500'}`}>Memberships</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1 px-4 bg-zinc-50 pt-4">
                {activeTab === 'packs' ? (
                    <View className="gap-4 pb-20">
                        {packs.map((pack) => (
                            <View key={pack.id} className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm">
                                <View className="flex-row justify-between items-start mb-2">
                                    <View className="bg-blue-50 p-3 rounded-xl">
                                        <ShoppingBag size={24} stroke="#2563EB" />
                                    </View>
                                    {pack.expirationDays && (
                                        <View className="bg-zinc-100 px-2 py-1 rounded">
                                            <Text className="text-xs text-zinc-500 font-medium">Expires in {pack.expirationDays} days</Text>
                                        </View>
                                    )}
                                </View>

                                <Text className="text-lg font-bold text-zinc-900 mb-1">{pack.name}</Text>
                                <Text className="text-3xl font-bold text-zinc-900 mb-4">{renderPrice(pack.price)}</Text>

                                <View className="flex-row items-center gap-2 mb-6">
                                    <Sparkles size={16} stroke="#fbbf24" fill="#fbbf24" />
                                    <Text className="text-zinc-600 border-zinc-200">{pack.credits} Credits</Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => handleBuy(pack, 'pack')}
                                    disabled={!!processing}
                                    className="bg-black py-4 rounded-xl items-center flex-row justify-center"
                                >
                                    {processing === pack.id ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white font-bold">Buy Now</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))}
                        {packs.length === 0 && <Text className="text-center text-zinc-400 mt-10">No class packs available.</Text>}
                    </View>
                ) : (
                    <View className="gap-4 pb-20">
                        {plans.map((plan) => (
                            <View key={plan.id} className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm relative overflow-hidden">
                                {plan.recommended && (
                                    <View className="absolute top-0 right-0 bg-blue-600 px-3 py-1 rounded-bl-xl">
                                        <Text className="text-white text-xs font-bold">POPULAR</Text>
                                    </View>
                                )}

                                <View className="flex-row justify-between items-start mb-2">
                                    <View className="bg-purple-50 p-3 rounded-xl">
                                        <CreditCard size={24} stroke="#9333ea" />
                                    </View>
                                </View>

                                <Text className="text-lg font-bold text-zinc-900 mb-1">{plan.name}</Text>
                                <View className="flex-row items-baseline mb-4">
                                    <Text className="text-3xl font-bold text-zinc-900">{renderPrice(plan.price)}</Text>
                                    <Text className="text-zinc-500 ml-1">/{plan.interval}</Text>
                                </View>

                                <Text className="text-zinc-600 mb-6 leading-5">
                                    {plan.description || "Unlimited access to all classes and amenities."}
                                </Text>

                                <TouchableOpacity
                                    onPress={() => handleBuy(plan, 'plan')}
                                    disabled={!!processing}
                                    className="bg-zinc-900 py-4 rounded-xl items-center flex-row justify-center"
                                >
                                    {processing === plan.id ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white font-bold">Subscribe</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))}
                        {plans.length === 0 && <Text className="text-center text-zinc-400 mt-10">No memberships available.</Text>}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

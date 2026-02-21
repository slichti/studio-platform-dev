import { View, Text, SafeAreaView, TouchableOpacity, Share, ScrollView, ActivityIndicator } from 'react-native';
import { apiRequest } from '../../lib/api';
import { useEffect, useState } from 'react';
import { Copy, Share as ShareIcon, Users, DollarSign, Gift } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useTenant } from '../../context/TenantContext';

interface ReferralStats {
    code: string;
    stats: {
        clicks: number;
        signups: number;
        earnings: number;
    };
    history: {
        id: string;
        amount: number;
        status: 'pending' | 'paid';
        createdAt: string;
        referredUser?: {
            firstName: string;
        };
    }[];
}

export default function ReferralsScreen() {
    const { tenant } = useTenant();
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await apiRequest('/referrals/stats');
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const referralLink = stats ? `https://${tenant?.slug}.studio.com/join?ref=${stats.code}` : '';

    const handleCopy = async () => {
        await Clipboard.setStringAsync(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Join me at ${tenant?.name}! Use my link to get $20 off: ${referralLink}`,
                url: referralLink, // iOS only
            });
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1" contentContainerClassName="p-6 pb-24">
                <Text className="text-2xl font-bold text-zinc-900 mb-2">Refer & Earn</Text>
                <Text className="text-base text-zinc-500 mb-8">
                    Invite friends to {tenant?.name} and earn rewards.
                </Text>

                {/* Hero Card */}
                <View className="bg-blue-600 rounded-3xl p-6 mb-8 shadow-md">
                    <View className="flex-row items-center gap-3 mb-4">
                        <View className="bg-white/20 p-2 rounded-full">
                            <Gift stroke="white" size={24} />
                        </View>
                        <Text className="text-white text-xl font-bold">Give $20, Get $20</Text>
                    </View>
                    <Text className="text-blue-50 text-base mb-6 leading-6 opacity-90">
                        Your friends get $20 off their first pack, and you get $20 in credit when they sign up.
                    </Text>

                    {/* Code Display */}
                    <View className="items-center mb-6">
                        <Text className="text-blue-200 text-xs uppercase tracking-widest font-bold mb-2">Your Code</Text>
                        <Text className="text-white text-4xl font-bold tracking-wider">{stats?.code}</Text>
                    </View>

                    {/* Action Bar */}
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={handleCopy}
                            className="flex-1 bg-white/10 border border-white/20 p-4 rounded-xl flex-row justify-center items-center gap-2 active:bg-white/20"
                        >
                            <Copy stroke="white" size={18} />
                            <Text className="text-white font-semibold">
                                {copied ? 'Copied!' : 'Copy Link'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleShare}
                            className="flex-1 bg-white p-4 rounded-xl flex-row justify-center items-center gap-2 active:bg-blue-50"
                        >
                            <ShareIcon stroke="#2563EB" size={18} />
                            <Text className="text-blue-600 font-bold">Share</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats Grid */}
                <View className="flex-row gap-4 mb-8">
                    <View className="flex-1 bg-zinc-50 p-5 rounded-2xl border border-zinc-100">
                        <View className="bg-zinc-200/50 self-start p-2 rounded-lg mb-3">
                            <Users stroke="#52525b" size={18} />
                        </View>
                        <Text className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Referred</Text>
                        <Text className="text-2xl font-bold text-zinc-900 mt-1">{stats?.stats?.signups || 0}</Text>
                    </View>
                    <View className="flex-1 bg-zinc-50 p-5 rounded-2xl border border-zinc-100">
                        <View className="bg-zinc-200/50 self-start p-2 rounded-lg mb-3">
                            <DollarSign stroke="#52525b" size={18} />
                        </View>
                        <Text className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Earned</Text>
                        <Text className="text-2xl font-bold text-zinc-900 mt-1">
                            ${((stats?.stats?.earnings || 0) / 100).toFixed(0)}
                        </Text>
                    </View>
                </View>

                {/* History */}
                <Text className="text-lg font-bold text-zinc-900 mb-4 px-1">History</Text>
                {stats?.history?.length === 0 ? (
                    <View className="py-12 items-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                        <Text className="text-zinc-400">No referrals yet.</Text>
                    </View>
                ) : (
                    <View className="bg-zinc-50 rounded-2xl border border-zinc-100 overflow-hidden">
                        {stats?.history?.map((item, index) => (
                            <View key={item.id} className={`flex-row items-center justify-between p-4 ${index !== stats.history.length - 1 ? 'border-b border-zinc-100' : ''}`}>
                                <View className="flex-row items-center gap-3">
                                    <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                                        <Text className="text-blue-600 font-bold text-xs">{(item.referredUser?.firstName || 'F')[0]}</Text>
                                    </View>
                                    <View>
                                        <Text className="font-semibold text-zinc-900">{item.referredUser?.firstName || 'Friend'}</Text>
                                        <Text className="text-xs text-zinc-400">{new Date(item.createdAt).toLocaleDateString()}</Text>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <Text className="font-bold text-zinc-900">+${item.amount / 100}</Text>
                                    <View className={`px-2 py-0.5 rounded-full mt-1 ${item.status === 'paid' ? 'bg-green-100' : 'bg-amber-100'}`}>
                                        <Text className={`text-[10px] uppercase font-bold ${item.status === 'paid' ? 'text-green-700' : 'text-amber-700'}`}>
                                            {item.status}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

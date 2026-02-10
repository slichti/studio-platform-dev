import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { apiRequest } from '../../lib/api';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, Mail, Smartphone, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function NotificationSettings() {
    const { token } = useAuth();
    const router = useRouter();
    const [settings, setSettings] = useState({
        push_enabled: true,
        email_enabled: true,
        sms_enabled: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await apiRequest('/members/me');
            const userSettings = data.member?.settings?.notifications || {};
            setSettings({
                push_enabled: userSettings.push !== false,
                email_enabled: userSettings.email !== false,
                sms_enabled: userSettings.sms === true
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSetting = async (key: 'push' | 'email' | 'sms') => {
        const newValue = !settings[`${key}_enabled` as keyof typeof settings];
        const newSettings = { ...settings, [`${key}_enabled`]: newValue };
        setSettings(newSettings);

        setSaving(true);
        try {
            await apiRequest('/members/me/settings', {
                method: 'PATCH',
                body: JSON.stringify({
                    notifications: {
                        push: newSettings.push_enabled,
                        email: newSettings.email_enabled,
                        sms: newSettings.sms_enabled
                    }
                })
            });
        } catch (e) {
            console.error(e);
            // Revert on failure
            setSettings(settings);
        } finally {
            setSaving(false);
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
            <View className="flex-row items-center px-4 py-4 border-b border-zinc-100">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft size={24} color="#18181b" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-zinc-900 ml-2">Notifications</Text>
            </View>

            <ScrollView className="flex-1 p-6">
                <Text className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-6">Channels</Text>

                <View className="bg-zinc-50 rounded-2xl border border-zinc-100 overflow-hidden">
                    {/* Push */}
                    <View className="flex-row items-center justify-between p-5 border-b border-zinc-100">
                        <View className="flex-row items-center flex-1 pr-4">
                            <View className="bg-blue-100 p-2 rounded-lg mr-4">
                                <Bell size={20} color="#2563EB" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-semibold text-zinc-900 text-base">Push Notifications</Text>
                                <Text className="text-zinc-500 text-sm mt-0.5">Instant alerts for bookings and reminders</Text>
                            </View>
                        </View>
                        <Switch
                            value={settings.push_enabled}
                            onValueChange={() => toggleSetting('push')}
                            trackColor={{ false: '#e4e4e7', true: '#2563EB' }}
                        />
                    </View>

                    {/* Email */}
                    <View className="flex-row items-center justify-between p-5 border-b border-zinc-100">
                        <View className="flex-row items-center flex-1 pr-4">
                            <View className="bg-purple-100 p-2 rounded-lg mr-4">
                                <Mail size={20} color="#9333EA" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-semibold text-zinc-900 text-base">Email Notifications</Text>
                                <Text className="text-zinc-500 text-sm mt-0.5">Receipts, news, and class confirmations</Text>
                            </View>
                        </View>
                        <Switch
                            value={settings.email_enabled}
                            onValueChange={() => toggleSetting('email')}
                            trackColor={{ false: '#e4e4e7', true: '#2563EB' }}
                        />
                    </View>

                    {/* SMS */}
                    <View className="flex-row items-center justify-between p-5">
                        <View className="flex-row items-center flex-1 pr-4">
                            <View className="bg-green-100 p-2 rounded-lg mr-4">
                                <Smartphone size={20} color="#16A34A" />
                            </View>
                            <View className="flex-1">
                                <Text className="font-semibold text-zinc-900 text-base">SMS Alerts</Text>
                                <Text className="text-zinc-500 text-sm mt-0.5">Waitlist updates and urgent changes</Text>
                            </View>
                        </View>
                        <Switch
                            value={settings.sms_enabled}
                            onValueChange={() => toggleSetting('sms')}
                            trackColor={{ false: '#e4e4e7', true: '#2563EB' }}
                        />
                    </View>
                </View>

                {saving && (
                    <Text className="text-center text-zinc-400 text-xs mt-4 italic">Saving preferences...</Text>
                )}

                <View className="mt-8 bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <Text className="text-amber-800 text-sm leading-5">
                        <Text className="font-bold">Pro Tip: </Text>
                        Keep Push Notifications on to get notified immediately if you're promoted from a waitlist!
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

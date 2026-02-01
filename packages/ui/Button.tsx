/// <reference types="nativewind/types" />
import { Text, Pressable, PressableProps } from 'react-native';

interface ButtonProps extends PressableProps {
    label: string;
    variant?: 'primary' | 'secondary';
    className?: string;
}

export function Button({ label, variant = 'primary', className, ...props }: ButtonProps) {
    const bgClass = variant === 'primary' ? 'bg-blue-600' : 'bg-gray-200';
    const textClass = variant === 'primary' ? 'text-white' : 'text-gray-900';

    return (
        <Pressable className={`${bgClass} p-4 rounded-lg items-center ${className}`} {...props}>
            <Text className={`${textClass} font-bold`}>{label}</Text>
        </Pressable>
    );
}

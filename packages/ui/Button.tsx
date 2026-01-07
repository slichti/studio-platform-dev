import { Text, Pressable, PressableProps } from 'react-native';
import { styled } from 'nativewind';

const StyledPressable = styled(Pressable);
const StyledText = styled(Text);

interface ButtonProps extends PressableProps {
    label: string;
    variant?: 'primary' | 'secondary';
}

export function Button({ label, variant = 'primary', className, ...props }: ButtonProps) {
    const bgClass = variant === 'primary' ? 'bg-blue-600' : 'bg-gray-200';
    const textClass = variant === 'primary' ? 'text-white' : 'text-gray-900';

    return (
        <StyledPressable className={`${bgClass} p-4 rounded-lg items-center ${className}`} {...props}>
            <StyledText className={`${textClass} font-bold`}>{label}</StyledText>
        </StyledPressable>
    );
}

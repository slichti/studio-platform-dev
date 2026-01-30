import {
    Button,
    Heading,
    Section,
    Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/BaseLayout';

interface WelcomeEmailProps {
    name: string;
    studioName: string;
    studioUrl: string;
    logoUrl?: string;
    primaryColor?: string;
    physicalAddress?: string;
    unsubscribeUrl?: string;
}

export const WelcomeEmail = ({
    name,
    studioName,
    studioUrl,
    ...baseProps
}: WelcomeEmailProps) => {
    return (
        <BaseLayout
            previewText={`Welcome to ${studioName}, ${name}!`}
            tenantName={studioName}
            {...baseProps}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                Welcome to <strong>{studioName}</strong>!
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
                Hello {name},
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
                We are thrilled to have you join us. Explore our classes, book your spot, and start your journey today.
            </Text>
            <Section className="text-center mt-[32px] mb-[32px]">
                <Button
                    className="bg-brand rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                    href={studioUrl}
                >
                    Book a Class
                </Button>
            </Section>
            <Text className="text-black text-[14px] leading-[24px]">
                If you have any questions, simply reply to this email. We're here to help!
            </Text>
        </BaseLayout>
    );
};

WelcomeEmail.PreviewProps = {
    name: 'Alex',
    studioName: 'Zen Yoga Studio',
    studioUrl: 'https://zen-yoga.studio-platform.com',
    primaryColor: '#8b5cf6',
} as WelcomeEmailProps;

export default WelcomeEmail;

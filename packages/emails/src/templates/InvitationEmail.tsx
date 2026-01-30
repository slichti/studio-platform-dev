import {
    Heading,
    Section,
    Text,
    Button,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/BaseLayout';

interface InvitationEmailProps {
    studioName: string;
    inviteUrl: string;
    logoUrl?: string;
    primaryColor?: string;
    physicalAddress?: string;
}

export const InvitationEmail = ({
    studioName,
    inviteUrl,
    ...baseProps
}: InvitationEmailProps) => {
    return (
        <BaseLayout
            previewText={`You've been invited to ${studioName}`}
            tenantName={studioName}
            {...baseProps}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                You've been invited to <strong>{studioName}</strong>
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
                Hello,
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
                You have been added as a member of <strong>{studioName}</strong>.
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
                Click the button below to access your account and view the schedule:
            </Text>

            <Section className="text-center mt-[32px] mb-[32px]">
                <Button
                    className="bg-brand rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                    href={inviteUrl}
                >
                    Access Studio
                </Button>
            </Section>

            <Text className="text-[#666666] text-[12px] leading-[24px]">
                If the button above doesn't work, ensure you are logged in with the email address this invitation was sent to.
            </Text>
        </BaseLayout>
    );
};

InvitationEmail.PreviewProps = {
    studioName: 'Zen Yoga Studio',
    inviteUrl: 'https://zen-yoga.studio-platform.com/login',
    primaryColor: '#8b5cf6',
} as InvitationEmailProps;

export default InvitationEmail;

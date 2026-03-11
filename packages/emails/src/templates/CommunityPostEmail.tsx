import * as React from 'react';
import { BaseLayout } from '../components/BaseLayout';
import { Markdown, Section, Link, Button, Text } from '@react-email/components';

interface CommunityPostEmailProps {
    authorName: string;
    content: string; // Markdown supported
    postUrl: string;
    studioName: string;
    topicName?: string;
    logoUrl?: string;
    primaryColor?: string;
    unsubscribeUrl?: string;
    physicalAddress?: string;
    footerText?: string;
}

export const CommunityPostEmail = ({
    authorName,
    content = "",
    postUrl,
    studioName,
    topicName,
    primaryColor = '#8b5cf6',
    ...baseProps
}: CommunityPostEmailProps) => {
    const previewText = `${authorName} posted in ${topicName || studioName}`;

    return (
        <BaseLayout
            previewText={previewText}
            tenantName={studioName}
            primaryColor={primaryColor}
            {...baseProps}
        >
            <Section>
                <Text className="text-[18px] font-bold text-gray-900 mb-2">
                    New post from {authorName}
                </Text>
                {topicName && (
                    <Text className="text-[14px] text-gray-500 mb-4 uppercase tracking-wider font-semibold">
                        Topic: {topicName}
                    </Text>
                )}
                <Markdown
                    markdownCustomStyles={{
                        h1: { fontSize: '20px', fontWeight: 'bold', margin: '16px 0' },
                        h2: { fontSize: '18px', fontWeight: 'bold', margin: '14px 0' },
                        p: { fontSize: '14px', lineHeight: '22px', margin: '12px 0' },
                        li: { fontSize: '14px', lineHeight: '22px' },
                    }}
                >
                    {content}
                </Markdown>
            </Section>

            <Section className="mt-8 mb-4 text-center">
                <Button
                    className="bg-brand text-white px-6 py-3 rounded-md font-bold text-[14px]"
                    href={postUrl}
                    style={{ backgroundColor: primaryColor }}
                >
                    View Post on Community Hub
                </Button>
            </Section>

            <Section className="mt-6">
                <Text className="text-[12px] text-gray-400">
                    You're receiving this because you're a member of the {studioName} community.
                </Text>
            </Section>
        </BaseLayout>
    );
};

CommunityPostEmail.PreviewProps = {
    authorName: 'Alex Rivers',
    content: `
# Workshop next Saturday!

Hey everyone, just a reminder that our **Advanced Vinyasa Workshop** is happening next week. 

We still have 3 spots left! Here's what we'll cover:
- Arm balances
- Inversions
- Deep hip opening

Can't wait to see you there!
    `,
    postUrl: 'https://example.com/community/post-123',
    studioName: 'Flow State Yoga',
    topicName: 'Workshops & Events',
    primaryColor: '#8b5cf6',
} as CommunityPostEmailProps;

export default CommunityPostEmail;

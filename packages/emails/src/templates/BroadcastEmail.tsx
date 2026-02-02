import * as React from 'react';
import { BaseLayout } from '../components/BaseLayout';
import { Markdown } from '@react-email/components';

interface BroadcastEmailProps {
    content: string; // Markdown supported
    subject: string;
    studioName: string;
    logoUrl?: string;
    primaryColor?: string;
    unsubscribeUrl?: string;
    physicalAddress?: string;
    footerText?: string;
}

export const BroadcastEmail = ({
    content = "",
    subject,
    studioName,
    ...baseProps
}: BroadcastEmailProps) => {
    return (
        <BaseLayout
            previewText={subject}
            tenantName={studioName}
            {...baseProps}
        >
            <Markdown
                markdownCustomStyles={{
                    h1: { fontSize: '24px', fontWeight: 'bold', margin: '20px 0' },
                    h2: { fontSize: '20px', fontWeight: 'bold', margin: '16px 0' },
                    p: { fontSize: '14px', lineHeight: '24px', margin: '16px 0' },
                    li: { fontSize: '14px', lineHeight: '24px' },
                }}
            >
                {content}
            </Markdown>
        </BaseLayout>
    );
};

BroadcastEmail.PreviewProps = {
    subject: 'Monthly Newsletter',
    studioName: 'Zen Yoga Studio',
    primaryColor: '#8b5cf6',
    content: `
# Big News this Month!

Hi everyone,

We have some exciting updates to share with you all:

- **New Instructor**: Welcome Sarah to the team!
- **Extended Hours**: We're now open until 9 PM on Fridays.
- **Member Appreciation Day**: Join us next Saturday for snacks and social time.

See you on the mat!
  `,
} as BroadcastEmailProps;

export default BroadcastEmail;

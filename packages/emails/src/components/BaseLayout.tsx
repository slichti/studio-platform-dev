import {
    Body,
    Container,
    Head,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
    Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface BaseLayoutProps {
    children: React.ReactNode;
    previewText: string;
    tenantName?: string;
    logoUrl?: string;
    primaryColor?: string;
    physicalAddress?: string;
    unsubscribeUrl?: string;
    footerText?: string;
}

export const BaseLayout = ({
    children,
    previewText,
    tenantName = 'Studio Platform',
    logoUrl,
    primaryColor = '#000000',
    physicalAddress,
    unsubscribeUrl,
    footerText,
}: BaseLayoutProps) => {
    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind
                config={{
                    theme: {
                        extend: {
                            colors: {
                                brand: primaryColor,
                            },
                        },
                    },
                }}
            >
                <Body className="bg-white my-auto mx-auto font-sans">
                    <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[600px]">
                        {logoUrl && (
                            <Section className="mt-[32px]">
                                <Img
                                    src={logoUrl}
                                    width="40"
                                    height="40"
                                    alt={tenantName}
                                    className="my-0 mx-auto"
                                />
                            </Section>
                        )}
                        <Section className="mt-[32px]">{children}</Section>
                        <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
                        <Section className="footer text-[#666666] text-[12px] leading-[24px]">
                            {footerText && (
                                <Text className="text-[#666666] text-[12px] leading-[24px] mb-[10px]">
                                    {footerText}
                                </Text>
                            )}
                            <Text className="text-[#666666] text-[12px] leading-[24px]">
                                Sent by <strong>{tenantName}</strong>
                                {physicalAddress && (
                                    <>
                                        <br />
                                        {physicalAddress}
                                    </>
                                )}
                            </Text>
                            {unsubscribeUrl && (
                                <Text className="text-[#666666] text-[12px] leading-[24px] mt-[10px]">
                                    If you wish to no longer receive emails from us, you can{' '}
                                    <Link
                                        href={unsubscribeUrl}
                                        className="text-brand underline"
                                    >
                                        unsubscribe here
                                    </Link>
                                    .
                                </Text>
                            )}
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default BaseLayout;

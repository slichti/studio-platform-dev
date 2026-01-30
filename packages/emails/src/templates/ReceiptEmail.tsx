import {
    Heading,
    Section,
    Text,
    Button,
    Hr,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/BaseLayout';

interface ReceiptEmailProps {
    name: string;
    amount: string; // e.g., "$50.00"
    currency: string;
    description: string;
    date: string;
    paymentMethod?: string;
    receiptUrl?: string;
    studioName: string;
    logoUrl?: string;
    primaryColor?: string;
}

export const ReceiptEmail = ({
    name,
    amount,
    currency,
    description,
    date,
    paymentMethod,
    receiptUrl,
    studioName,
    ...baseProps
}: ReceiptEmailProps) => {
    return (
        <BaseLayout
            previewText={`Receipt for your purchase at ${studioName}`}
            tenantName={studioName}
            {...baseProps}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                Payment Receipt
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
                Hi {name}, thank you for your purchase.
            </Text>

            <Section className="bg-[#f9fafb] p-[20px] rounded-[8px] my-[24px]">
                <Text className="text-black text-[24px] font-bold m-0">
                    {amount} <span className="text-[14px] font-normal text-[#666666] uppercase">{currency}</span>
                </Text>
                <Hr className="border-[#eaeaea] my-[10px]" />
                <Text className="text-black text-[14px] font-semibold m-0">
                    {description}
                </Text>
                <Text className="text-[#666666] text-[14px] m-0">
                    {date}
                </Text>
            </Section>

            {paymentMethod && (
                <Text className="text-black text-[14px] leading-[24px]">
                    <strong>Payment Method:</strong> {paymentMethod}
                </Text>
            )}

            {receiptUrl && (
                <Section className="text-center mt-[32px] mb-[32px]">
                    <Button
                        className="bg-brand rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                        href={receiptUrl}
                    >
                        View Online Receipt
                    </Button>
                </Section>
            )}
        </BaseLayout>
    );
};

ReceiptEmail.PreviewProps = {
    name: 'Alex',
    amount: '$50.00',
    currency: 'USD',
    description: '10 Class Pack',
    date: 'February 12, 2026',
    paymentMethod: 'Visa ending in 4242',
    studioName: 'Zen Yoga Studio',
    primaryColor: '#8b5cf6',
} as ReceiptEmailProps;

export default ReceiptEmail;

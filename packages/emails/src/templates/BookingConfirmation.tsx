import {
    Heading,
    Section,
    Text,
    Link,
} from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/BaseLayout';

interface BookingConfirmationProps {
    name: string;
    title: string;
    startTime: string; // ISO string or formatted
    instructorName?: string;
    locationName?: string;
    zoomUrl?: string;
    bookedBy?: string;
    studioName: string;
    logoUrl?: string;
    primaryColor?: string;
}

export const BookingConfirmation = ({
    name,
    title,
    startTime,
    instructorName,
    locationName,
    zoomUrl,
    bookedBy,
    studioName,
    ...baseProps
}: BookingConfirmationProps) => {
    return (
        <BaseLayout
            previewText={`Booking Confirmed: ${title}`}
            tenantName={studioName}
            {...baseProps}
        >
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
                Booking Confirmed!
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
                Hello {name},
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
                Your spot is reserved for <strong>{title}</strong>.
            </Text>

            <Section className="bg-[#f9fafb] p-[20px] rounded-[8px] my-[24px]">
                <Text className="text-black text-[14px] leading-[24px] m-0">
                    <strong>Time:</strong> {startTime}
                </Text>
                {instructorName && (
                    <Text className="text-black text-[14px] leading-[24px] m-0">
                        <strong>Instructor:</strong> {instructorName}
                    </Text>
                )}
                {locationName && (
                    <Text className="text-black text-[14px] leading-[24px] m-0">
                        <strong>Location:</strong> {locationName}
                    </Text>
                )}
                {zoomUrl && (
                    <Text className="text-black text-[14px] leading-[24px] m-0">
                        <strong>Zoom Link:</strong> <Link href={zoomUrl} className="text-brand underline">{zoomUrl}</Link>
                    </Text>
                )}
            </Section>

            {bookedBy && (
                <Text className="text-[#666666] text-[12px] leading-[24px]">
                    Booked by {bookedBy}
                </Text>
            )}

            <Text className="text-black text-[14px] leading-[24px]">
                We can't wait to see you there!
            </Text>
        </BaseLayout>
    );
};

BookingConfirmation.PreviewProps = {
    name: 'Alex',
    title: 'Vinyasa Flow',
    startTime: 'Monday, Feb 12 at 10:00 AM',
    instructorName: 'Sarah Smith',
    locationName: 'Main Studio',
    studioName: 'Zen Yoga Studio',
    primaryColor: '#8b5cf6',
} as BookingConfirmationProps;

export default BookingConfirmation;

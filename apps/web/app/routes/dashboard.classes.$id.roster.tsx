// @ts-ignore
import { LoaderFunction } from "react-router";
// @ts-ignore
import { useLoaderData, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";

type Booking = {
    id: string;
    status: string;
    user: {
        id: string;
        email: string;
        profile: any;
    };
    createdAt: string;
};

export const loader: LoaderFunction = async (args) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const bookings = await apiRequest(`/classes/${args.params.id}/bookings`, token);
    return { bookings, classId: args.params.id };
};

export default function ClassRoster() {
    const { bookings, classId } = useLoaderData<{ bookings: Booking[], classId: string }>();

    return (
        <div>
            <div style={{ marginBottom: '20px' }}>
                <Link to="/dashboard/classes" style={{ color: '#71717a', textDecoration: 'none', fontSize: '0.875rem' }}>&larr; Back to Classes</Link>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginTop: '10px' }}>Class Roster</h2>
            </div>

            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e4e4e7', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f4f4f5', borderBottom: '1px solid #e4e4e7' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.875rem', color: '#52525b' }}>Student</th>
                            <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.875rem', color: '#52525b' }}>Email</th>
                            <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.875rem', color: '#52525b' }}>Status</th>
                            <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '0.875rem', color: '#52525b' }}>Booked At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.map((booking) => (
                            <tr key={booking.id} style={{ borderBottom: '1px solid #e4e4e7' }}>
                                <td style={{ padding: '12px 20px' }}>
                                    {/* Handle potential JSON profile logic here if needed */}
                                    <span style={{ fontWeight: '500' }}>{booking.user.profile?.fullName || 'Unknown'}</span>
                                </td>
                                <td style={{ padding: '12px 20px', color: '#52525b' }}>{booking.user.email}</td>
                                <td style={{ padding: '12px 20px' }}>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold',
                                        background: booking.status === 'confirmed' ? '#dcfce7' : '#f4f4f5',
                                        color: booking.status === 'confirmed' ? '#166534' : '#52525b'
                                    }}>
                                        {booking.status}
                                    </span>
                                </td>
                                <td style={{ padding: '12px 20px', color: '#71717a', fontSize: '0.875rem' }}>
                                    {new Date(booking.createdAt).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {bookings.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#71717a' }}>
                                    No bookings yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

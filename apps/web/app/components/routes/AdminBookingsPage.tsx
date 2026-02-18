
import { useLoaderData, useNavigate, useSearchParams, Link } from "react-router";
import { format } from "date-fns";
import { Button } from "../ui/button";
import { Badge } from "../ui/Badge";
import { Table, TableHeader, TableHead, TableRow, TableCell } from "../ui/Table";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Select } from "../ui/select";
import { Label } from "../ui/label";

interface Booking {
    id: string;
    status: string;
    attendanceType: string;
    createdAt: string;
    class: {
        id: string;
        title: string;
        startTime: string;
    };
    tenant: {
        id: string;
        name: string;
        slug: string;
    };
    student: {
        id: string;
        email: string;
        profile: {
            firstName?: string;
            lastName?: string;
        } | null;
    };
}

interface LoaderData {
    bookings: Booking[];
    total: number;
    page: number;
    limit: number;
    status: string;
    error: string | null;
}

export default function AdminBookingsPage() {
    const { bookings, total, page, limit, status, error } = useLoaderData<LoaderData>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(window.location.search);
        params.set('page', newPage.toString());
        navigate(`/admin/bookings?${params.toString()}`);
    };

    const handleStatusFilter = (newStatus: string) => {
        const params = new URLSearchParams(window.location.search);
        if (newStatus === "all") {
            params.delete('status');
        } else {
            params.set('status', newStatus);
        }
        params.set('page', '1'); // Reset to first page
        navigate(`/admin/bookings?${params.toString()}`);
    };

    const statusColors: Record<string, "success" | "warning" | "destructive" | "outline"> = {
        confirmed: "success",
        waitlisted: "warning",
        cancelled: "destructive",
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Global Bookings</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">Manage all student reservations across the platform.</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-base font-medium">Filter Bookings</CardTitle>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="status-filter" className="text-xs">Status</Label>
                            <Select
                                value={status || "all"}
                                onChange={(e) => handleStatusFilter(e.target.value)}
                                className="h-8 text-xs"
                            >
                                <option value="all">All Statuses</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="waitlisted">Waitlisted</option>
                                <option value="cancelled">Cancelled</option>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Class</TableHead>
                                    <TableHead>Studio</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Type</TableHead>
                                </TableRow>
                            </TableHeader>
                            <tbody>
                                {bookings.map((booking) => (
                                    <TableRow key={booking.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <TableCell className="font-medium text-xs whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span>{format(new Date(booking.class.startTime), 'MMM d, h:mm a')}</span>
                                                <span className="text-[10px] text-zinc-400">{format(new Date(booking.createdAt), 'Booked MMM d')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <span className="font-semibold">{booking.class.title}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                to={`/admin/tenants?search=${booking.tenant.slug}`}
                                                className="text-sm font-medium text-blue-600 hover:underline"
                                            >
                                                {booking.tenant.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                    {booking.student.profile?.firstName} {booking.student.profile?.lastName}
                                                </span>
                                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{booking.student.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusColors[booking.status] || "outline"} className="uppercase text-[10px]">
                                                {booking.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs text-zinc-500 capitalize">{booking.attendanceType.replace('_', ' ')}</span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {bookings.length === 0 && !error && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10 text-zinc-500">
                                            No bookings found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </tbody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-sm text-zinc-500">
                            Showing <span className="font-medium">{Math.min(total, (page - 1) * limit + 1)}</span> to <span className="font-medium">{Math.min(total, page * limit)}</span> of <span className="font-medium">{total}</span> bookings
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page * limit >= total}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

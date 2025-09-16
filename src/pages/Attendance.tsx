import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  CalendarDays,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, isToday } from 'date-fns';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  total_hours: number | null;
}

const Attendance = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [monthlyStats, setMonthlyStats] = useState({
    totalDays: 0,
    presentDays: 0,
    lateDays: 0,
    absentDays: 0,
    totalHours: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchAttendanceData();
    }
  }, [profile, selectedDate]);

  const fetchAttendanceData = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      
      // Fetch attendance records for the selected month
      const startOfSelectedMonth = startOfMonth(selectedDate);
      const endOfSelectedMonth = endOfMonth(selectedDate);
      
      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile.user_id)
        .gte('date', format(startOfSelectedMonth, 'yyyy-MM-dd'))
        .lte('date', format(endOfSelectedMonth, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;

      setAttendanceRecords(attendanceData || []);

      // Calculate monthly stats
      const records = attendanceData || [];
      const stats = {
        totalDays: records.length,
        presentDays: records.filter(r => r.status === 'present').length,
        lateDays: records.filter(r => r.status === 'late').length,
        absentDays: records.filter(r => r.status === 'absent').length,
        totalHours: records.reduce((sum, r) => sum + (r.total_hours || 0), 0),
      };
      setMonthlyStats(stats);

      // Check today's attendance
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayRecord = records.find(r => r.date === today);
      setTodayAttendance(todayRecord || null);

    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch attendance data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!profile) return;

    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      
      // Check if already checked in today
      if (todayAttendance?.check_in) {
        toast({
          title: "Already Checked In",
          description: "You have already checked in today",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('attendance')
        .upsert({
          user_id: profile.user_id,
          date: today,
          check_in: now.toISOString(),
          status: 'present'
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;

      toast({
        title: "Checked In Successfully",
        description: `Check-in time: ${format(now, 'HH:mm')}`,
      });

      fetchAttendanceData();
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: "Check-In Failed",
        description: "Failed to record check-in. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCheckOut = async () => {
    if (!profile || !todayAttendance) return;

    try {
      const now = new Date();

      if (todayAttendance.check_out) {
        toast({
          title: "Already Checked Out",
          description: "You have already checked out today",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('attendance')
        .update({
          check_out: now.toISOString(),
        })
        .eq('id', todayAttendance.id);

      if (error) throw error;

      toast({
        title: "Checked Out Successfully",
        description: `Check-out time: ${format(now, 'HH:mm')}`,
      });

      fetchAttendanceData();
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: "Check-Out Failed",
        description: "Failed to record check-out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Present</Badge>;
      case 'late':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Late</Badge>;
      case 'absent':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Absent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAttendanceForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return attendanceRecords.find(record => record.date === dateStr);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Attendance Tracking</h1>
        <div className="flex gap-2">
          <Button 
            onClick={handleCheckIn} 
            disabled={!!todayAttendance?.check_in}
            className="bg-green-600 hover:bg-green-700"
          >
            <Clock className="mr-2 h-4 w-4" />
            Check In
          </Button>
          <Button 
            onClick={handleCheckOut} 
            disabled={!todayAttendance?.check_in || !!todayAttendance?.check_out}
            variant="outline"
          >
            <Clock className="mr-2 h-4 w-4" />
            Check Out
          </Button>
        </div>
      </div>

      {/* Today's Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Today's Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {todayAttendance?.check_in ? format(new Date(todayAttendance.check_in), 'HH:mm') : '--:--'}
              </div>
              <div className="text-sm text-muted-foreground">Check In</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {todayAttendance?.check_out ? format(new Date(todayAttendance.check_out), 'HH:mm') : '--:--'}
              </div>
              <div className="text-sm text-muted-foreground">Check Out</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {todayAttendance?.total_hours ? `${todayAttendance.total_hours.toFixed(1)}h` : '--'}
              </div>
              <div className="text-sm text-muted-foreground">Total Hours</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
              modifiers={{
                present: (date) => {
                  const record = getAttendanceForDate(date);
                  return record?.status === 'present';
                },
                late: (date) => {
                  const record = getAttendanceForDate(date);
                  return record?.status === 'late';
                },
                absent: (date) => {
                  const record = getAttendanceForDate(date);
                  return record?.status === 'absent';
                },
              }}
              modifiersStyles={{
                present: { backgroundColor: 'hsl(var(--primary))', color: 'white' },
                late: { backgroundColor: 'hsl(var(--secondary))', color: 'black' },
                absent: { backgroundColor: 'hsl(var(--destructive))', color: 'white' },
              }}
            />
          </CardContent>
        </Card>

        {/* Monthly Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Total Days</span>
              <span className="font-semibold">{monthlyStats.totalDays}</span>
            </div>
            <div className="flex justify-between">
              <span>Present Days</span>
              <span className="font-semibold text-green-600">{monthlyStats.presentDays}</span>
            </div>
            <div className="flex justify-between">
              <span>Late Days</span>
              <span className="font-semibold text-yellow-600">{monthlyStats.lateDays}</span>
            </div>
            <div className="flex justify-between">
              <span>Absent Days</span>
              <span className="font-semibold text-red-600">{monthlyStats.absentDays}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Hours</span>
              <span className="font-semibold">{monthlyStats.totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span>Average Hours/Day</span>
              <span className="font-semibold">
                {monthlyStats.presentDays > 0 
                  ? (monthlyStats.totalHours / monthlyStats.presentDays).toFixed(1) 
                  : '0'}h
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader>
            <CardTitle>Calendar Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-primary rounded"></div>
              <span className="text-sm">Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-secondary rounded"></div>
              <span className="text-sm">Late</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-destructive rounded"></div>
              <span className="text-sm">Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted rounded border"></div>
              <span className="text-sm">No Record</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records - {format(selectedDate, 'MMMM yyyy')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.date), 'MMM dd, yyyy')}
                      {isToday(new Date(record.date)) && (
                        <Badge variant="outline" className="ml-2">Today</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.check_in ? format(new Date(record.check_in), 'HH:mm') : '--:--'}
                    </TableCell>
                    <TableCell>
                      {record.check_out ? format(new Date(record.check_out), 'HH:mm') : '--:--'}
                    </TableCell>
                    <TableCell>
                      {record.total_hours ? `${record.total_hours.toFixed(1)}h` : '--'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(record.status)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No attendance records found for this month
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Attendance;
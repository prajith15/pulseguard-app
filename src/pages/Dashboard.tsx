import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Calendar, 
  Users, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ClockIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isToday } from 'date-fns';

interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  total_hours: number | null;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  total_days: number;
}

interface DashboardStats {
  totalEmployees?: number;
  presentToday?: number;
  pendingLeaves?: number;
  totalHoursThisMonth?: number;
}

const Dashboard = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) return;

    try {
      // Fetch today's attendance
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: todayData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('date', today)
        .single();

      setTodayAttendance(todayData);

      // Fetch recent attendance (last 7 days)
      const { data: recentAttendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('date', { ascending: false })
        .limit(7);

      setRecentAttendance(recentAttendanceData || []);

      // Fetch recent leave requests
      const { data: leavesData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentLeaves(leavesData || []);

      // Fetch stats based on role
      if (profile.role === 'hr' || profile.role === 'admin') {
        await fetchHRAdminStats();
      } else {
        await fetchEmployeeStats();
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHRAdminStats = async () => {
    try {
      // Total employees
      const { count: totalEmployees } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .neq('role', 'admin');

      // Present today
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count: presentToday } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .not('check_in', 'is', null);

      // Pending leave requests
      const { count: pendingLeaves } = await supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        totalEmployees: totalEmployees || 0,
        presentToday: presentToday || 0,
        pendingLeaves: pendingLeaves || 0,
      });
    } catch (error) {
      console.error('Error fetching HR/Admin stats:', error);
    }
  };

  const fetchEmployeeStats = async () => {
    try {
      // Total hours this month
      const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('attendance')
        .select('total_hours')
        .eq('user_id', profile?.user_id)
        .gte('date', startOfMonth)
        .not('total_hours', 'is', null);

      const totalHours = data?.reduce((sum, record) => sum + (record.total_hours || 0), 0) || 0;

      setStats({
        totalHoursThisMonth: Math.round(totalHours * 100) / 100,
      });
    } catch (error) {
      console.error('Error fetching employee stats:', error);
    }
  };

  const handleCheckIn = async () => {
    if (!profile) return;

    try {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');

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
        title: "Checked In",
        description: `Successfully checked in at ${format(now, 'HH:mm')}`,
      });

      fetchDashboardData();
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: "Error",
        description: "Failed to check in. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCheckOut = async () => {
    if (!profile || !todayAttendance) return;

    try {
      const now = new Date();

      const { error } = await supabase
        .from('attendance')
        .update({
          check_out: now.toISOString(),
        })
        .eq('id', todayAttendance.id);

      if (error) throw error;

      toast({
        title: "Checked Out",
        description: `Successfully checked out at ${format(now, 'HH:mm')}`,
      });

      fetchDashboardData();
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: "Error",
        description: "Failed to check out. Please try again.",
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
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ClockIcon className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Welcome back, {profile?.name}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {profile?.role === 'employee' ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Status</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {todayAttendance?.check_in ? 'Checked In' : 'Not Checked In'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {todayAttendance?.check_in && `at ${format(new Date(todayAttendance.check_in), 'HH:mm')}`}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hours This Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalHoursThisMonth || 0}h</div>
                <p className="text-xs text-muted-foreground">
                  Total working hours
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEmployees || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Active employees
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.presentToday || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Employees checked in
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Leaves</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingLeaves || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting approval
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Employee Quick Actions */}
      {profile?.role === 'employee' && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            {!todayAttendance?.check_in ? (
              <Button onClick={handleCheckIn}>
                <Clock className="mr-2 h-4 w-4" />
                Check In
              </Button>
            ) : !todayAttendance?.check_out ? (
              <Button onClick={handleCheckOut} variant="outline">
                <Clock className="mr-2 h-4 w-4" />
                Check Out
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground">
                You have completed your attendance for today
              </div>
            )}
            <Button variant="outline" asChild>
              <a href="/leaves">
                <Calendar className="mr-2 h-4 w-4" />
                Apply for Leave
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAttendance.length > 0 ? (
                recentAttendance.map((record) => (
                  <div key={record.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{format(new Date(record.date), 'MMM dd, yyyy')}</p>
                      <p className="text-sm text-muted-foreground">
                        {record.check_in && format(new Date(record.check_in), 'HH:mm')}
                        {record.check_out && ` - ${format(new Date(record.check_out), 'HH:mm')}`}
                        {record.total_hours && ` (${record.total_hours}h)`}
                      </p>
                    </div>
                    {getStatusBadge(record.status)}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No attendance records yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Leave Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLeaves.length > 0 ? (
                recentLeaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)} Leave</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(leave.start_date), 'MMM dd')} - {format(new Date(leave.end_date), 'MMM dd')} ({leave.total_days} days)
                      </p>
                    </div>
                    {getStatusBadge(leave.status)}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No leave requests yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Calendar, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  approved_by: string | null;
  remarks: string | null;
  total_days: number;
  created_at: string;
  profiles?: {
    name: string;
    email: string;
  } | null;
}

interface NewLeaveRequest {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}

const LeaveRequests = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLeaveRequest, setNewLeaveRequest] = useState<NewLeaveRequest>({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    if (profile) {
      fetchLeaveRequests();
    }
  }, [profile]);

  const fetchLeaveRequests = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      if (profile.role === 'employee') {
        // Fetch only user's own leave requests
        const { data, error } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setLeaveRequests(data || []);
      } else {
        // HR and Admin can see all leave requests
        const { data, error } = await supabase
          .from('leave_requests')
          .select(`
            *,
            profiles:profiles!leave_requests_user_id_fkey (
              name,
              email
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAllLeaveRequests(data || []);

        // Also fetch user's own requests for the stats
        const { data: userRequests } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('user_id', profile.user_id)
          .order('created_at', { ascending: false });

        setLeaveRequests(userRequests || []);
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast({
        title: "Error",
        description: "Failed to fetch leave requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!newLeaveRequest.leaveType || !newLeaveRequest.startDate || 
        !newLeaveRequest.endDate || !newLeaveRequest.reason) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
        const { error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: profile.user_id,
          leave_type: newLeaveRequest.leaveType as 'casual' | 'sick' | 'earned',
          start_date: newLeaveRequest.startDate,
          end_date: newLeaveRequest.endDate,
          reason: newLeaveRequest.reason,
          status: 'pending' as const
        });

      if (error) throw error;

      toast({
        title: "Leave Request Submitted",
        description: "Your leave request has been submitted for approval",
      });

      setDialogOpen(false);
      setNewLeaveRequest({
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: '',
      });
      
      fetchLeaveRequests();
    } catch (error) {
      console.error('Error submitting leave request:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit leave request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleApproveReject = async (requestId: string, status: 'approved' | 'rejected', remarks?: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          approved_by: profile.user_id,
          remarks: remarks || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        description: `The leave request has been ${status}`,
      });

      fetchLeaveRequests();
    } catch (error) {
      console.error(`Error ${status} leave request:`, error);
      toast({
        title: "Action Failed",
        description: `Failed to ${status} leave request. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'casual': return 'bg-blue-100 text-blue-800';
      case 'sick': return 'bg-red-100 text-red-800';
      case 'earned': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const userStats = {
    total: leaveRequests.length,
    pending: leaveRequests.filter(req => req.status === 'pending').length,
    approved: leaveRequests.filter(req => req.status === 'approved').length,
    rejected: leaveRequests.filter(req => req.status === 'rejected').length,
  };

  const hrStats = profile?.role !== 'employee' ? {
    total: allLeaveRequests.length,
    pending: allLeaveRequests.filter(req => req.status === 'pending').length,
    approved: allLeaveRequests.filter(req => req.status === 'approved').length,
    rejected: allLeaveRequests.filter(req => req.status === 'rejected').length,
  } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Leave Requests</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitLeaveRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leave-type">Leave Type</Label>
                <Select 
                  value={newLeaveRequest.leaveType} 
                  onValueChange={(value) => setNewLeaveRequest({...newLeaveRequest, leaveType: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="earned">Earned Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newLeaveRequest.startDate}
                    onChange={(e) => setNewLeaveRequest({...newLeaveRequest, startDate: e.target.value})}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newLeaveRequest.endDate}
                    onChange={(e) => setNewLeaveRequest({...newLeaveRequest, endDate: e.target.value})}
                    min={newLeaveRequest.startDate || format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Please provide a reason for your leave request..."
                  value={newLeaveRequest.reason}
                  onChange={(e) => setNewLeaveRequest({...newLeaveRequest, reason: e.target.value})}
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Submit Request
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* HR/Admin Statistics */}
      {hrStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              All Employee Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{hrStats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{hrStats.pending}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{hrStats.approved}</div>
                <div className="text-sm text-muted-foreground">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{hrStats.rejected}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {profile?.role === 'employee' ? 'Your Leave Requests' : 'All Leave Requests'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {profile?.role !== 'employee' && <TableHead>Employee</TableHead>}
                <TableHead>Leave Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                {profile?.role !== 'employee' && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(profile?.role === 'employee' ? leaveRequests : allLeaveRequests).map((request) => (
                <TableRow key={request.id}>
                  {profile?.role !== 'employee' && (
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.profiles?.name || 'Unknown'}</div>
                        <div className="text-sm text-muted-foreground">{request.profiles?.email}</div>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="outline" className={getLeaveTypeColor(request.leave_type)}>
                      {request.leave_type.charAt(0).toUpperCase() + request.leave_type.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(request.start_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{format(new Date(request.end_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{request.total_days}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={request.reason}>
                      {request.reason}
                    </div>
                    {request.remarks && (
                      <div className="text-xs text-muted-foreground mt-1">
                        <strong>Remarks:</strong> {request.remarks}
                      </div>
                    )}
                  </TableCell>
                  {profile?.role !== 'employee' && request.status === 'pending' && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveReject(request.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleApproveReject(request.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {(profile?.role === 'employee' ? leaveRequests : allLeaveRequests).length === 0 && (
                <TableRow>
                  <TableCell colSpan={profile?.role === 'employee' ? 7 : 8} className="text-center text-muted-foreground">
                    No leave requests found
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

export default LeaveRequests;
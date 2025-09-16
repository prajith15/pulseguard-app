import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Clock, 
  LogOut, 
  User, 
  Settings,
  Users,
  Calendar,
  BarChart3,
  FileText,
  Shield
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, profile, signOut, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Clock className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'hr': return 'secondary';
      default: return 'outline';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const navigationItems = [
    { 
      label: 'Dashboard', 
      href: '/dashboard', 
      icon: BarChart3, 
      roles: ['employee', 'hr', 'admin'] 
    },
    { 
      label: 'Attendance', 
      href: '/attendance', 
      icon: Clock, 
      roles: ['employee', 'hr', 'admin'] 
    },
    { 
      label: 'Leave Requests', 
      href: '/leaves', 
      icon: Calendar, 
      roles: ['employee', 'hr', 'admin'] 
    },
    { 
      label: 'Reports', 
      href: '/reports', 
      icon: FileText, 
      roles: ['hr', 'admin'] 
    },
    { 
      label: 'Employees', 
      href: '/employees', 
      icon: Users, 
      roles: ['hr', 'admin'] 
    },
    { 
      label: 'Admin Panel', 
      href: '/admin', 
      icon: Shield, 
      roles: ['admin'] 
    },
  ];

  const filteredNavigation = navigationItems.filter(item => 
    profile?.role && item.roles.includes(profile.role)
  );

  const isActiveRoute = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-bold">Employee Tracker</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {profile && (
              <div className="flex items-center space-x-2">
                <Badge variant={getRoleBadgeVariant(profile.role)}>
                  {profile.role.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {profile.name}
                </span>
              </div>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {profile?.name ? getInitials(profile.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {profile?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-2">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActiveRoute(item.href)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
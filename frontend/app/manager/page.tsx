'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Activity, 
    AlertTriangle, 
    CheckCircle, 
    Clock, 
    Plus, 
    X, 
    LogOut, 
    Settings, 
    User as UserIcon,
    Menu,
    Bell,
    MessageCircle,
    Calendar,
    FileText,
    Shield,
    Users,
    ChevronLeft,
    Home,
    Send,
    Crown,
    CreditCard,
    Lock,
    Palette,
    Globe,
    Download,
    Upload,
    Database,
    Zap,
    Mail,
    Smartphone,
    Key,
    Trash2,
    UserCog,
    Settings2,
    TrendingUp,
    Search,
    Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardEvent {
    type: string;
    content: string;
    sender_id: number;
    sender_name?: string;
    timestamp: string;
}

interface MenuItem {
    id: string;
    label: string;
    icon: React.ElementType;
    active?: boolean;
}

interface AttendanceRecord {
    id: number;
    user_id: number;
    user_name: string;
    check_in_time: string | null;
    check_out_time: string | null;
    break_start: string | null;
    break_end: string | null;
    location: string | null;
    status: string;
    notes: string | null;
    work_hours: string | null;
    created_at: string;
}

interface AttendanceAnalytics {
    total_records: number;
    date_range: { from: string; to: string };
    status_breakdown: Record<string, number>;
    daily_trend: { date: string; count: number }[];
    employee_stats: {
        user_id: number;
        name: string;
        email: string;
        total_days: number;
        present_days: number;
        break_days: number;
        attendance_rate: number;
    }[];
    summary: {
        total_employees: number;
        average_attendance_rate: number;
        most_active_day: string | null;
        total_check_ins: number;
        total_breaks: number;
    };
}

interface IncidentRecord {
    id: number;
    description: string;
    severity: string;
    status: string;
    resolution: string | null;
    reported_by: number;
    reported_by_name: string;
    reported_by_email: string;
    image_url: string | null;
    created_at: string;
    updated_at: string | null;
}

interface IncidentStats {
    total_incidents: number;
    open_incidents: number;
    resolved_incidents: number;
    critical_incidents: number;
    high_incidents: number;
    medium_incidents: number;
    low_incidents: number;
    incidents_by_status: Record<string, number>;
    incidents_by_severity: Record<string, number>;
    recent_incidents: IncidentRecord[];
    monthly_trend: { month: string; count: number }[];
}

interface IncidentCreate {
    description: string;
    severity: string;
    image_url?: string;
}

interface IncidentUpdate {
    description?: string;
    severity?: string;
    status?: string;
    resolution?: string;
    image_url?: string;
}

interface PermissionRequest {
    id: number;
    request_type: string;
    title: string;
    description: string;
    requested_date: string | null;
    requested_hours: string | null;
    priority: string;
    is_urgent: boolean;
    user_id: number;
    requester_name: string;
    requester_email: string;
    manager_id: number | null;
    manager_name: string | null;
    status: string;
    manager_response: string | null;
    approved_by: number | null;
    approver_name: string | null;
    approved_at: string | null;
    created_at: string;
    updated_at: string | null;
}

interface PermissionStats {
    total_requests: number;
    pending_requests: number;
    approved_requests: number;
    rejected_requests: number;
    urgent_requests: number;
    requests_by_status: Record<string, number>;
    requests_by_type: Record<string, number>;
    requests_by_priority: Record<string, number>;
    recent_requests: PermissionRequest[];
    monthly_trend: { month: string; count: number }[];
}

interface PermissionCreate {
    request_type: string;
    title: string;
    description: string;
    requested_date?: string;
    requested_hours?: string;
    priority: string;
    is_urgent: boolean;
}

interface PermissionUpdate {
    status?: string;
    manager_response?: string;
    priority?: string;
}

import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/app/context/AuthContext';

export default function ManagerDashboard() {
    const { user, token, logout } = useAuth();
    const router = useRouter();
    const [events, setEvents] = useState<DashboardEvent[]>([]);
    const [stats, setStats] = useState({
        activeWorkers: 12,
        pendingTasks: 5,
        incidents: 2,
        completedTasks: 45
    });

    // Sidebar and navigation state
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [activeMenuItem, setActiveMenuItem] = useState('dashboard');
    const [unreadMessages, setUnreadMessages] = useState(3);
    const [showNotifications, setShowNotifications] = useState(false);

    // Menu items for sidebar
    const menuItems: MenuItem[] = [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'messages', label: 'Messages', icon: MessageCircle },
        { id: 'attendance', label: 'Attendance', icon: Calendar },
        { id: 'incidents', label: 'Incidents & Reports', icon: FileText },
        { id: 'permissions', label: 'Permissions', icon: Shield },
        { id: 'work-assignment', label: 'Work Assignment', icon: Users },
        { id: 'team', label: 'Team Management', icon: UserCog }
    ];

    // Add Employee State
    const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
    const [newEmployeeName, setNewEmployeeName] = useState("");
    const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
    const [newEmployeePassword, setNewEmployeePassword] = useState("");
    const [addEmployeeError, setAddEmployeeError] = useState("");
    const [addEmployeeSuccess, setAddEmployeeSuccess] = useState("");

    // Team Management State
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [isLoadingTeam, setIsLoadingTeam] = useState(false);
    const [editingMember, setEditingMember] = useState<any>(null);
    const [deletingMember, setDeletingMember] = useState<any>(null);

    // Messages State
    const [selectedWorker, setSelectedWorker] = useState<any>(null);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [messageInput, setMessageInput] = useState("");
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    // Settings State
    const [activeSettingsTab, setActiveSettingsTab] = useState('account');
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [teamName, setTeamName] = useState("");
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsError, setSettingsError] = useState("");
    const [settingsSuccess, setSettingsSuccess] = useState("");

    // Attendance State
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
    const [attendanceAnalytics, setAttendanceAnalytics] = useState<AttendanceAnalytics | null>(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
    const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('');
    const [attendanceDateFrom, setAttendanceDateFrom] = useState('');
    const [attendanceDateTo, setAttendanceDateTo] = useState('');
    const [attendanceViewMode, setAttendanceViewMode] = useState<'table' | 'analytics'>('table');

    // Incidents State
    const [incidentsData, setIncidentsData] = useState<IncidentRecord[]>([]);
    const [incidentsStats, setIncidentsStats] = useState<IncidentStats | null>(null);
    const [incidentsLoading, setIncidentsLoading] = useState(false);
    const [incidentsSearchTerm, setIncidentsSearchTerm] = useState('');
    const [incidentsStatusFilter, setIncidentsStatusFilter] = useState('');
    const [incidentsSeverityFilter, setIncidentsSeverityFilter] = useState('');
    const [incidentsDateFrom, setIncidentsDateFrom] = useState('');
    const [incidentsDateTo, setIncidentsDateTo] = useState('');
    const [incidentsViewMode, setIncidentsViewMode] = useState<'table' | 'stats' | 'create'>('table');
    const [editingIncident, setEditingIncident] = useState<IncidentRecord | null>(null);
    const [newIncident, setNewIncident] = useState<IncidentCreate>({
        description: '',
        severity: 'low'
    });

    // Permissions State
    const [permissionsData, setPermissionsData] = useState<PermissionRequest[]>([]);
    const [permissionsStats, setPermissionsStats] = useState<PermissionStats | null>(null);
    const [permissionsLoading, setPermissionsLoading] = useState(false);
    const [permissionsSearchTerm, setPermissionsSearchTerm] = useState('');
    const [permissionsStatusFilter, setPermissionsStatusFilter] = useState('');
    const [permissionsTypeFilter, setPermissionsTypeFilter] = useState('');
    const [permissionsPriorityFilter, setPermissionsPriorityFilter] = useState('');
    const [permissionsDateFrom, setPermissionsDateFrom] = useState('');
    const [permissionsDateTo, setPermissionsDateTo] = useState('');
    const [permissionsViewMode, setPermissionsViewMode] = useState<'table' | 'stats'>('table');
    const [reviewingPermission, setReviewingPermission] = useState<PermissionRequest | null>(null);
    const [reviewResponse, setReviewResponse] = useState('');

    // Handler functions
    const handleLogout = () => {
        logout();
    };

    const wsUrl = user ? `ws://localhost:8000/ws/manager/${user.user_id}` : '';
    const { messages, isConnected } = useWebSocket(wsUrl);

    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            
            // Handle worker messages (direct chat messages)
            if (lastMsg.type === 'worker_message') {
                // Add message to chat if it's from the currently selected worker
                if (selectedWorker && lastMsg.sender_id === selectedWorker.id) {
                    const newMessage = {
                        id: Date.now(), // temporary ID
                        content: lastMsg.content,
                        sender: "Worker",
                        created_at: lastMsg.timestamp || new Date().toISOString()
                    };
                    setChatMessages(prev => [...prev, newMessage]);
                }
                
                // Also add to notifications/events
                const newEvent: DashboardEvent = {
                    type: 'worker_message',
                    content: lastMsg.content,
                    sender_id: lastMsg.sender_id,
                    sender_name: lastMsg.sender_name,
                    timestamp: new Date().toLocaleTimeString()
                };
                setEvents(prev => [newEvent, ...prev].slice(0, 50));
                setUnreadMessages(prev => prev + 1);
            }
            // Handle AI responses to workers (so manager can see full conversation)
            else if (lastMsg.type === 'ai_response') {
                // Add AI response to chat if it's for the currently selected worker
                if (selectedWorker && lastMsg.worker_id === selectedWorker.id) {
                    const newMessage = {
                        id: Date.now(),
                        content: lastMsg.content,
                        sender: "AI",
                        created_at: new Date().toISOString()
                    };
                    setChatMessages(prev => [...prev, newMessage]);
                }
            }
            // Handle manager message confirmations
            else if (lastMsg.type === 'manager_message_sent') {
                // Update the optimistic message with real data if needed
                // This ensures message persistence and proper ID
                if (selectedWorker && lastMsg.recipient_id === selectedWorker.id) {
                    setChatMessages(prev => 
                        prev.map(msg => 
                            // Replace the optimistic message (high timestamp) with real one
                            (msg.sender === "Manager" && msg.content === lastMsg.content) 
                                ? {
                                    id: Date.now(), 
                                    content: lastMsg.content,
                                    sender: "Manager",
                                    created_at: lastMsg.timestamp
                                }
                                : msg
                        )
                    );
                }
            }
            // Handle legacy agent responses for notifications only
            else if (lastMsg.type === 'new_message' || lastMsg.type === 'agent_response') {
                const newEvent: DashboardEvent = {
                    type: lastMsg.type,
                    content: lastMsg.content,
                    sender_id: lastMsg.sender_id,
                    timestamp: new Date().toLocaleTimeString()
                };
                setEvents(prev => [newEvent, ...prev].slice(0, 50));

                // Only increment unread messages count for worker messages, not agent responses
                if (lastMsg.type === 'new_message') {
                    setUnreadMessages(prev => prev + 1);
                }

                if (lastMsg.content.toLowerCase().includes('incident')) {
                    setStats(prev => ({ ...prev, incidents: prev.incidents + 1 }));
                }
            }
        }
    }, [messages, selectedWorker]);

    const handleMenuItemClick = (menuId: string) => {
        setActiveMenuItem(menuId);
        if (menuId === 'messages') {
            setUnreadMessages(0); // Mark messages as read
        }
    };

    const toggleNotifications = () => {
        setShowNotifications(!showNotifications);
        if (!showNotifications) {
            setUnreadMessages(0); // Mark as read when opening notifications
        }
    };

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddEmployeeError("");
        setAddEmployeeSuccess("");

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register/employee`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    full_name: newEmployeeName,
                    email: newEmployeeEmail,
                    password: newEmployeePassword
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to create employee");
            }

            setAddEmployeeSuccess("Employee created successfully!");
            setNewEmployeeName("");
            setNewEmployeeEmail("");
            setNewEmployeePassword("");
            
            // Refresh team members list if on team page
            if (activeMenuItem === 'team') {
                fetchTeamMembers();
            }
            
            setTimeout(() => {
                setIsAddEmployeeOpen(false);
                setAddEmployeeSuccess("");
            }, 2000);
        } catch (err: any) {
            setAddEmployeeError(err.message);
        }
    };

    // Team Management Functions
    const fetchTeamMembers = async () => {
        if (!token) return;
        setIsLoadingTeam(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/team-members`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTeamMembers(data);
            }
        } catch (error) {
            console.error('Error fetching team members:', error);
        } finally {
            setIsLoadingTeam(false);
        }
    };

    const handleEditMember = async (memberId: number, updatedData: any) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/update-member/${memberId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(updatedData)
            });
            if (res.ok) {
                fetchTeamMembers();
                setEditingMember(null);
            }
        } catch (error) {
            console.error('Error updating member:', error);
        }
    };

    const handleDeleteMember = async (memberId: number) => {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/delete-member/${memberId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                fetchTeamMembers();
                setDeletingMember(null);
            }
        } catch (error) {
            console.error('Error deleting member:', error);
        }
    };

    // Load team members when team page is accessed
    useEffect(() => {
        if (activeMenuItem === 'team') {
            fetchTeamMembers();
        }
        if (activeMenuItem === 'messages') {
            fetchTeamMembers(); // Also fetch for messages page
        }
    }, [activeMenuItem, token]);

    // Messages Functions
    const fetchChatMessages = async (workerId: number) => {
        if (!token) return;
        setIsLoadingMessages(true);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/messages/${workerId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setChatMessages(data);
            } else {
                console.error('Error fetching messages:', await res.json());
            }
        } catch (error) {
            console.error('Error fetching chat messages:', error);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    const sendMessageToWorker = async (workerId: number, message: string) => {
        if (!token || !message.trim()) {
            console.log('No token or empty message');
            return;
        }
        
        console.log('Sending message:', { workerId, message });
        
        // Optimistically add message to chat
        const optimisticMessage = {
            id: Date.now(), // temporary ID
            content: message,
            sender: "Manager",
            created_at: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, optimisticMessage]);
        setMessageInput("");
        
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/send-message`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    recipient_id: workerId,
                    content: message
                })
            });
            
            console.log('Response status:', res.status);
            
            if (res.ok) {
                const responseData = await res.json();
                console.log('Message sent successfully:', responseData);
                // Message already added optimistically, no need to reload
            } else {
                const errorData = await res.json();
                console.error('Error response:', errorData);
                // Remove optimistic message on error
                setChatMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
            }
        } catch (error) {
            console.error('Error sending message:', error);
            // Remove optimistic message on error
            setChatMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        }
    };

    const handleSelectWorker = (worker: any) => {
        setSelectedWorker(worker);
        fetchChatMessages(worker.id);
    };

    // Attendance Functions
    const fetchAttendanceData = async () => {
        if (!token) return;
        
        setAttendanceLoading(true);
        try {
            const params = new URLSearchParams();
            if (attendanceStatusFilter) params.append('status', attendanceStatusFilter);
            if (attendanceDateFrom) params.append('date_from', attendanceDateFrom);
            if (attendanceDateTo) params.append('date_to', attendanceDateTo);
            if (attendanceSearchTerm) params.append('search', attendanceSearchTerm);
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setAttendanceData(data);
            } else {
                console.error('Error fetching attendance data:', await res.json());
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setAttendanceLoading(false);
        }
    };

    const fetchAttendanceAnalytics = async () => {
        if (!token) return;
        
        try {
            const params = new URLSearchParams();
            if (attendanceDateFrom) params.append('date_from', attendanceDateFrom);
            if (attendanceDateTo) params.append('date_to', attendanceDateTo);
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/analytics?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setAttendanceAnalytics(data);
            } else {
                console.error('Error fetching analytics:', await res.json());
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    // Load attendance data when activeMenuItem changes to attendance
    useEffect(() => {
        if (activeMenuItem === 'attendance' && token) {
            fetchAttendanceData();
            fetchAttendanceAnalytics();
        }
    }, [activeMenuItem, token, attendanceStatusFilter, attendanceDateFrom, attendanceDateTo, attendanceSearchTerm]);

    // Helper functions for attendance
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const formatTime = (timeString: string | null) => {
        if (!timeString) return '-';
        return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status: string) => {
        const statusColors: Record<string, string> = {
            'checked_in': 'bg-green-100 text-green-800',
            'checked_out': 'bg-gray-100 text-gray-800',
            'on_break': 'bg-yellow-100 text-yellow-800',
            'sick_leave': 'bg-red-100 text-red-800',
            'absent': 'bg-red-100 text-red-800'
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || 'bg-blue-100 text-blue-800'}`}>
                {status.replace('_', ' ').toUpperCase()}
            </span>
        );
    };

    const exportToCSV = () => {
        const headers = ['Date', 'Employee', 'Check In', 'Check Out', 'Break Start', 'Break End', 'Status', 'Location', 'Work Hours'];
        const csvData = attendanceData.map(record => [
            formatDate(record.created_at),
            record.user_name,
            formatTime(record.check_in_time),
            formatTime(record.check_out_time),
            formatTime(record.break_start),
            formatTime(record.break_end),
            record.status,
            record.location || '-',
            record.work_hours || '-'
        ]);
        
        const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'attendance-report.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    // Filter attendance data
    const filteredAttendanceData = attendanceData.filter(record => {
        const matchesSearch = attendanceSearchTerm === '' || 
            record.user_name.toLowerCase().includes(attendanceSearchTerm.toLowerCase());
        const matchesStatus = attendanceStatusFilter === '' || record.status === attendanceStatusFilter;
        return matchesSearch && matchesStatus;
    });

    // Incidents Functions
    const fetchIncidentsData = async () => {
        if (!token) return;
        
        setIncidentsLoading(true);
        try {
            const params = new URLSearchParams();
            if (incidentsStatusFilter) params.append('status', incidentsStatusFilter);
            if (incidentsSeverityFilter) params.append('severity', incidentsSeverityFilter);
            if (incidentsDateFrom) params.append('date_from', incidentsDateFrom);
            if (incidentsDateTo) params.append('date_to', incidentsDateTo);
            if (incidentsSearchTerm) params.append('search', incidentsSearchTerm);
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/incidents?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setIncidentsData(data);
            } else {
                console.error('Error fetching incidents data:', await res.json());
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIncidentsLoading(false);
        }
    };

    const fetchIncidentsStats = async () => {
        if (!token) return;
        
        try {
            const params = new URLSearchParams();
            if (incidentsDateFrom) params.append('date_from', incidentsDateFrom);
            if (incidentsDateTo) params.append('date_to', incidentsDateTo);
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/incidents/stats?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setIncidentsStats(data);
            } else {
                console.error('Error fetching incidents stats:', await res.json());
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const createIncident = async () => {
        if (!token || !newIncident.description) return;
        
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/incidents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newIncident)
            });
            
            if (res.ok) {
                setNewIncident({ description: '', severity: 'low' });
                setIncidentsViewMode('table');
                fetchIncidentsData();
                fetchIncidentsStats();
            } else {
                console.error('Error creating incident:', await res.json());
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const updateIncident = async (incidentId: number, updateData: IncidentUpdate) => {
        if (!token) return;
        
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });
            
            if (res.ok) {
                setEditingIncident(null);
                fetchIncidentsData();
                fetchIncidentsStats();
            } else {
                console.error('Error updating incident:', await res.json());
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    // Load incidents data when activeMenuItem changes to incidents
    useEffect(() => {
        if (activeMenuItem === 'incidents' && token) {
            fetchIncidentsData();
            fetchIncidentsStats();
        }
    }, [activeMenuItem, token, incidentsStatusFilter, incidentsSeverityFilter, incidentsDateFrom, incidentsDateTo, incidentsSearchTerm]);

    // Helper functions for incidents
    const getSeverityBadge = (severity: string) => {
        const severityColors: Record<string, string> = {
            'low': 'bg-blue-100 text-blue-800',
            'medium': 'bg-yellow-100 text-yellow-800',
            'high': 'bg-orange-100 text-orange-800',
            'critical': 'bg-red-100 text-red-800'
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${severityColors[severity] || 'bg-gray-100 text-gray-800'}`}>
                {severity.toUpperCase()}
            </span>
        );
    };

    const getIncidentStatusBadge = (status: string) => {
        const statusColors: Record<string, string> = {
            'open': 'bg-red-100 text-red-800',
            'in_progress': 'bg-yellow-100 text-yellow-800',
            'resolved': 'bg-green-100 text-green-800',
            'closed': 'bg-gray-100 text-gray-800'
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || 'bg-blue-100 text-blue-800'}`}>
                {status.replace('_', ' ').toUpperCase()}
            </span>
        );
    };

    // Filter incidents data
    const filteredIncidentsData = incidentsData.filter(incident => {
        const matchesSearch = incidentsSearchTerm === '' || 
            incident.description.toLowerCase().includes(incidentsSearchTerm.toLowerCase()) ||
            incident.reported_by_name.toLowerCase().includes(incidentsSearchTerm.toLowerCase());
        const matchesStatus = incidentsStatusFilter === '' || incident.status === incidentsStatusFilter;
        const matchesSeverity = incidentsSeverityFilter === '' || incident.severity === incidentsSeverityFilter;
        return matchesSearch && matchesStatus && matchesSeverity;
    });

    // Permissions Functions
    const fetchPermissionsData = async () => {
        if (!token) return;
        
        setPermissionsLoading(true);
        try {
            const params = new URLSearchParams();
            if (permissionsStatusFilter) params.append('status', permissionsStatusFilter);
            if (permissionsTypeFilter) params.append('request_type', permissionsTypeFilter);
            if (permissionsPriorityFilter) params.append('priority', permissionsPriorityFilter);
            if (permissionsDateFrom) params.append('date_from', permissionsDateFrom);
            if (permissionsDateTo) params.append('date_to', permissionsDateTo);
            if (permissionsSearchTerm) params.append('search', permissionsSearchTerm);
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/permissions?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setPermissionsData(data);
            } else {
                console.error('Error fetching permissions data:', await res.json());
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setPermissionsLoading(false);
        }
    };

    const fetchPermissionsStats = async () => {
        if (!token) return;
        
        try {
            const params = new URLSearchParams();
            if (permissionsDateFrom) params.append('date_from', permissionsDateFrom);
            if (permissionsDateTo) params.append('date_to', permissionsDateTo);
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/permissions/stats?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                setPermissionsStats(data);
            } else {
                console.error('Error fetching permissions stats:', await res.json());
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const updatePermissionRequest = async (requestId: number, updateData: PermissionUpdate) => {
        if (!token) return;
        
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/permissions/${requestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });
            
            if (res.ok) {
                setReviewingPermission(null);
                setReviewResponse('');
                fetchPermissionsData();
                fetchPermissionsStats();
            } else {
                console.error('Error updating permission request:', await res.json());
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    // Load permissions data when activeMenuItem changes to permissions
    useEffect(() => {
        if (activeMenuItem === 'permissions' && token) {
            fetchPermissionsData();
            fetchPermissionsStats();
        }
    }, [activeMenuItem, token, permissionsStatusFilter, permissionsTypeFilter, permissionsPriorityFilter, permissionsDateFrom, permissionsDateTo, permissionsSearchTerm]);

    // Helper functions for permissions
    const getRequestTypeBadge = (type: string) => {
        const typeColors: Record<string, string> = {
            'overtime': 'bg-blue-100 text-blue-800',
            'vacation': 'bg-green-100 text-green-800',
            'sick_leave': 'bg-yellow-100 text-yellow-800',
            'special_access': 'bg-purple-100 text-purple-800',
            'early_leave': 'bg-orange-100 text-orange-800'
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${typeColors[type] || 'bg-gray-100 text-gray-800'}`}>
                {type.replace('_', ' ').toUpperCase()}
            </span>
        );
    };

    const getPriorityBadge = (priority: string) => {
        const priorityColors: Record<string, string> = {
            'urgent': 'bg-red-100 text-red-800',
            'high': 'bg-orange-100 text-orange-800',
            'normal': 'bg-blue-100 text-blue-800',
            'low': 'bg-gray-100 text-gray-800'
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${priorityColors[priority] || 'bg-blue-100 text-blue-800'}`}>
                {priority.toUpperCase()}
            </span>
        );
    };

    const getPermissionStatusBadge = (status: string) => {
        const statusColors: Record<string, string> = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'approved': 'bg-green-100 text-green-800',
            'rejected': 'bg-red-100 text-red-800',
            'under_review': 'bg-blue-100 text-blue-800'
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
                {status.replace('_', ' ').toUpperCase()}
            </span>
        );
    };

    // Filter permissions data
    const filteredPermissionsData = permissionsData.filter(request => {
        const matchesSearch = permissionsSearchTerm === '' || 
            request.title.toLowerCase().includes(permissionsSearchTerm.toLowerCase()) ||
            request.description.toLowerCase().includes(permissionsSearchTerm.toLowerCase()) ||
            request.requester_name.toLowerCase().includes(permissionsSearchTerm.toLowerCase());
        const matchesStatus = permissionsStatusFilter === '' || request.status === permissionsStatusFilter;
        const matchesType = permissionsTypeFilter === '' || request.request_type === permissionsTypeFilter;
        const matchesPriority = permissionsPriorityFilter === '' || request.priority === permissionsPriorityFilter;
        return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });

    return (
        <ProtectedRoute allowedRoles={['Manager']}>
            <div className="flex h-screen bg-gray-50">
                {/* Sidebar */}
                <div className={cn(
                    "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col",
                    sidebarCollapsed ? "w-16" : "w-64"
                )}>
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        {!sidebarCollapsed && (
                            <h2 className="text-xl font-bold text-gray-800">WorkHub</h2>
                        )}
                        <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="h-8 w-8"
                        >
                            {sidebarCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </Button>
                    </div>

                    {/* Navigation Menu */}
                    <nav className="flex-1 p-4 space-y-2">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeMenuItem === item.id;
                            return (
                                <Button
                                    key={item.id}
                                    variant={isActive ? "default" : "ghost"}
                                    className={cn(
                                        "w-full justify-start text-left",
                                        sidebarCollapsed ? "px-2" : "px-3"
                                    )}
                                    onClick={() => handleMenuItemClick(item.id)}
                                >
                                    <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                                    {!sidebarCollapsed && (
                                        <span className="truncate">{item.label}</span>
                                    )}
                                    {!sidebarCollapsed && item.id === 'messages' && unreadMessages > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                            {unreadMessages}
                                        </span>
                                    )}
                                </Button>
                            );
                        })}
                    </nav>

                    {/* Sidebar Footer */}
                    <div className="p-4 border-t border-gray-200 space-y-2">
                        <Button 
                            variant="ghost" 
                            className={cn(
                                "w-full justify-start",
                                sidebarCollapsed ? "px-2" : "px-3"
                            )}
                            onClick={() => setIsAddEmployeeOpen(true)}
                        >
                            <Plus className="h-5 w-5 mr-3 flex-shrink-0" />
                            {!sidebarCollapsed && <span>Add Employee</span>}
                        </Button>
                        <Button 
                            variant="ghost" 
                            className={cn(
                                "w-full justify-start",
                                sidebarCollapsed ? "px-2" : "px-3",
                                activeMenuItem === 'settings' ? "bg-blue-50 text-blue-600" : "hover:bg-gray-100"
                            )}
                            onClick={() => setActiveMenuItem('settings')}
                        >
                            <Settings className="h-5 w-5 mr-3 flex-shrink-0" />
                            {!sidebarCollapsed && <span>Settings</span>}
                        </Button>
                        <Button 
                            variant="ghost" 
                            className={cn(
                                "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50",
                                sidebarCollapsed ? "px-2" : "px-3"
                            )}
                            onClick={handleLogout}
                        >
                            <LogOut className="h-5 w-5 mr-3 flex-shrink-0" />
                            {!sidebarCollapsed && <span>Logout</span>}
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <header className="bg-white border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {menuItems.find(item => item.id === activeMenuItem)?.label || 'Dashboard'}
                                </h1>
                                <p className="text-gray-600 text-sm">
                                    {user?.email} • Team Manager
                                </p>
                            </div>
                            
                            <div className="flex items-center space-x-4">
                                {/* Connection Status */}
                                <div className={cn(
                                    "px-3 py-1 rounded-full text-sm font-medium",
                                    isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                )}>
                                    {isConnected ? 'Live Connected' : 'Disconnected'}
                                </div>

                                {/* Notifications */}
                                <div className="relative">
                                    <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={toggleNotifications}
                                        className="relative"
                                    >
                                        <Bell className="h-5 w-5" />
                                        {unreadMessages > 0 && (
                                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                                {unreadMessages > 9 ? '9+' : unreadMessages}
                                            </span>
                                        )}
                                    </Button>

                                    {/* Notifications Dropdown */}
                                    {showNotifications && (
                                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                                            <div className="p-4 border-b border-gray-200">
                                                <h3 className="font-semibold text-gray-900">Notifications</h3>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {events.filter(event => event.type === 'new_message').slice(0, 5).map((event, idx) => (
                                                    <div key={idx} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                                                        <div className="text-sm text-gray-900">{event.content}</div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            Worker #{event.sender_id} • {event.timestamp}
                                                        </div>
                                                    </div>
                                                ))}
                                                {events.filter(event => event.type === 'new_message').length === 0 && (
                                                    <div className="p-4 text-center text-gray-500 text-sm">
                                                        No new notifications
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* User Profile */}
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                        <UserIcon className="h-4 w-4 text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Page Content */}
                    <main className="flex-1 p-6 overflow-y-auto">
                        {activeMenuItem === 'dashboard' && (
                            <div className="space-y-6">
                                {/* Stats Grid */}
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
                                            <Activity className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{stats.activeWorkers}</div>
                                            <p className="text-xs text-muted-foreground">+2 since last hour</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{stats.pendingTasks}</div>
                                            <p className="text-xs text-muted-foreground">-1 from yesterday</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Incidents</CardTitle>
                                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{stats.incidents}</div>
                                            <p className="text-xs text-muted-foreground">Requires attention</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
                                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{stats.completedTasks}</div>
                                            <p className="text-xs text-muted-foreground">+12 since yesterday</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Recent Activity */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Recent Activity</CardTitle>
                                        <CardDescription>Live updates from field workers</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {events.length === 0 ? (
                                                <p className="text-gray-500 text-center py-8">No recent activity</p>
                                            ) : (
                                                events.slice(0, 10).map((event, idx) => (
                                                    <div key={idx} className={`flex items-start space-x-3 p-3 rounded-lg ${
                                                        event.type === 'new_message' 
                                                            ? 'bg-blue-50 border-l-4 border-blue-400' 
                                                            : 'bg-gray-50 border-l-4 border-gray-300'
                                                    }`}>
                                                        <div className={`w-2 h-2 rounded-full mt-2 ${
                                                            event.type === 'new_message' 
                                                                ? 'bg-blue-600' 
                                                                : 'bg-gray-400'
                                                        }`}></div>
                                                        <div className="flex-1">
                                                            <p className="text-sm text-gray-900">{event.content}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {event.type === 'new_message' 
                                                                    ? `Worker #${event.sender_id}` 
                                                                    : 'AI Assistant'
                                                                } • {event.timestamp}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeMenuItem === 'messages' && (
                            <div className="h-full">
                                <div className="flex h-[calc(100vh-8rem)] border rounded-lg bg-white shadow-sm">
                                    {/* Workers List - Left Sidebar */}
                                    <div className="w-1/3 border-r flex flex-col">
                                        <div className="p-4 border-b">
                                            <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
                                            <p className="text-sm text-gray-500">Select a member to start messaging</p>
                                        </div>
                                        <div className="flex-1 overflow-y-auto">
                                            {isLoadingTeam ? (
                                                <div className="p-4 text-center">
                                                    <div className="text-gray-500">Loading...</div>
                                                </div>
                                            ) : teamMembers.filter(member => member.role !== 'Manager').length === 0 ? (
                                                <div className="p-4 text-center">
                                                    <UserIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                                    <p className="text-gray-500 text-sm">No team members yet</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-1 p-2">
                                                    {teamMembers.filter(member => member.role !== 'Manager').map((worker) => (
                                                        <div
                                                            key={worker.id}
                                                            onClick={() => handleSelectWorker(worker)}
                                                            className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                                                selectedWorker?.id === worker.id 
                                                                    ? 'bg-blue-50 border border-blue-200' 
                                                                    : 'hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                                                                <UserIcon className="h-5 w-5 text-white" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                                    {worker.full_name || 'No Name'}
                                                                </p>
                                                                <p className="text-xs text-gray-500 truncate">{worker.email}</p>
                                                                <div className="flex items-center mt-1">
                                                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                                                                    <span className="text-xs text-gray-400">Online</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Chat Area - Right Side */}
                                    <div className="flex-1 flex flex-col">
                                        {selectedWorker ? (
                                            <>
                                                {/* Chat Header */}
                                                <div className="p-4 border-b bg-gray-50">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                                                            <UserIcon className="h-4 w-4 text-white" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium text-gray-900">
                                                                {selectedWorker.full_name || 'No Name'}
                                                            </h3>
                                                            <p className="text-xs text-gray-500">{selectedWorker.email}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Messages Area */}
                                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-25">
                                                    {isLoadingMessages ? (
                                                        <div className="text-center text-gray-500">Loading messages...</div>
                                                    ) : chatMessages.length === 0 ? (
                                                        <div className="text-center text-gray-500">
                                                            <MessageCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                                            <p>No messages yet. Start the conversation!</p>
                                                        </div>
                                                    ) : (
                                                        chatMessages.map((message, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`flex ${
                                                                    message.sender === 'Manager' ? 'justify-end' : 'justify-start'
                                                                }`}
                                                            >
                                                                <div
                                                                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                                                        message.sender === 'Manager'
                                                                            ? 'bg-blue-600 text-white'
                                                                            : (message.sender === 'Agent' || message.sender === 'AI')
                                                                            ? 'bg-green-100 text-green-800'
                                                                            : message.sender === 'Worker'
                                                                            ? 'bg-purple-100 text-purple-800'
                                                                            : 'bg-white border text-gray-800'
                                                                    }`}
                                                                >
                                                                    <div className="text-xs opacity-75 mb-1">
                                                                        {message.sender}
                                                                    </div>
                                                                    <p className="text-sm">{message.content}</p>
                                                                    <p className="text-xs opacity-75 mt-1">
                                                                        {new Date(message.created_at).toLocaleTimeString()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Message Input */}
                                                <div className="p-4 border-t bg-white">
                                                    <div className="flex space-x-2">
                                                        <Input
                                                            value={messageInput}
                                                            onChange={(e) => setMessageInput(e.target.value)}
                                                            placeholder="Type a message..."
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    console.log('Enter key pressed');
                                                                    console.log('Selected worker:', selectedWorker);
                                                                    console.log('Message input:', messageInput);
                                                                    sendMessageToWorker(selectedWorker.id, messageInput);
                                                                }
                                                            }}
                                                            className="flex-1"
                                                        />
                                                        <Button 
                                                            onClick={() => {
                                                                console.log('Send button clicked');
                                                                console.log('Selected worker:', selectedWorker);
                                                                console.log('Message input:', messageInput);
                                                                sendMessageToWorker(selectedWorker.id, messageInput);
                                                            }}
                                                            disabled={!messageInput.trim()}
                                                        >
                                                            <Send className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center">
                                                <div className="text-center">
                                                    <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select a team member</h3>
                                                    <p className="text-gray-500">Choose a team member from the left to start messaging</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeMenuItem === 'attendance' && (
                            <div className="p-6 space-y-6">
                                {/* Header with controls */}
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                                    <div>
                                        <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
                                        <p className="text-gray-600">Track and manage employee attendance records</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            onClick={() => setAttendanceViewMode(attendanceViewMode === 'table' ? 'analytics' : 'table')}
                                            variant="outline"
                                            className="flex items-center gap-2"
                                        >
                                            {attendanceViewMode === 'table' ? <TrendingUp className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                                            {attendanceViewMode === 'table' ? 'Analytics View' : 'Table View'}
                                        </Button>
                                        <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
                                            <Download className="h-4 w-4" />
                                            Export CSV
                                        </Button>
                                    </div>
                                </div>

                                {/* Filters */}
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input
                                                    placeholder="Search employees..."
                                                    value={attendanceSearchTerm}
                                                    onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                                                    className="pl-10"
                                                />
                                            </div>
                                            <div>
                                                <select
                                                    value={attendanceStatusFilter}
                                                    onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">All Statuses</option>
                                                    <option value="checked_in">Checked In</option>
                                                    <option value="checked_out">Checked Out</option>
                                                    <option value="on_break">On Break</option>
                                                    <option value="sick_leave">Sick Leave</option>
                                                    <option value="absent">Absent</option>
                                                </select>
                                            </div>
                                            <div>
                                                <Input
                                                    type="date"
                                                    placeholder="From Date"
                                                    value={attendanceDateFrom}
                                                    onChange={(e) => setAttendanceDateFrom(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Input
                                                    type="date"
                                                    placeholder="To Date"
                                                    value={attendanceDateTo}
                                                    onChange={(e) => setAttendanceDateTo(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Button onClick={() => {
                                                    setAttendanceSearchTerm('');
                                                    setAttendanceStatusFilter('');
                                                    setAttendanceDateFrom('');
                                                    setAttendanceDateTo('');
                                                }} variant="outline" className="w-full">
                                                    <Filter className="h-4 w-4 mr-2" />
                                                    Clear Filters
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {attendanceViewMode === 'analytics' && attendanceAnalytics && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {/* Summary Cards */}
                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <Users className="h-8 w-8 text-blue-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Total Employees</p>
                                                        <p className="text-2xl font-bold text-gray-900">{attendanceAnalytics.summary.total_employees}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <TrendingUp className="h-8 w-8 text-green-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Avg Attendance Rate</p>
                                                        <p className="text-2xl font-bold text-gray-900">
                                                            {attendanceAnalytics.summary.average_attendance_rate.toFixed(1)}%
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <Clock className="h-8 w-8 text-yellow-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Total Check-ins</p>
                                                        <p className="text-2xl font-bold text-gray-900">{attendanceAnalytics.summary.total_check_ins}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <Activity className="h-8 w-8 text-purple-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Total Records</p>
                                                        <p className="text-2xl font-bold text-gray-900">{attendanceAnalytics.total_records}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Status Breakdown */}
                                        <Card className="lg:col-span-2">
                                            <CardHeader>
                                                <CardTitle>Status Breakdown</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    {Object.entries(attendanceAnalytics.status_breakdown).map(([status, count]) => (
                                                        <div key={status} className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-3">
                                                                {getStatusBadge(status)}
                                                                <span className="text-sm text-gray-600">
                                                                    {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm font-semibold text-gray-900">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Employee Stats */}
                                        <Card className="lg:col-span-2">
                                            <CardHeader>
                                                <CardTitle>Top Employee Performance</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    {attendanceAnalytics.employee_stats.slice(0, 5).map((employee) => (
                                                        <div key={employee.user_id} className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">{employee.name}</p>
                                                                <p className="text-xs text-gray-500">{employee.email}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-semibold text-green-600">
                                                                    {employee.attendance_rate.toFixed(1)}%
                                                                </p>
                                                                <p className="text-xs text-gray-500">
                                                                    {employee.present_days}/{employee.total_days} days
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {attendanceViewMode === 'table' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Attendance Records</CardTitle>
                                            <CardDescription>
                                                {attendanceLoading ? 'Loading...' : `${filteredAttendanceData.length} records found`}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {attendanceLoading ? (
                                                <div className="text-center py-8">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                                    <p className="text-gray-500 mt-2">Loading attendance data...</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse border border-gray-300">
                                                        <thead>
                                                            <tr className="bg-gray-50">
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Date</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Employee</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Check In</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Check Out</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Break Start</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Break End</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Status</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Location</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Work Hours</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredAttendanceData.map((record) => (
                                                                <tr key={record.id} className="hover:bg-gray-50">
                                                                    <td className="border border-gray-300 p-3">{formatDate(record.created_at)}</td>
                                                                    <td className="border border-gray-300 p-3 font-medium">{record.user_name}</td>
                                                                    <td className="border border-gray-300 p-3">{formatTime(record.check_in_time)}</td>
                                                                    <td className="border border-gray-300 p-3">{formatTime(record.check_out_time)}</td>
                                                                    <td className="border border-gray-300 p-3">{formatTime(record.break_start)}</td>
                                                                    <td className="border border-gray-300 p-3">{formatTime(record.break_end)}</td>
                                                                    <td className="border border-gray-300 p-3">{getStatusBadge(record.status)}</td>
                                                                    <td className="border border-gray-300 p-3">{record.location || '-'}</td>
                                                                    <td className="border border-gray-300 p-3">{record.work_hours || '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>

                                                    {filteredAttendanceData.length === 0 && (
                                                        <div className="text-center py-8 text-gray-500">
                                                            No attendance records found
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}

                        {activeMenuItem === 'incidents' && (
                            <div className="p-6 space-y-6">
                                {/* Header with controls */}
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                                    <div>
                                        <h1 className="text-2xl font-bold text-gray-900">Incidents & Reports</h1>
                                        <p className="text-gray-600">Track and manage workplace incidents and reports</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            onClick={() => setIncidentsViewMode('create')}
                                            className="flex items-center gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Create Incident
                                        </Button>
                                        <Button
                                            onClick={() => setIncidentsViewMode(incidentsViewMode === 'table' ? 'stats' : 'table')}
                                            variant="outline"
                                            className="flex items-center gap-2"
                                        >
                                            {incidentsViewMode === 'table' ? <TrendingUp className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                            {incidentsViewMode === 'table' ? 'Statistics' : 'Table View'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Filters */}
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input
                                                    placeholder="Search incidents..."
                                                    value={incidentsSearchTerm}
                                                    onChange={(e) => setIncidentsSearchTerm(e.target.value)}
                                                    className="pl-10"
                                                />
                                            </div>
                                            <div>
                                                <select
                                                    value={incidentsStatusFilter}
                                                    onChange={(e) => setIncidentsStatusFilter(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">All Status</option>
                                                    <option value="open">Open</option>
                                                    <option value="in_progress">In Progress</option>
                                                    <option value="resolved">Resolved</option>
                                                    <option value="closed">Closed</option>
                                                </select>
                                            </div>
                                            <div>
                                                <select
                                                    value={incidentsSeverityFilter}
                                                    onChange={(e) => setIncidentsSeverityFilter(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">All Severity</option>
                                                    <option value="low">Low</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="high">High</option>
                                                    <option value="critical">Critical</option>
                                                </select>
                                            </div>
                                            <div>
                                                <Input
                                                    type="date"
                                                    placeholder="From Date"
                                                    value={incidentsDateFrom}
                                                    onChange={(e) => setIncidentsDateFrom(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Input
                                                    type="date"
                                                    placeholder="To Date"
                                                    value={incidentsDateTo}
                                                    onChange={(e) => setIncidentsDateTo(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Button onClick={() => {
                                                    setIncidentsSearchTerm('');
                                                    setIncidentsStatusFilter('');
                                                    setIncidentsSeverityFilter('');
                                                    setIncidentsDateFrom('');
                                                    setIncidentsDateTo('');
                                                }} variant="outline" className="w-full">
                                                    <Filter className="h-4 w-4 mr-2" />
                                                    Clear Filters
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Create Incident Form */}
                                {incidentsViewMode === 'create' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Create New Incident</CardTitle>
                                            <CardDescription>Report a new workplace incident</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                                <textarea
                                                    value={newIncident.description}
                                                    onChange={(e) => setNewIncident(prev => ({ ...prev, description: e.target.value }))}
                                                    placeholder="Describe the incident in detail..."
                                                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    rows={4}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
                                                <select
                                                    value={newIncident.severity}
                                                    onChange={(e) => setNewIncident(prev => ({ ...prev, severity: e.target.value }))}
                                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="low">Low</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="high">High</option>
                                                    <option value="critical">Critical</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Image URL (Optional)</label>
                                                <Input
                                                    type="url"
                                                    value={newIncident.image_url || ''}
                                                    onChange={(e) => setNewIncident(prev => ({ ...prev, image_url: e.target.value }))}
                                                    placeholder="https://example.com/image.jpg"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button onClick={createIncident} disabled={!newIncident.description}>
                                                    Create Incident
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    onClick={() => {
                                                        setIncidentsViewMode('table');
                                                        setNewIncident({ description: '', severity: 'low' });
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Statistics View */}
                                {incidentsViewMode === 'stats' && incidentsStats && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {/* Summary Cards */}
                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <AlertTriangle className="h-8 w-8 text-red-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Total Incidents</p>
                                                        <p className="text-2xl font-bold text-gray-900">{incidentsStats.total_incidents}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <Clock className="h-8 w-8 text-yellow-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Open Incidents</p>
                                                        <p className="text-2xl font-bold text-gray-900">{incidentsStats.open_incidents}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Resolved</p>
                                                        <p className="text-2xl font-bold text-gray-900">{incidentsStats.resolved_incidents}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <AlertTriangle className="h-8 w-8 text-red-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Critical</p>
                                                        <p className="text-2xl font-bold text-gray-900">{incidentsStats.critical_incidents}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Severity Breakdown */}
                                        <Card className="lg:col-span-2">
                                            <CardHeader>
                                                <CardTitle>Severity Breakdown</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    {Object.entries(incidentsStats.incidents_by_severity).map(([severity, count]) => (
                                                        <div key={severity} className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-3">
                                                                {getSeverityBadge(severity)}
                                                                <span className="text-sm text-gray-600">
                                                                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm font-semibold text-gray-900">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Recent Incidents */}
                                        <Card className="lg:col-span-2">
                                            <CardHeader>
                                                <CardTitle>Recent Incidents</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    {incidentsStats.recent_incidents.slice(0, 5).map((incident) => (
                                                        <div key={incident.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                                                    {incident.description}
                                                                </p>
                                                                <div className="flex items-center space-x-2 mt-2">
                                                                    {getSeverityBadge(incident.severity)}
                                                                    {getIncidentStatusBadge(incident.status)}
                                                                    <span className="text-xs text-gray-500">
                                                                        by {incident.reported_by_name}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(incident.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Table View */}
                                {incidentsViewMode === 'table' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Incidents & Reports</CardTitle>
                                            <CardDescription>
                                                {incidentsLoading ? 'Loading...' : `${filteredIncidentsData.length} incidents found`}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {incidentsLoading ? (
                                                <div className="text-center py-8">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                                    <p className="text-gray-500 mt-2">Loading incidents...</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse border border-gray-300">
                                                        <thead>
                                                            <tr className="bg-gray-50">
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">ID</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Description</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Severity</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Status</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Reporter</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Created</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredIncidentsData.map((incident) => (
                                                                <tr key={incident.id} className="hover:bg-gray-50">
                                                                    <td className="border border-gray-300 p-3">#{incident.id}</td>
                                                                    <td className="border border-gray-300 p-3 max-w-xs">
                                                                        <p className="line-clamp-2">{incident.description}</p>
                                                                    </td>
                                                                    <td className="border border-gray-300 p-3">{getSeverityBadge(incident.severity)}</td>
                                                                    <td className="border border-gray-300 p-3">{getIncidentStatusBadge(incident.status)}</td>
                                                                    <td className="border border-gray-300 p-3">
                                                                        <div>
                                                                            <p className="font-medium">{incident.reported_by_name}</p>
                                                                            <p className="text-xs text-gray-500">{incident.reported_by_email}</p>
                                                                        </div>
                                                                    </td>
                                                                    <td className="border border-gray-300 p-3">
                                                                        {new Date(incident.created_at).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-3">
                                                                        <div className="flex gap-2">
                                                                            {incident.status !== 'resolved' && incident.status !== 'closed' && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    onClick={() => updateIncident(incident.id, { status: 'resolved' })}
                                                                                >
                                                                                    Resolve
                                                                                </Button>
                                                                            )}
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={() => setEditingIncident(incident)}
                                                                            >
                                                                                Edit
                                                                            </Button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>

                                                    {filteredIncidentsData.length === 0 && (
                                                        <div className="text-center py-8 text-gray-500">
                                                            No incidents found
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Edit Modal */}
                                {editingIncident && (
                                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                                            <h3 className="text-lg font-semibold mb-4">Edit Incident #{editingIncident.id}</h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                                    <select
                                                        value={editingIncident.status}
                                                        onChange={(e) => setEditingIncident(prev => prev ? { ...prev, status: e.target.value } : null)}
                                                        className="w-full p-2 border border-gray-300 rounded-md"
                                                    >
                                                        <option value="open">Open</option>
                                                        <option value="in_progress">In Progress</option>
                                                        <option value="resolved">Resolved</option>
                                                        <option value="closed">Closed</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
                                                    <textarea
                                                        value={editingIncident.resolution || ''}
                                                        onChange={(e) => setEditingIncident(prev => prev ? { ...prev, resolution: e.target.value } : null)}
                                                        placeholder="Describe how this incident was resolved..."
                                                        className="w-full p-3 border border-gray-300 rounded-md"
                                                        rows={3}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        onClick={() => updateIncident(editingIncident.id, {
                                                            status: editingIncident.status,
                                                            resolution: editingIncident.resolution || undefined
                                                        })}
                                                    >
                                                        Update
                                                    </Button>
                                                    <Button variant="outline" onClick={() => setEditingIncident(null)}>
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeMenuItem === 'permissions' && (
                            <div className="p-6 space-y-6">
                                {/* Header with controls */}
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                                    <div>
                                        <h1 className="text-2xl font-bold text-gray-900">Permission Requests</h1>
                                        <p className="text-gray-600">Review and manage employee permission requests</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            onClick={() => setPermissionsViewMode(permissionsViewMode === 'table' ? 'stats' : 'table')}
                                            variant="outline"
                                            className="flex items-center gap-2"
                                        >
                                            {permissionsViewMode === 'table' ? <TrendingUp className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                            {permissionsViewMode === 'table' ? 'Statistics' : 'Table View'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Filters */}
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                                <Input
                                                    placeholder="Search requests..."
                                                    value={permissionsSearchTerm}
                                                    onChange={(e) => setPermissionsSearchTerm(e.target.value)}
                                                    className="pl-10"
                                                />
                                            </div>
                                            <div>
                                                <select
                                                    value={permissionsStatusFilter}
                                                    onChange={(e) => setPermissionsStatusFilter(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">All Status</option>
                                                    <option value="pending">Pending</option>
                                                    <option value="under_review">Under Review</option>
                                                    <option value="approved">Approved</option>
                                                    <option value="rejected">Rejected</option>
                                                </select>
                                            </div>
                                            <div>
                                                <select
                                                    value={permissionsTypeFilter}
                                                    onChange={(e) => setPermissionsTypeFilter(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">All Types</option>
                                                    <option value="overtime">Overtime</option>
                                                    <option value="vacation">Vacation</option>
                                                    <option value="sick_leave">Sick Leave</option>
                                                    <option value="special_access">Special Access</option>
                                                    <option value="early_leave">Early Leave</option>
                                                </select>
                                            </div>
                                            <div>
                                                <select
                                                    value={permissionsPriorityFilter}
                                                    onChange={(e) => setPermissionsPriorityFilter(e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">All Priority</option>
                                                    <option value="urgent">Urgent</option>
                                                    <option value="high">High</option>
                                                    <option value="normal">Normal</option>
                                                    <option value="low">Low</option>
                                                </select>
                                            </div>
                                            <div>
                                                <Input
                                                    type="date"
                                                    placeholder="From Date"
                                                    value={permissionsDateFrom}
                                                    onChange={(e) => setPermissionsDateFrom(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Input
                                                    type="date"
                                                    placeholder="To Date"
                                                    value={permissionsDateTo}
                                                    onChange={(e) => setPermissionsDateTo(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Button onClick={() => {
                                                    setPermissionsSearchTerm('');
                                                    setPermissionsStatusFilter('');
                                                    setPermissionsTypeFilter('');
                                                    setPermissionsPriorityFilter('');
                                                    setPermissionsDateFrom('');
                                                    setPermissionsDateTo('');
                                                }} variant="outline" className="w-full">
                                                    <Filter className="h-4 w-4 mr-2" />
                                                    Clear Filters
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Statistics View */}
                                {permissionsViewMode === 'stats' && permissionsStats && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {/* Summary Cards */}
                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <Shield className="h-8 w-8 text-blue-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Total Requests</p>
                                                        <p className="text-2xl font-bold text-gray-900">{permissionsStats.total_requests}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <Clock className="h-8 w-8 text-yellow-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Pending</p>
                                                        <p className="text-2xl font-bold text-gray-900">{permissionsStats.pending_requests}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Approved</p>
                                                        <p className="text-2xl font-bold text-gray-900">{permissionsStats.approved_requests}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardContent className="p-6">
                                                <div className="flex items-center">
                                                    <AlertTriangle className="h-8 w-8 text-red-600" />
                                                    <div className="ml-4">
                                                        <p className="text-sm font-medium text-gray-600">Urgent</p>
                                                        <p className="text-2xl font-bold text-gray-900">{permissionsStats.urgent_requests}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Request Types Breakdown */}
                                        <Card className="lg:col-span-2">
                                            <CardHeader>
                                                <CardTitle>Request Types</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    {Object.entries(permissionsStats.requests_by_type).map(([type, count]) => (
                                                        <div key={type} className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-3">
                                                                {getRequestTypeBadge(type)}
                                                                <span className="text-sm text-gray-600">
                                                                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm font-semibold text-gray-900">{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Recent Requests */}
                                        <Card className="lg:col-span-2">
                                            <CardHeader>
                                                <CardTitle>Recent Requests</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-4">
                                                    {permissionsStats.recent_requests.slice(0, 5).map((request) => (
                                                        <div key={request.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium text-gray-900">
                                                                    {request.title}
                                                                </p>
                                                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                                                    {request.description}
                                                                </p>
                                                                <div className="flex items-center space-x-2 mt-2">
                                                                    {getRequestTypeBadge(request.request_type)}
                                                                    {getPriorityBadge(request.priority)}
                                                                    {getPermissionStatusBadge(request.status)}
                                                                </div>
                                                                <span className="text-xs text-gray-500">
                                                                    by {request.requester_name}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-gray-500">
                                                                {new Date(request.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Table View */}
                                {permissionsViewMode === 'table' && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Permission Requests</CardTitle>
                                            <CardDescription>
                                                {permissionsLoading ? 'Loading...' : `${filteredPermissionsData.length} requests found`}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {permissionsLoading ? (
                                                <div className="text-center py-8">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                                    <p className="text-gray-500 mt-2">Loading permissions...</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse border border-gray-300">
                                                        <thead>
                                                            <tr className="bg-gray-50">
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">ID</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Title</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Type</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Priority</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Status</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Requester</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Requested Date</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Created</th>
                                                                <th className="border border-gray-300 p-3 text-left font-semibold">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredPermissionsData.map((request) => (
                                                                <tr key={request.id} className="hover:bg-gray-50">
                                                                    <td className="border border-gray-300 p-3">#{request.id}</td>
                                                                    <td className="border border-gray-300 p-3 max-w-xs">
                                                                        <p className="font-medium line-clamp-1">{request.title}</p>
                                                                        <p className="text-xs text-gray-500 line-clamp-2">{request.description}</p>
                                                                    </td>
                                                                    <td className="border border-gray-300 p-3">{getRequestTypeBadge(request.request_type)}</td>
                                                                    <td className="border border-gray-300 p-3">{getPriorityBadge(request.priority)}</td>
                                                                    <td className="border border-gray-300 p-3">{getPermissionStatusBadge(request.status)}</td>
                                                                    <td className="border border-gray-300 p-3">
                                                                        <div>
                                                                            <p className="font-medium">{request.requester_name}</p>
                                                                            <p className="text-xs text-gray-500">{request.requester_email}</p>
                                                                        </div>
                                                                    </td>
                                                                    <td className="border border-gray-300 p-3">
                                                                        {request.requested_date 
                                                                            ? new Date(request.requested_date).toLocaleDateString() 
                                                                            : '-'}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-3">
                                                                        {new Date(request.created_at).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="border border-gray-300 p-3">
                                                                        <div className="flex gap-2">
                                                                            {request.status === 'pending' && (
                                                                                <>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="text-green-600 hover:bg-green-50"
                                                                                        onClick={() => updatePermissionRequest(request.id, { 
                                                                                            status: 'approved',
                                                                                            manager_response: 'Approved by manager'
                                                                                        })}
                                                                                    >
                                                                                        Approve
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        className="text-red-600 hover:bg-red-50"
                                                                                        onClick={() => setReviewingPermission(request)}
                                                                                    >
                                                                                        Review
                                                                                    </Button>
                                                                                </>
                                                                            )}
                                                                            {request.status !== 'pending' && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => setReviewingPermission(request)}
                                                                                >
                                                                                    View
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>

                                                    {filteredPermissionsData.length === 0 && (
                                                        <div className="text-center py-8 text-gray-500">
                                                            No permission requests found
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Review Modal */}
                                {reviewingPermission && (
                                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                            <h3 className="text-lg font-semibold mb-4">Permission Request #{reviewingPermission.id}</h3>
                                            
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Requester</label>
                                                        <p className="text-sm text-gray-900">{reviewingPermission.requester_name}</p>
                                                        <p className="text-xs text-gray-500">{reviewingPermission.requester_email}</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                                        {getRequestTypeBadge(reviewingPermission.request_type)}
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                                        {getPriorityBadge(reviewingPermission.priority)}
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                                        {getPermissionStatusBadge(reviewingPermission.status)}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                                    <p className="text-sm text-gray-900">{reviewingPermission.title}</p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{reviewingPermission.description}</p>
                                                </div>

                                                {reviewingPermission.requested_date && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Requested Date</label>
                                                        <p className="text-sm text-gray-900">
                                                            {new Date(reviewingPermission.requested_date).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                )}

                                                {reviewingPermission.requested_hours && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Requested Hours</label>
                                                        <p className="text-sm text-gray-900">{reviewingPermission.requested_hours}</p>
                                                    </div>
                                                )}

                                                {reviewingPermission.manager_response && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Manager Response</label>
                                                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{reviewingPermission.manager_response}</p>
                                                    </div>
                                                )}

                                                {reviewingPermission.status === 'pending' && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">Manager Response</label>
                                                        <textarea
                                                            value={reviewResponse}
                                                            onChange={(e) => setReviewResponse(e.target.value)}
                                                            placeholder="Add your response or reason for decision..."
                                                            className="w-full p-3 border border-gray-300 rounded-md"
                                                            rows={3}
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    {reviewingPermission.status === 'pending' && (
                                                        <>
                                                            <Button 
                                                                onClick={() => updatePermissionRequest(reviewingPermission.id, {
                                                                    status: 'approved',
                                                                    manager_response: reviewResponse || 'Approved by manager'
                                                                })}
                                                                className="bg-green-600 hover:bg-green-700"
                                                            >
                                                                Approve
                                                            </Button>
                                                            <Button 
                                                                onClick={() => updatePermissionRequest(reviewingPermission.id, {
                                                                    status: 'rejected',
                                                                    manager_response: reviewResponse || 'Rejected by manager'
                                                                })}
                                                                className="bg-red-600 hover:bg-red-700"
                                                            >
                                                                Reject
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button 
                                                        variant="outline" 
                                                        onClick={() => {
                                                            setReviewingPermission(null);
                                                            setReviewResponse('');
                                                        }}
                                                    >
                                                        Close
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeMenuItem === 'work-assignment' && (
                            <div className="flex items-center justify-center h-64">
                                <p className="text-gray-500">Work Assignment page - Coming soon</p>
                            </div>
                        )}

                        {activeMenuItem === 'team' && (
                            <div className="space-y-6">
                                {/* Team Overview */}
                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle>Team Members</CardTitle>
                                                <CardDescription>Manage your team members and their access</CardDescription>
                                            </div>
                                            <Button onClick={() => setIsAddEmployeeOpen(true)}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add Member
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {isLoadingTeam ? (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="text-gray-500">Loading team members...</div>
                                            </div>
                                        ) : teamMembers.length === 0 ? (
                                            <div className="text-center py-8">
                                                <UserIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                                <p className="text-gray-500 mb-4">No team members yet</p>
                                                <Button onClick={() => setIsAddEmployeeOpen(true)}>
                                                    Add Your First Team Member
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {teamMembers.map((member) => (
                                                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                                                        <div className="flex items-center space-x-4">
                                                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                                                                <UserIcon className="h-5 w-5 text-white" />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-medium text-gray-900">
                                                                    {member.full_name || 'No Name'}
                                                                </h3>
                                                                <p className="text-sm text-gray-500">{member.email}</p>
                                                                <div className="flex items-center space-x-2 mt-1">
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                                        member.role === 'Manager' 
                                                                            ? 'bg-purple-100 text-purple-800'
                                                                            : 'bg-green-100 text-green-800'
                                                                    }`}>
                                                                        {member.role}
                                                                    </span>
                                                                    <span className="text-xs text-gray-400">
                                                                        Joined {new Date(member.created_at).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            {member.role !== 'Manager' && (
                                                                <>
                                                                    <Button 
                                                                        variant="outline" 
                                                                        size="sm"
                                                                        onClick={() => setEditingMember(member)}
                                                                    >
                                                                        Edit
                                                                    </Button>
                                                                    <Button 
                                                                        variant="outline" 
                                                                        size="sm"
                                                                        className="text-red-600 hover:text-red-700"
                                                                        onClick={() => setDeletingMember(member)}
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {member.role === 'Manager' && (
                                                                <span className="text-xs text-gray-500 italic">Team Owner</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Settings Section */}
                        {activeMenuItem === 'settings' && (
                            <div className="space-y-6">
                                {/* Settings Header */}
                                <div className="border-b pb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                                    <p className="text-gray-600 mt-1">Manage your account, team, and platform preferences</p>
                                </div>

                                {/* Settings Navigation */}
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {[
                                        { id: 'account', label: 'Account', icon: UserCog },
                                        { id: 'security', label: 'Security', icon: Lock },
                                        { id: 'team-settings', label: 'Team Settings', icon: Users },
                                        { id: 'billing', label: 'Billing & Premium', icon: CreditCard },
                                        { id: 'notifications', label: 'Notifications', icon: Mail },
                                        { id: 'integrations', label: 'Integrations', icon: Zap },
                                        { id: 'data', label: 'Data Management', icon: Database },
                                        { id: 'system', label: 'System', icon: Settings2 }
                                    ].map((tab) => {
                                        const IconComponent = tab.icon;
                                        return (
                                            <Button
                                                key={tab.id}
                                                variant={activeSettingsTab === tab.id ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setActiveSettingsTab(tab.id)}
                                                className="flex items-center gap-2"
                                            >
                                                <IconComponent className="h-4 w-4" />
                                                {tab.label}
                                            </Button>
                                        );
                                    })}
                                </div>

                                {/* Account Settings */}
                                {activeSettingsTab === 'account' && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <UserCog className="h-5 w-5" />
                                                    Account Information
                                                </CardTitle>
                                                <CardDescription>
                                                    Manage your personal account details and preferences
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-700 block mb-2">Full Name</label>
                                                        <Input
                                                            value={user?.full_name || ''}
                                                            disabled
                                                            className="bg-gray-50"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-700 block mb-2">Email</label>
                                                        <Input
                                                            value={user?.email || ''}
                                                            disabled
                                                            className="bg-gray-50"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="pt-4 border-t">
                                                    <h4 className="font-medium text-gray-900 mb-3">Account Actions</h4>
                                                    <div className="flex gap-3">
                                                        <Button 
                                                            onClick={handleLogout}
                                                            variant="outline"
                                                            className="flex items-center gap-2"
                                                        >
                                                            <LogOut className="h-4 w-4" />
                                                            Sign Out
                                                        </Button>
                                                        <Button 
                                                            onClick={() => setShowDeleteAccountModal(true)}
                                                            variant="destructive"
                                                            className="flex items-center gap-2"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Delete Account
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Security Settings */}
                                {activeSettingsTab === 'security' && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Lock className="h-5 w-5" />
                                                    Password & Security
                                                </CardTitle>
                                                <CardDescription>
                                                    Manage your password and security preferences
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <Button 
                                                    onClick={() => setShowPasswordModal(true)}
                                                    variant="outline"
                                                    className="flex items-center gap-2"
                                                >
                                                    <Key className="h-4 w-4" />
                                                    Change Password
                                                </Button>
                                                <div className="p-4 border rounded-lg bg-blue-50">
                                                    <div className="flex items-start gap-3">
                                                        <Smartphone className="h-5 w-5 text-blue-600 mt-0.5" />
                                                        <div>
                                                            <h4 className="font-medium text-blue-900">Two-Factor Authentication</h4>
                                                            <p className="text-sm text-blue-700 mt-1">
                                                                Coming soon - Add an extra layer of security to your account
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Team Settings */}
                                {activeSettingsTab === 'team-settings' && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Users className="h-5 w-5" />
                                                    Team Configuration
                                                </CardTitle>
                                                <CardDescription>
                                                    Configure team-wide settings and permissions
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-700 block mb-2">Team Name</label>
                                                        <Input
                                                            value={teamName}
                                                            onChange={(e) => setTeamName(e.target.value)}
                                                            placeholder="Enter team name"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-700 block mb-2">Team Size Limit</label>
                                                        <Input
                                                            value="10 members"
                                                            disabled
                                                            className="bg-gray-50"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <h4 className="font-medium text-gray-900">Team Permissions</h4>
                                                    <div className="space-y-2">
                                                        {[
                                                            'Allow workers to create tasks',
                                                            'Enable file sharing between team members',
                                                            'Allow workers to view other workers\' tasks',
                                                            'Enable team-wide notifications'
                                                        ].map((permission, index) => (
                                                            <label key={index} className="flex items-center space-x-2">
                                                                <input type="checkbox" defaultChecked className="rounded" />
                                                                <span className="text-sm text-gray-700">{permission}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                                <Button className="mt-4">Save Team Settings</Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Billing & Premium */}
                                {activeSettingsTab === 'billing' && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <CreditCard className="h-5 w-5" />
                                                    Billing & Subscription
                                                </CardTitle>
                                                <CardDescription>
                                                    Manage your subscription and billing information
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="p-6 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h3 className="text-lg font-semibold text-gray-900">Current Plan: Free</h3>
                                                            <p className="text-gray-600 mt-1">Basic features for small teams</p>
                                                            <ul className="mt-3 space-y-1 text-sm text-gray-600">
                                                                <li>• Up to 5 team members</li>
                                                                <li>• Basic task management</li>
                                                                <li>• 1GB file storage</li>
                                                            </ul>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-2xl font-bold text-gray-900">$0</div>
                                                            <div className="text-gray-600">per month</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-6 border rounded-lg border-blue-200 bg-blue-50">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h3 className="text-lg font-semibold text-blue-900">Upgrade to Premium</h3>
                                                            <p className="text-blue-700 mt-1">Unlock advanced features and AI capabilities</p>
                                                            <ul className="mt-3 space-y-1 text-sm text-blue-700">
                                                                <li>• Unlimited team members</li>
                                                                <li>• Advanced AI-powered automation</li>
                                                                <li>• 100GB file storage</li>
                                                                <li>• Priority support</li>
                                                                <li>• Custom integrations</li>
                                                            </ul>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-2xl font-bold text-blue-900">$29</div>
                                                            <div className="text-blue-700">per month</div>
                                                        </div>
                                                    </div>
                                                    <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                                                        Upgrade to Premium
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Notifications */}
                                {activeSettingsTab === 'notifications' && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Mail className="h-5 w-5" />
                                                    Notification Preferences
                                                </CardTitle>
                                                <CardDescription>
                                                    Choose how you want to be notified about important events
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="space-y-4">
                                                    <h4 className="font-medium text-gray-900">Email Notifications</h4>
                                                    <div className="space-y-3">
                                                        {[
                                                            'New task assignments',
                                                            'Task completions',
                                                            'Team member updates',
                                                            'System maintenance alerts',
                                                            'Weekly summaries'
                                                        ].map((notification, index) => (
                                                            <label key={index} className="flex items-center justify-between">
                                                                <span className="text-sm text-gray-700">{notification}</span>
                                                                <input type="checkbox" defaultChecked className="rounded" />
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-4 pt-4 border-t">
                                                    <h4 className="font-medium text-gray-900">Push Notifications</h4>
                                                    <div className="space-y-3">
                                                        {[
                                                            'Urgent task updates',
                                                            'Direct messages',
                                                            'System alerts'
                                                        ].map((notification, index) => (
                                                            <label key={index} className="flex items-center justify-between">
                                                                <span className="text-sm text-gray-700">{notification}</span>
                                                                <input type="checkbox" defaultChecked className="rounded" />
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <Button className="mt-6">Save Notification Preferences</Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Integrations */}
                                {activeSettingsTab === 'integrations' && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Zap className="h-5 w-5" />
                                                    Third-party Integrations
                                                </CardTitle>
                                                <CardDescription>
                                                    Connect WorkHub with your favorite tools and services
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {[
                                                        { name: 'Slack', description: 'Team communication', status: 'available' },
                                                        { name: 'Google Drive', description: 'File storage & sharing', status: 'available' },
                                                        { name: 'Microsoft Teams', description: 'Video meetings', status: 'coming-soon' },
                                                        { name: 'Zapier', description: 'Workflow automation', status: 'coming-soon' }
                                                    ].map((integration) => (
                                                        <div key={integration.name} className="p-4 border rounded-lg">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <h4 className="font-medium text-gray-900">{integration.name}</h4>
                                                                    <p className="text-sm text-gray-600 mt-1">{integration.description}</p>
                                                                </div>
                                                                {integration.status === 'available' ? (
                                                                    <Button size="sm" variant="outline">Connect</Button>
                                                                ) : (
                                                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                                                        Coming Soon
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Data Management */}
                                {activeSettingsTab === 'data' && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Database className="h-5 w-5" />
                                                    Data Management
                                                </CardTitle>
                                                <CardDescription>
                                                    Export, import, and manage your team's data
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="space-y-4">
                                                    <h4 className="font-medium text-gray-900">Data Export</h4>
                                                    <p className="text-sm text-gray-600">
                                                        Export your team's data for backup or migration purposes
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" className="flex items-center gap-2">
                                                            <Download className="h-4 w-4" />
                                                            Export Tasks
                                                        </Button>
                                                        <Button variant="outline" className="flex items-center gap-2">
                                                            <Download className="h-4 w-4" />
                                                            Export Team Data
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 pt-4 border-t">
                                                    <h4 className="font-medium text-gray-900">Data Import</h4>
                                                    <p className="text-sm text-gray-600">
                                                        Import data from other project management tools
                                                    </p>
                                                    <Button variant="outline" className="flex items-center gap-2">
                                                        <Upload className="h-4 w-4" />
                                                        Import Data
                                                    </Button>
                                                </div>

                                                <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                                                    <div className="flex items-start gap-3">
                                                        <Database className="h-5 w-5 text-yellow-600 mt-0.5" />
                                                        <div>
                                                            <h4 className="font-medium text-yellow-900">Data Retention</h4>
                                                            <p className="text-sm text-yellow-700 mt-1">
                                                                Your data is automatically backed up daily and retained for 30 days
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* System Settings */}
                                {activeSettingsTab === 'system' && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Settings2 className="h-5 w-5" />
                                                    System Preferences
                                                </CardTitle>
                                                <CardDescription>
                                                    Configure system-wide settings and preferences
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                <div className="space-y-4">
                                                    <h4 className="font-medium text-gray-900">Appearance</h4>
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-700">Theme</p>
                                                            <p className="text-sm text-gray-600">Choose your interface theme</p>
                                                        </div>
                                                        <select className="border rounded-md px-3 py-2 text-sm">
                                                            <option>Light</option>
                                                            <option>Dark</option>
                                                            <option>Auto</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 pt-4 border-t">
                                                    <h4 className="font-medium text-gray-900">Language & Region</h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-sm font-medium text-gray-700 block mb-2">Language</label>
                                                            <select className="w-full border rounded-md px-3 py-2 text-sm">
                                                                <option>English (US)</option>
                                                                <option>English (UK)</option>
                                                                <option>Spanish</option>
                                                                <option>French</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-sm font-medium text-gray-700 block mb-2">Timezone</label>
                                                            <select className="w-full border rounded-md px-3 py-2 text-sm">
                                                                <option>UTC-5 (Eastern Time)</option>
                                                                <option>UTC-6 (Central Time)</option>
                                                                <option>UTC-7 (Mountain Time)</option>
                                                                <option>UTC-8 (Pacific Time)</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <Button className="mt-6">Save System Settings</Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )}
                    </main>
                </div>

                {/* Settings Modals */}
                {/* Delete Account Modal */}
                {showDeleteAccountModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="w-full max-w-md bg-white shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-red-600 flex items-center gap-2">
                                    <Trash2 className="h-5 w-5" />
                                    Delete Account
                                </CardTitle>
                                <CardDescription>
                                    This action cannot be undone. All your data will be permanently removed.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <h4 className="font-medium text-red-900 mb-2">What will be deleted:</h4>
                                    <ul className="text-sm text-red-700 space-y-1">
                                        <li>• Your account and profile</li>
                                        <li>• All team data and members</li>
                                        <li>• Task history and files</li>
                                        <li>• Chat messages and communications</li>
                                    </ul>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-2">
                                        Type "DELETE" to confirm:
                                    </label>
                                    <Input
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder="DELETE"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-4">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => {
                                            setShowDeleteAccountModal(false);
                                            setDeleteConfirmText('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        variant="destructive"
                                        disabled={deleteConfirmText !== 'DELETE'}
                                        onClick={() => {
                                            // Handle account deletion
                                            console.log('Account deletion confirmed');
                                        }}
                                    >
                                        Delete Account
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Change Password Modal */}
                {showPasswordModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="w-full max-w-md bg-white shadow-xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Key className="h-5 w-5" />
                                    Change Password
                                </CardTitle>
                                <CardDescription>
                                    Enter your current password and choose a new one
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    // Handle password change
                                    console.log('Password change submitted');
                                }} className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 block mb-2">
                                            Current Password
                                        </label>
                                        <Input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 block mb-2">
                                            New Password
                                        </label>
                                        <Input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 block mb-2">
                                            Confirm New Password
                                        </label>
                                        <Input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    {passwordError && (
                                        <p className="text-sm text-red-600">{passwordError}</p>
                                    )}
                                    <div className="flex justify-end gap-2 pt-4">
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            onClick={() => {
                                                setShowPasswordModal(false);
                                                setCurrentPassword('');
                                                setNewPassword('');
                                                setConfirmPassword('');
                                                setPasswordError('');
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit">
                                            Update Password
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Edit Member Modal */}
                {editingMember && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="w-full max-w-md bg-white shadow-xl">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Edit Team Member</CardTitle>
                                    <CardDescription>Update member information</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setEditingMember(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.target as HTMLFormElement);
                                    handleEditMember(editingMember.id, {
                                        full_name: formData.get('full_name'),
                                        email: formData.get('email')
                                    });
                                }} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Full Name</label>
                                        <Input
                                            name="full_name"
                                            defaultValue={editingMember.full_name || ''}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email</label>
                                        <Input
                                            name="email"
                                            type="email"
                                            defaultValue={editingMember.email}
                                            required
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-4">
                                        <Button type="button" variant="outline" onClick={() => setEditingMember(null)}>
                                            Cancel
                                        </Button>
                                        <Button type="submit">Update Member</Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deletingMember && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="w-full max-w-md bg-white shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-red-600">Remove Team Member</CardTitle>
                                <CardDescription>
                                    Are you sure you want to remove {deletingMember.full_name || deletingMember.email} from your team?
                                    This action cannot be undone.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setDeletingMember(null)}>
                                        Cancel
                                    </Button>
                                    <Button 
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                        onClick={() => handleDeleteMember(deletingMember.id)}
                                    >
                                        Remove Member
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Add Employee Modal */}
                {isAddEmployeeOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="w-full max-w-md bg-white shadow-xl">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Add New Employee</CardTitle>
                                    <CardDescription>Create an account for a new team member.</CardDescription>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setIsAddEmployeeOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {addEmployeeError && (
                                    <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700">
                                        {addEmployeeError}
                                    </div>
                                )}
                                {addEmployeeSuccess && (
                                    <div className="mb-4 rounded bg-green-100 p-3 text-sm text-green-700">
                                        {addEmployeeSuccess}
                                    </div>
                                )}
                                <form onSubmit={handleAddEmployee} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Full Name</label>
                                        <Input
                                            value={newEmployeeName}
                                            onChange={(e) => setNewEmployeeName(e.target.value)}
                                            required
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email</label>
                                        <Input
                                            type="email"
                                            value={newEmployeeEmail}
                                            onChange={(e) => setNewEmployeeEmail(e.target.value)}
                                            required
                                            placeholder="john@workhub.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Password</label>
                                        <Input
                                            type="password"
                                            value={newEmployeePassword}
                                            onChange={(e) => setNewEmployeePassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-4">
                                        <Button type="button" variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>Cancel</Button>
                                        <Button type="submit">Create Account</Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
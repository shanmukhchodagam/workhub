'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
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
    Send
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

import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/app/context/AuthContext';

export default function ManagerDashboard() {
    const { user, token, logout } = useAuth();
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
        { id: 'team', label: 'Team Management', icon: Settings }
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
                                sidebarCollapsed ? "px-2" : "px-3"
                            )}
                            onClick={() => alert('Settings coming soon!')}
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
                            onClick={logout}
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
                            <div className="flex items-center justify-center h-64">
                                <p className="text-gray-500">Attendance page - Coming soon</p>
                            </div>
                        )}

                        {activeMenuItem === 'incidents' && (
                            <div className="flex items-center justify-center h-64">
                                <p className="text-gray-500">Incidents & Reports page - Coming soon</p>
                            </div>
                        )}

                        {activeMenuItem === 'permissions' && (
                            <div className="flex items-center justify-center h-64">
                                <p className="text-gray-500">Permissions page - Coming soon</p>
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
                    </main>
                </div>

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
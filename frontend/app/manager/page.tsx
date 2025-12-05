'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardEvent {
    type: string;
    content: string;
    sender_id: number;
    timestamp: string;
}

export default function ManagerDashboard() {
    const [clientId, setClientId] = useState<number | null>(null);
    const [events, setEvents] = useState<DashboardEvent[]>([]);
    const [stats, setStats] = useState({
        activeWorkers: 12,
        pendingTasks: 5,
        incidents: 2,
        completedTasks: 45
    });

    useEffect(() => {
        setClientId(Math.floor(Math.random() * 10000));
    }, []);

    const wsUrl = clientId ? `ws://localhost:8000/ws/manager/${clientId}` : '';
    const { messages, isConnected } = useWebSocket(wsUrl);

    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            // In a real app, we'd parse this properly. 
            // Our backend sends JSON for manager broadcasts.
            if (lastMsg.type === 'new_message' || lastMsg.type === 'agent_response') {
                const newEvent: DashboardEvent = {
                    type: lastMsg.type,
                    content: lastMsg.content,
                    sender_id: lastMsg.sender_id,
                    timestamp: new Date().toLocaleTimeString()
                };
                setEvents(prev => [newEvent, ...prev].slice(0, 50)); // Keep last 50

                // Mock updating stats based on events
                if (lastMsg.content.toLowerCase().includes('incident')) {
                    setStats(prev => ({ ...prev, incidents: prev.incidents + 1 }));
                }
            }
        }
    }, [messages]);

    if (!clientId) return <div>Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Operations Dashboard</h1>
                        <p className="text-gray-500">Real-time overview of field operations</p>
                    </div>
                    <div className={cn("px-3 py-1 rounded-full text-sm font-medium", isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                        {isConnected ? 'Live Connected' : 'Disconnected'}
                    </div>
                </div>

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
                            <p className="text-xs text-muted-foreground">-10% from yesterday</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Incidents</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{stats.incidents}</div>
                            <p className="text-xs text-muted-foreground">Requires attention</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
                            <p className="text-xs text-muted-foreground">+12% productivity</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Live Feed */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Live Activity Feed</CardTitle>
                            <CardDescription>Real-time updates from the field</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {events.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">No recent activity</div>
                                ) : (
                                    events.map((event, i) => (
                                        <div key={i} className="flex items-start gap-4 border-b pb-4 last:border-0">
                                            <div className={cn("w-2 h-2 mt-2 rounded-full", event.type === 'new_message' ? "bg-blue-500" : "bg-purple-500")} />
                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm font-medium leading-none">
                                                    {event.type === 'new_message' ? `Worker #${event.sender_id}` : 'AI Agent'}
                                                </p>
                                                <p className="text-sm text-muted-foreground">{event.content}</p>
                                            </div>
                                            <div className="text-xs text-muted-foreground">{event.timestamp}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="col-span-3">
                        <CardHeader>
                            <CardTitle>Recent Incidents</CardTitle>
                            <CardDescription>High priority issues</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 p-3 bg-red-50 rounded-lg border border-red-100">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                    <div>
                                        <p className="text-sm font-medium text-red-900">Safety Violation</p>
                                        <p className="text-xs text-red-700">Site B - Reported 10m ago</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                    <div>
                                        <p className="text-sm font-medium text-yellow-900">Equipment Malfunction</p>
                                        <p className="text-xs text-yellow-700">Site A - Reported 1h ago</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

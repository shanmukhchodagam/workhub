'use client';

import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Send, User, Bot, LogOut, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/app/context/AuthContext';

export default function WorkerChat() {
    const { user, logout } = useAuth();
    const [input, setInput] = useState('');
    const [chatHistory, setChatHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const wsUrl = user ? `ws://localhost:8000/ws/worker/${user.user_id}` : '';
    const { messages, sendMessage, isConnected } = useWebSocket(wsUrl);

    // Load chat history when component mounts
    useEffect(() => {
        const loadChatHistory = async () => {
            if (!user) return;
            
            setIsLoadingHistory(true);
            try {
                const token = localStorage.getItem('token');
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const res = await fetch(`${apiUrl}/my-messages`, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                
                if (res.ok) {
                    const history = await res.json();
                    setChatHistory(history);
                } else {
                    console.error('Failed to load chat history:', await res.text());
                }
            } catch (error) {
                console.error('Error loading chat history:', error);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        loadChatHistory();
    }, [user]);

    const allMessages = [...chatHistory, ...messages];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [allMessages]);

    const handleSend = () => {
        if (input.trim()) {
            sendMessage(input);
            setInput('');
        }
    };

    return (
        <ProtectedRoute allowedRoles={['Worker', 'Employee']}>
            <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
                <Card className="w-full max-w-md h-[600px] flex flex-col shadow-xl">
                    <CardHeader className="border-b bg-white rounded-t-lg">
                        <CardTitle className="flex items-center justify-between">
                            <span>WorkHub Assistant</span>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-xs px-2 py-1 rounded-full", 
                                    isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                                    {isConnected ? 'Online' : 'Offline'}
                                </span>
                                <Button variant="outline" size="sm" onClick={logout} className="h-8">
                                    <LogOut className="h-3 w-3" />
                                </Button>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {isLoadingHistory && (
                            <div className="flex items-center justify-center py-4">
                                <div className="text-gray-500 text-sm">Loading chat history...</div>
                            </div>
                        )}
                        
                        {allMessages.map((msg, idx) => {
                            let content = typeof msg === 'string' ? msg : msg.content;
                            let senderLabel = 'System';
                            let isFromUser = false;
                            let isFromAgent = false;
                            let isFromManager = false;

                            if (typeof msg === 'object' && msg.sender) {
                                switch (msg.sender) {
                                    case 'Worker':
                                        senderLabel = 'You';
                                        isFromUser = true;
                                        break;
                                    case 'Manager':
                                        senderLabel = 'Manager';
                                        isFromManager = true;
                                        break;
                                    default:
                                        senderLabel = msg.sender;
                                }
                            } else {
                                if (content?.startsWith('You:')) {
                                    content = content.replace(/^You:\s*/, '');
                                    senderLabel = 'You';
                                    isFromUser = true;
                                } else if (content?.startsWith('🤖 AI:')) {
                                    content = content.replace(/^🤖 AI:\s*/, '');
                                    senderLabel = 'AI Assistant';
                                    isFromAgent = true;
                                } else if (content?.startsWith('Manager:')) {
                                    content = content.replace(/^Manager:\s*/, '');
                                    senderLabel = 'Manager';
                                    isFromManager = true;
                                }
                            }

                            return (
                                <div key={idx} className={cn("flex", isFromUser ? "justify-end" : "justify-start")}>
                                    <div className={cn(
                                        "max-w-[80%] rounded-lg px-3 py-2",
                                        isFromUser 
                                            ? "bg-blue-500 text-white" 
                                            : isFromAgent 
                                                ? "bg-green-100 text-green-800 border border-green-200"
                                                : isFromManager
                                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                                    : "bg-white text-gray-800 border"
                                    )}>
                                        <div className="flex items-center gap-1 mb-1">
                                            {isFromUser && <User size={12} />}
                                            {isFromAgent && <Bot size={12} />}
                                            {isFromManager && <Crown size={12} />}
                                            <span className="text-xs font-medium">{senderLabel}</span>
                                        </div>
                                        <div className="text-sm whitespace-pre-wrap">{content}</div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </CardContent>
                    
                    <CardFooter className="border-t p-4 bg-white rounded-b-lg">
                        <div className="flex w-full gap-2">
                            <Input
                                placeholder="Type a message..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                disabled={!isConnected}
                            />
                            <Button onClick={handleSend} disabled={!isConnected} size="icon">
                                <Send size={18} />
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        </ProtectedRoute>
    );
}

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

    // Load chat history when component mounts or user changes
    useEffect(() => {
        const loadChatHistory = async () => {
            if (!user) return;
            
            setIsLoadingHistory(true);
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/my-messages`, {
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

    // Combine chat history with live WebSocket messages
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
        <ProtectedRoute allowedRoles={['worker', 'Employee']}>
            <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
                <Card className="w-full max-w-md h-[600px] flex flex-col shadow-xl">
                    <CardHeader className="border-b bg-white rounded-t-lg">
                        <CardTitle className="flex items-center justify-between">
                            <span>Workhub Assistant</span>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-xs px-2 py-1 rounded-full", isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
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
                            // Handle different message formats:
                            // 1. Database messages have 'sender' field
                            // 2. WebSocket messages have content prefixes
                            
                            let content = msg.content;
                            let senderLabel = '';
                            let isFromUser = false;
                            let isFromAgent = false;
                            let isFromManager = false;
                            
                            if (msg.sender) {
                                // Database message format
                                switch (msg.sender) {
                                    case 'User':
                                    case 'Worker':
                                        senderLabel = 'You';
                                        isFromUser = true;
                                        break;
                                    case 'Agent':
                                    case 'AI':
                                        senderLabel = 'AI Assistant';
                                        isFromAgent = true;
                                        break;
                                    case 'Manager':
                                        senderLabel = 'Manager';
                                        isFromManager = true;
                                        break;
                                    default:
                                        senderLabel = msg.sender;
                                }
                            } else {
                                // WebSocket message format with prefixes
                                const isUser = content?.startsWith('You:');
                                const isAgent = content?.startsWith('Agent:');
                                const isManager = content?.startsWith('Manager:');
                                
                                if (isUser) {
                                    content = content.replace(/^You:\s*/, '');
                                    senderLabel = 'You';
                                    isFromUser = true;
                                } else if (isAgent) {
                                    content = content.replace(/^Agent:\s*/, '');
                                    senderLabel = 'AI Assistant';
                                    isFromAgent = true;
                                } else if (isManager) {
                                    content = content.replace(/^Manager:\s*/, '');
                                    senderLabel = 'Manager';
                                    isFromManager = true;
                                } else {
                                    // Raw message data
                                    if (typeof msg === 'object' && msg.type) {
                                        content = JSON.stringify(msg);
                                        senderLabel = 'System';
                                    }
                                }
                            }
                            
                            // Determine message styling based on sender
                            const messageStyle = isFromUser 
                                ? "bg-blue-600 text-white"
                                : isFromManager 
                                    ? "bg-purple-600 text-white"
                                    : "bg-white border text-gray-800";

                            return (
                                <div
                                    key={idx}
                                    className={cn(
                                        "flex w-full",
                                        isFromUser ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "flex max-w-[80%] items-start gap-2 rounded-lg p-3",
                                            messageStyle
                                        )}
                                    >
                                        <div className={cn(
                                            "p-1 rounded-full", 
                                            isFromUser ? "bg-blue-700" : isFromManager ? "bg-purple-700" : "bg-gray-200"
                                        )}>
                                            {isFromUser ? (
                                                <User size={16} />
                                            ) : isFromManager ? (
                                                <Crown size={16} className="text-white" />
                                            ) : (
                                                <Bot size={16} />
                                            )}
                                        </div>
                                        <div>
                                            {senderLabel && (
                                                <div className="text-xs opacity-75 mb-1">{senderLabel}</div>
                                            )}
                                            <p className="text-sm">{content}</p>
                                            {msg.created_at && (
                                                <div className="text-xs opacity-75 mt-1">
                                                    {new Date(msg.created_at).toLocaleTimeString()}
                                                </div>
                                            )}
                                        </div>
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

'use client';

import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Send, User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkerChat() {
    const [clientId, setClientId] = useState<number | null>(null);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Generate random client ID on mount
        setClientId(Math.floor(Math.random() * 10000));
    }, []);

    const wsUrl = clientId ? `ws://localhost:8000/ws/worker/${clientId}` : '';
    const { messages, sendMessage, isConnected } = useWebSocket(wsUrl);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (input.trim()) {
            sendMessage(input);
            setInput('');
        }
    };

    if (!clientId) return <div>Loading...</div>;

    return (
        <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
            <Card className="w-full max-w-md h-[600px] flex flex-col shadow-xl">
                <CardHeader className="border-b bg-white rounded-t-lg">
                    <CardTitle className="flex items-center justify-between">
                        <span>Workhub Assistant</span>
                        <span className={cn("text-xs px-2 py-1 rounded-full", isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                            {isConnected ? 'Online' : 'Offline'}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.map((msg, idx) => {
                        // Heuristic to determine sender based on content prefix or type
                        // In a real app, the message object should have a 'sender' field
                        const isUser = msg.content?.startsWith('You:');
                        const content = msg.content?.replace(/^(You:|Agent:)\s*/, '') || JSON.stringify(msg);

                        return (
                            <div
                                key={idx}
                                className={cn(
                                    "flex w-full",
                                    isUser ? "justify-end" : "justify-start"
                                )}
                            >
                                <div
                                    className={cn(
                                        "flex max-w-[80%] items-start gap-2 rounded-lg p-3",
                                        isUser
                                            ? "bg-blue-600 text-white flex-row-reverse"
                                            : "bg-white border text-gray-800"
                                    )}
                                >
                                    <div className={cn("p-1 rounded-full", isUser ? "bg-blue-700" : "bg-gray-200")}>
                                        {isUser ? <User size={16} /> : <Bot size={16} />}
                                    </div>
                                    <p className="text-sm">{content}</p>
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
    );
}

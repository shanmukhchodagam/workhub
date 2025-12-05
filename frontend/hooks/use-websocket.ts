import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (url: string) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!url) return;

        const socket = new WebSocket(url);

        socket.onopen = () => {
            setIsConnected(true);
            console.log('Connected to WebSocket');
        };

        socket.onmessage = (event) => {
            try {
                // Try parsing as JSON first
                const data = JSON.parse(event.data);
                setMessages((prev) => [...prev, data]);
            } catch (e) {
                // If not JSON, treat as string
                setMessages((prev) => [...prev, { content: event.data, type: 'message' }]);
            }
        };

        socket.onclose = () => {
            setIsConnected(false);
            console.log('Disconnected from WebSocket');
        };

        ws.current = socket;

        return () => {
            socket.close();
        };
    }, [url]);

    const sendMessage = useCallback((message: string) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(message);
        }
    }, []);

    return { messages, sendMessage, isConnected };
};

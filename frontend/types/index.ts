export interface User {
    id: number;
    username: string;
    role: 'worker' | 'manager';
}

export interface Task {
    id: number;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    assigned_to: number;
    created_at: string;
}

export interface Incident {
    id: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
    reported_by: number;
    image_url?: string;
    created_at: string;
}

export interface Message {
    id?: number;
    content: string;
    sender_id: number;
    intent?: string;
    created_at?: string;
    type?: 'message' | 'agent_response';
}

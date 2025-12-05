"use client";

import { useAuth } from "../app/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[]; // "Manager", "Worker"
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/login");
        } else if (!isLoading && user && allowedRoles && !allowedRoles.includes(user.role)) {
            // Redirect if role doesn't match
            if (user.role === "Manager") {
                router.push("/manager");
            } else {
                router.push("/worker");
            }
        }
    }, [user, isLoading, router, allowedRoles]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return null; // Will redirect
    }

    return <>{children}</>;
}

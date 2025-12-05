import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, HardHat, LayoutDashboard } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4 text-center">
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-blue-900">
          Workhub Automation Platform
        </h1>
        <p className="text-xl text-gray-600">
          AI-powered workflow automation for frontline teams. Seamlessly connect field workers with management through intelligent chat.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link href="/login">
            <Button size="lg" className="w-full sm:w-auto gap-2 h-16 text-lg">
              Sign In
              <ArrowRight size={16} />
            </Button>
          </Link>

          <Link href="/register">
            <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 h-16 text-lg">
              Create Manager Account
              <ArrowRight size={16} />
            </Button>
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="font-bold text-lg mb-2">Chat-Based</h3>
            <p className="text-sm text-gray-500">Workers interact naturally via chat. No complex forms or training required.</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="font-bold text-lg mb-2">AI-Powered</h3>
            <p className="text-sm text-gray-500">Intelligent agents detect intent and trigger automated workflows instantly.</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="font-bold text-lg mb-2">Real-Time</h3>
            <p className="text-sm text-gray-500">Managers see live updates, incidents, and task completions as they happen.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

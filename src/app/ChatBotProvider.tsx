'use client';
import { usePathname } from 'next/navigation';
import ChatBot from './member/ChatBot';

export default function ChatBotProvider() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin-move2026')) return null;
  return <ChatBot />;
}

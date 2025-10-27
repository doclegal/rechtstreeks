import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: string;
  content: string;
}

interface CaseChatProps {
  caseId: string;
}

export function CaseChat({ caseId }: CaseChatProps) {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch conversation history
  const { data: chatData, isLoading } = useQuery({
    queryKey: ['/api/cases', caseId, 'chat'],
    queryFn: async () => {
      const response = await fetch(`/api/cases/${caseId}/chat`);
      if (!response.ok) throw new Error('Failed to fetch chat history');
      return response.json();
    },
  });

  const history: ChatMessage[] = chatData?.history || [];

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await apiRequest('POST', `/api/cases/${caseId}/chat`, {
        message: userMessage
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate and refetch chat history
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'chat'] });
      setMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Chat fout",
        description: error.message || "Kon bericht niet versturen",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          AI Assistent
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Stel vragen over uw zaak en ontvang direct antwoord
        </p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 min-h-0 gap-4">
        {/* Messages area */}
        <ScrollArea 
          ref={scrollRef}
          className="flex-1 pr-4"
        >
          <div className="space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            
            {!isLoading && history.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Start een gesprek</p>
                <p className="text-sm mt-1">
                  Stel een vraag over uw zaak, documenten of juridisch advies
                </p>
              </div>
            )}
            
            {history.map((msg, idx) => {
              // Clean up any legacy JSON-wrapped messages
              let cleanContent = msg.content;
              if (msg.role === 'assistant' && cleanContent.includes('{"chat_response"')) {
                try {
                  const parsed = JSON.parse(cleanContent);
                  cleanContent = parsed.chat_response || cleanContent;
                } catch (e) {
                  // Not valid JSON, use as-is
                }
              }
              
              return (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  data-testid={`chat-message-${idx}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{cleanContent}</p>
                  </div>
                </div>
              );
            })}
            
            {sendMessageMutation.isPending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm text-muted-foreground">AI denkt na...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="flex gap-2 flex-shrink-0">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Typ uw vraag..."
            disabled={sendMessageMutation.isPending}
            data-testid="input-chat-message"
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMessageMutation.isPending}
            data-testid="button-send-message"
            size="icon"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

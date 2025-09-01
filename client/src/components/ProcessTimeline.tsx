import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle, 
  Clock, 
  Circle, 
  ChevronDown, 
  ExternalLink 
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface TimelineStep {
  id: string;
  title: string;
  description: string;
  estimatedDuration: string;
  status: "completed" | "active" | "pending";
  tips?: string[];
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
}

interface ProcessTimelineProps {
  currentStep: number;
}

export default function ProcessTimeline({ currentStep }: ProcessTimelineProps) {
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const steps: TimelineStep[] = [
    {
      id: "upload",
      title: "Upload & Analyse",
      description: "Documenten uploaden en AI-analyse laten uitvoeren om de zaak te beoordelen.",
      estimatedDuration: "1-2 werkdagen",
      status: currentStep > 2 ? "completed" : currentStep <= 2 ? "active" : "pending",
      tips: ["Upload alle relevante documenten in één keer", "Zorg dat documenten leesbaar zijn"],
      faqs: [
        {
          question: "Welke documenten heb ik nodig?",
          answer: "Contracten, correspondentie, betalingsbewijzen en alle relevante communicatie."
        },
        {
          question: "Hoe lang duurt de analyse?",
          answer: "De AI-analyse is meestal binnen een paar minuten klaar."
        }
      ]
    },
    {
      id: "resolve",
      title: "Oplossen",
      description: "Brief opstellen en deurwaarder inschakelen voor formele betekening.",
      estimatedDuration: "5-7 werkdagen",
      status: currentStep > 5 ? "completed" : (currentStep >= 3 && currentStep <= 5) ? "active" : "pending",
      tips: ["Brief wordt automatisch gegenereerd", "Deurwaarder regelt betekening professioneel"],
      faqs: [
        {
          question: "Kan ik de brief aanpassen?",
          answer: "Ja, u kunt de gegenereerde brief bekijken en wijzigingen voorstellen."
        },
        {
          question: "Wat kost een deurwaarder?",
          answer: "Kosten zijn ongeveer €275-€350 en worden doorberekend aan de wederpartij bij winst."
        }
      ]
    },
    {
      id: "proceed",
      title: "Procederen",
      description: "Dagvaarding indienen bij rechtbank en procedure starten.",
      estimatedDuration: "2-4 maanden",
      status: currentStep > 7 ? "completed" : currentStep >= 6 ? "active" : "pending",
      tips: ["Rechtbank plant automatisch een zitting in", "U krijgt bericht over de zittingsdatum"],
      faqs: [
        {
          question: "Moet ik naar de rechtbank?",
          answer: "Meestal wel. U kunt zich laten vertegenwoordigen door een advocaat."
        },
        {
          question: "Hoe lang duurt een procedure?",
          answer: "Kantongerecht procedures duren gemiddeld 3-6 maanden."
        }
      ]
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "active":
        return <Clock className="h-5 w-5 text-primary" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case "completed":
        return "border-l-success";
      case "active":
        return "border-l-primary";
      default:
        return "border-l-muted";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Proces uitleg
          </CardTitle>
          <Link href="/help">
            <Button variant="ghost" size="sm" data-testid="link-more-info">
              Meer info
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step) => (
            <div 
              key={step.id}
              className={`border-l-2 pl-4 ${getStatusBorder(step.status)}`}
              data-testid={`timeline-step-${step.id}`}
            >
              <div className="flex items-center space-x-2 mb-2">
                {getStatusIcon(step.status)}
                <span className="font-medium text-foreground">{step.title}</span>
                {step.status === "active" && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                    Huidige stap
                  </span>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {step.description}
              </p>
              
              <p className="text-xs text-muted-foreground mb-3">
                Verwachte doorlooptijd: {step.estimatedDuration}
              </p>

              {step.tips && (
                <div className="mb-3">
                  <h5 className="text-xs font-medium text-foreground mb-1">Tips:</h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {step.tips.map((tip, index) => (
                      <li key={index} className="flex items-start space-x-1">
                        <span>•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {step.faqs && (
                <Collapsible 
                  open={expandedFAQ === step.id} 
                  onOpenChange={(open) => setExpandedFAQ(open ? step.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs p-0 h-auto font-medium text-primary hover:text-primary/80"
                      data-testid={`button-toggle-faq-${step.id}`}
                    >
                      Wat als...?
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="space-y-2 text-xs">
                      {step.faqs.map((faq, index) => (
                        <div key={index} className="bg-muted/50 rounded p-2">
                          <p className="font-medium text-foreground mb-1">{faq.question}</p>
                          <p className="text-muted-foreground">{faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

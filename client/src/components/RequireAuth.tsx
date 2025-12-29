import { useEffect } from "react";
import { useLocation } from "wouter";

export default function RequireAuth() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/login");
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Doorsturen naar login...</p>
      </div>
    </div>
  );
}

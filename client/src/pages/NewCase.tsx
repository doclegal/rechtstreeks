import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCase } from "@/hooks/useCase";
import { useLocation } from "wouter";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { useCaseContext } from "@/contexts/CaseContext";

const newCaseSchema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  description: z.string().min(10, "Beschrijving moet minimaal 10 karakters bevatten"),
  category: z.string().min(1, "Selecteer een categorie"),
  claimAmount: z.string().optional(),
  userRole: z.enum(["EISER", "GEDAAGDE"], {
    required_error: "Selecteer uw rol in deze zaak",
  }),
  counterpartyType: z.enum(["individual", "company"]),
  counterpartyName: z.string().min(1, "Naam wederpartij is verplicht"),
  counterpartyEmail: z.string().email("Ongeldig emailadres").optional().or(z.literal("")),
  counterpartyPhone: z.string().optional(),
  counterpartyAddress: z.string().optional(),
});

type NewCaseFormData = z.infer<typeof newCaseSchema>;

export default function NewCase() {
  const [, setLocation] = useLocation();
  const createCaseMutation = useCreateCase();
  const { setSelectedCaseId } = useCaseContext();
  
  const form = useForm<NewCaseFormData>({
    resolver: zodResolver(newCaseSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      claimAmount: "",
      userRole: "EISER", // Default to claimant (required for dagvaarding)
      counterpartyType: "individual",
      counterpartyName: "",
      counterpartyEmail: "",
      counterpartyPhone: "",
      counterpartyAddress: "",
    },
  });

  const onSubmit = (data: NewCaseFormData) => {
    createCaseMutation.mutate(data, {
      onSuccess: (newCase) => {
        if (newCase?.id) {
          setSelectedCaseId(newCase.id);
        }
        setLocation("/dashboard");
      },
    });
  };

  const categories = [
    "Contractrecht",
    "Arbeidsrecht", 
    "Huurrecht",
    "Consumentenrecht",
    "Schadevergoeding",
    "Overig"
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nieuwe zaak starten</h1>
          <p className="text-muted-foreground">Vul de gegevens van uw zaak in</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              <span>Zaak gegevens</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Titel van de zaak *</Label>
              <Input
                id="title"
                {...form.register("title")}
                placeholder="Korte beschrijving van uw zaak"
                data-testid="input-title"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Beschrijving *</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="Uitgebreide beschrijving van uw situatie, wat er is gebeurd en wat u wilt bereiken"
                rows={4}
                data-testid="textarea-description"
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Categorie *</Label>
                <Select 
                  value={form.watch("category")} 
                  onValueChange={(value) => form.setValue("category", value)}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Selecteer categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.category.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="claimAmount">Claim bedrag (€)</Label>
                <Input
                  id="claimAmount"
                  {...form.register("claimAmount")}
                  placeholder="15000"
                  type="number"
                  step="0.01"
                  data-testid="input-claim-amount"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Role Selection */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary">Uw rol in deze zaak *</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Het is belangrijk te weten of u degene bent die een vordering indient, of degene die wordt aangeklaagd.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  form.watch("userRole") === "EISER" 
                    ? "border-primary bg-primary/10 shadow-sm" 
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => form.setValue("userRole", "EISER")}
                data-testid="option-role-eiser"
              >
                <div className="flex items-start space-x-3">
                  <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    form.watch("userRole") === "EISER" ? "border-primary" : "border-border"
                  }`}>
                    {form.watch("userRole") === "EISER" && (
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">Ik ben de Eiser</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ik wil een vordering indienen tegen een wederpartij. Ik ben de aanklager/eisende partij.
                    </p>
                  </div>
                </div>
              </div>

              <div 
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  form.watch("userRole") === "GEDAAGDE" 
                    ? "border-primary bg-primary/10 shadow-sm" 
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => form.setValue("userRole", "GEDAAGDE")}
                data-testid="option-role-gedaagde"
              >
                <div className="flex items-start space-x-3">
                  <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    form.watch("userRole") === "GEDAAGDE" ? "border-primary" : "border-border"
                  }`}>
                    {form.watch("userRole") === "GEDAAGDE" && (
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">Ik ben de Gedaagde</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Er is een vordering tegen mij ingediend. Ik ben de verwerende/aangeklaagde partij.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {form.formState.errors.userRole && (
              <p className="text-sm text-destructive mt-2">
                {form.formState.errors.userRole.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Counterparty Information */}
        <Card>
          <CardHeader>
            <CardTitle>Wederpartij gegevens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Type wederpartij *</Label>
              <Select 
                value={form.watch("counterpartyType")} 
                onValueChange={(value) => form.setValue("counterpartyType", value as "individual" | "company")}
              >
                <SelectTrigger data-testid="select-counterparty-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Particulier</SelectItem>
                  <SelectItem value="company">Bedrijf</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="counterpartyName">
                {form.watch("counterpartyType") === "company" ? "Bedrijfsnaam" : "Naam"} *
              </Label>
              <Input
                id="counterpartyName"
                {...form.register("counterpartyName")}
                placeholder={form.watch("counterpartyType") === "company" ? "Bedrijf B.V." : "Voor- en achternaam"}
                data-testid="input-counterparty-name"
              />
              {form.formState.errors.counterpartyName && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.counterpartyName.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="counterpartyEmail">Email</Label>
                <Input
                  id="counterpartyEmail"
                  {...form.register("counterpartyEmail")}
                  placeholder="email@voorbeeld.nl"
                  type="email"
                  data-testid="input-counterparty-email"
                />
                {form.formState.errors.counterpartyEmail && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.counterpartyEmail.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="counterpartyPhone">Telefoon</Label>
                <Input
                  id="counterpartyPhone"
                  {...form.register("counterpartyPhone")}
                  placeholder="06-12345678"
                  data-testid="input-counterparty-phone"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="counterpartyAddress">Adres</Label>
              <Textarea
                id="counterpartyAddress"
                {...form.register("counterpartyAddress")}
                placeholder="Straat 123, 1234 AB Stad"
                rows={2}
                data-testid="textarea-counterparty-address"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => setLocation("/")}
            data-testid="button-cancel"
          >
            Annuleren
          </Button>
          <Button 
            type="submit" 
            disabled={createCaseMutation.isPending}
            data-testid="button-create-case"
          >
            {createCaseMutation.isPending ? "Aanmaken..." : "Zaak aanmaken"}
          </Button>
        </div>
      </form>
    </div>
  );
}
